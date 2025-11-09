from __future__ import annotations

import pandas as pd
import pykx as kx
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Dict, List, Optional, Sequence, Tuple, cast
from uuid import uuid4

from .models import (
    Portfolio,
    PortfolioCreate,
    PortfolioListResponse,
    PortfolioResponse,
    PortfolioUpdate,
    PortfolioSetup,
    PortfolioSetupCreate,
    PortfolioSetupListResponse,
    PortfolioSetupUpdate,
)


def _normalize_symbols(symbols: List[str]) -> List[str]:
    return sorted({symbol.strip().upper() for symbol in symbols if symbol.strip()})


def _timestamp() -> datetime:
    return datetime.now(tz=timezone.utc)


class PortfolioStore:
    _PORTFOLIO_COLUMNS: Tuple[str, ...] = (
        "id",
        "name",
        "description",
        "allocation_percent",
        "start_date",
        "created_at",
        "updated_at",
    )
    _SYMBOL_COLUMNS: Tuple[str, ...] = ("portfolio_id", "symbol", "weight")
    _SETUP_COLUMNS: Tuple[str, ...] = (
        "id",
        "name",
        "description",
        "start_date",
        "end_date",
        "created_at",
        "updated_at",
    )
    _SETUP_PORTFOLIO_COLUMNS: Tuple[str, ...] = ("setup_id", "portfolio_id")

    def __init__(self, storage_root: Path) -> None:
        self._root = storage_root if storage_root.suffix == "" else storage_root.parent
        self._root.mkdir(parents=True, exist_ok=True)
        self._portfolios_path = self._root / "portfolios"
        self._symbols_path = self._root / "portfolio_symbols"
        self._setups_path = self._root / "portfolio_setups"
        self._setup_portfolios_path = self._root / "setup_portfolios"

        self._lock = Lock()
        self._portfolios: Dict[str, Portfolio] = {}
        self._portfolio_symbols: Dict[str, Dict[str, float]] = {}
        self._setups: Dict[str, PortfolioSetup] = {}
        self._setup_portfolios: Dict[str, List[str]] = {}
        self._portfolio_to_setup: Dict[str, str] = {}

        self._load()

    def _symbol_atom(self, path: Path) -> kx.SymbolAtom:
        return kx.SymbolAtom(f":{path}")

    def _read_table(self, path: Path, columns: Sequence[str]) -> pd.DataFrame:
        if not path.exists():
            return pd.DataFrame(columns=pd.Index(columns))
        try:
            table = kx.q("get", self._symbol_atom(path))
        except Exception:  # noqa: BLE001
            return pd.DataFrame(columns=pd.Index(columns))
        frame = cast(pd.DataFrame, table.pd())
        missing_cols = [col for col in columns if col not in frame.columns]
        for col in missing_cols:
            frame[col] = pd.Series(dtype="object")
        if frame.empty:
            return pd.DataFrame(columns=pd.Index(columns))
        return frame.loc[:, list(columns)]

    def _write_table(self, path: Path, frame: pd.DataFrame) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        table = kx.Table(frame)
        kx.q("{[dst; data] dst set data}", self._symbol_atom(path), table)

    def _load(self) -> None:
        with self._lock:
            portfolio_df = self._read_table(self._portfolios_path, self._PORTFOLIO_COLUMNS)
            symbols_df = self._read_table(self._symbols_path, self._SYMBOL_COLUMNS)
            setups_df = self._read_table(self._setups_path, self._SETUP_COLUMNS)
            mapping_df = self._read_table(self._setup_portfolios_path, self._SETUP_PORTFOLIO_COLUMNS)

            symbol_map: Dict[str, Dict[str, float]] = {}
            for record in symbols_df.to_dict("records"):
                pid = str(record["portfolio_id"])
                symbol = str(record["symbol"]).upper()
                weight = float(record.get("weight") or 0.0)
                symbol_map.setdefault(pid, {})[symbol] = weight

            self._portfolios = {}
            for record in portfolio_df.to_dict("records"):
                pid = str(record["id"])
                created_at = self._parse_timestamp(record.get("created_at")) or _timestamp()
                updated_at = self._parse_timestamp(record.get("updated_at")) or created_at
                start_date = self._parse_timestamp(record.get("start_date")) or created_at
                allocation = float(record.get("allocation_percent") or 0.0)
                description = record.get("description") or None
                allocations_map = symbol_map.get(pid, {})
                symbols = sorted(allocations_map.keys())
                portfolio = Portfolio(
                    id=pid,
                    name=str(record.get("name") or "").strip(),
                    description=description,
                    symbols=symbols,
                    allocation_percent=allocation,
                    allocations=allocations_map,
                    start_date=start_date,
                    created_at=created_at,
                    updated_at=updated_at,
                )
                self._portfolios[pid] = portfolio

            self._portfolio_symbols = symbol_map

            self._setups = {}
            self._setup_portfolios = {}
            self._portfolio_to_setup = {}

            if not setups_df.empty:
                for record in setups_df.to_dict("records"):
                    sid = str(record["id"])
                    created_at = self._parse_timestamp(record.get("created_at")) or _timestamp()
                    updated_at = self._parse_timestamp(record.get("updated_at")) or created_at
                    start_date = self._parse_timestamp(record.get("start_date")) or created_at
                    end_date = self._parse_timestamp(record.get("end_date")) or updated_at
                    description = record.get("description") or None
                    setup = PortfolioSetup(
                        id=sid,
                        name=str(record.get("name") or "").strip(),
                        description=description,
                        start_date=self._normalize_datetime(start_date),
                        end_date=self._normalize_datetime(end_date),
                        created_at=created_at,
                        updated_at=updated_at,
                        portfolio_ids=[],
                    )
                    self._setups[sid] = setup
                    self._setup_portfolios[sid] = []

                for record in mapping_df.to_dict("records"):
                    sid = str(record["setup_id"])
                    pid = str(record["portfolio_id"])
                    if sid in self._setups and pid in self._portfolios:
                        self._setup_portfolios.setdefault(sid, []).append(pid)
                        self._portfolio_to_setup[pid] = sid
            else:
                default_id = str(uuid4())
                now = _timestamp()
                start_date = (
                    min((portfolio.start_date for portfolio in self._portfolios.values()), default=now)
                    if self._portfolios
                    else now
                )
                setup = PortfolioSetup(
                    id=default_id,
                    name="Default Portfolio Setup",
                    description="Migrated from legacy configuration",
                    start_date=self._normalize_datetime(start_date),
                    end_date=now,
                    created_at=now,
                    updated_at=now,
                    portfolio_ids=[],
                )
                self._setups[default_id] = setup
                self._setup_portfolios[default_id] = []

            if not self._setups:
                now = _timestamp()
                sid = str(uuid4())
                setup = PortfolioSetup(
                    id=sid,
                    name="Portfolio Setup",
                    description=None,
                    start_date=now,
                    end_date=now,
                    created_at=now,
                    updated_at=now,
                    portfolio_ids=[],
                )
                self._setups[sid] = setup
                self._setup_portfolios[sid] = []

            first_setup_id = next(iter(self._setups.keys()))
            for pid in self._portfolios:
                sid = self._portfolio_to_setup.get(pid)
                if sid is None or sid not in self._setups:
                    self._setup_portfolios.setdefault(first_setup_id, []).append(pid)
                    self._portfolio_to_setup[pid] = first_setup_id

            self._enforce_setup_constraints()

    @staticmethod
    def _parse_timestamp(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(str(value))
        except ValueError:
            return None

    def _save(self) -> None:
        self._enforce_setup_constraints()
        portfolios_frame = self._build_portfolios_frame()
        symbols_frame = self._build_symbols_frame()
        setups_frame = self._build_setups_frame()
        mapping_frame = self._build_setup_portfolios_frame()

        self._write_table(self._portfolios_path, portfolios_frame)
        self._write_table(self._symbols_path, symbols_frame)
        self._write_table(self._setups_path, setups_frame)
        self._write_table(self._setup_portfolios_path, mapping_frame)

    def _build_portfolios_frame(self) -> pd.DataFrame:
        records = []
        for portfolio in self._portfolios.values():
            records.append(
                {
                    "id": portfolio.id,
                    "name": portfolio.name,
                    "description": portfolio.description or "",
                    "allocation_percent": portfolio.allocation_percent,
                    "created_at": portfolio.created_at.isoformat(),
                    "updated_at": portfolio.updated_at.isoformat(),
                    "start_date": portfolio.start_date.isoformat(),
                }
            )
        frame = pd.DataFrame.from_records(records)
        if frame.empty:
            return pd.DataFrame(columns=pd.Index(self._PORTFOLIO_COLUMNS))
        return frame.loc[:, list(self._PORTFOLIO_COLUMNS)]

    def _build_symbols_frame(self) -> pd.DataFrame:
        records = []
        for pid, symbol_weights in self._portfolio_symbols.items():
            for symbol, weight in symbol_weights.items():
                records.append(
                    {
                        "portfolio_id": pid,
                        "symbol": symbol,
                        "weight": weight,
                    }
                )
        frame = pd.DataFrame.from_records(records)
        if frame.empty:
            return pd.DataFrame(columns=pd.Index(self._SYMBOL_COLUMNS))
        return frame.loc[:, list(self._SYMBOL_COLUMNS)]

    def _build_setups_frame(self) -> pd.DataFrame:
        records = []
        for setup in self._setups.values():
            records.append(
                {
                    "id": setup.id,
                    "name": setup.name,
                    "description": setup.description or "",
                    "start_date": setup.start_date.isoformat(),
                    "end_date": setup.end_date.isoformat(),
                    "created_at": setup.created_at.isoformat(),
                    "updated_at": setup.updated_at.isoformat(),
                }
            )
        frame = pd.DataFrame.from_records(records)
        if frame.empty:
            return pd.DataFrame(columns=pd.Index(self._SETUP_COLUMNS))
        return frame.loc[:, list(self._SETUP_COLUMNS)]

    def _build_setup_portfolios_frame(self) -> pd.DataFrame:
        records = []
        for sid, portfolio_ids in self._setup_portfolios.items():
            for pid in portfolio_ids:
                records.append({"setup_id": sid, "portfolio_id": pid})
        frame = pd.DataFrame.from_records(records)
        if frame.empty:
            return pd.DataFrame(columns=pd.Index(self._SETUP_PORTFOLIO_COLUMNS))
        return frame.loc[:, list(self._SETUP_PORTFOLIO_COLUMNS)]

    def _normalize_allocations(
        self,
        symbols: List[str],
        allocations: Optional[Dict[str, float]] = None,
    ) -> Dict[str, float]:
        if not symbols:
            return {}

        if not allocations:
            weight = round(1.0 / len(symbols), 6)
            return {symbol: weight for symbol in symbols}

        cleaned: Dict[str, float] = {}
        for key, value in allocations.items():
            symbol = key.strip().upper()
            if not symbol:
                continue
            try:
                weight_value = float(value)
            except (TypeError, ValueError):
                weight_value = 0.0
            if weight_value < 0:
                weight_value = 0.0
            cleaned[symbol] = weight_value

        weights: Dict[str, float] = {}
        total = 0.0
        for symbol in symbols:
            weight_value = cleaned.get(symbol, 0.0)
            weights[symbol] = weight_value
            total += weight_value

        if total <= 0.0:
            equal_weight = round(1.0 / len(symbols), 6)
            return {symbol: equal_weight for symbol in symbols}

        normalized = {symbol: round(weight / total, 6) for symbol, weight in weights.items()}
        return normalized

    def _recalculate_symbol_weights(
        self, pid: str, symbols: List[str], allocations: Optional[Dict[str, float]] = None
    ) -> Dict[str, float]:
        weights = self._normalize_allocations(symbols, allocations)
        if weights:
            self._portfolio_symbols[pid] = weights
        else:
            self._portfolio_symbols.pop(pid, None)
        return weights

    def _normalize_datetime(self, value: Optional[datetime]) -> datetime:
        dt = value or _timestamp()
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt

    def _update_setup_metadata(self, setup_id: str) -> None:
        assigned = sorted(set(self._setup_portfolios.get(setup_id, [])))
        self._setup_portfolios[setup_id] = assigned
        setup = self._setups[setup_id]
        self._setups[setup_id] = setup.model_copy(
            update={
                "portfolio_ids": assigned,
                "updated_at": _timestamp(),
            }
        )

    def _enforce_setup_constraints(self) -> None:
        if not self._setups:
            return
        for sid in list(self._setups.keys()):
            assigned = sorted(pid for pid in self._setup_portfolios.get(sid, []) if pid in self._portfolios)
            self._setup_portfolios[sid] = assigned
            setup = self._setups[sid]
            updated_setup = setup.model_copy(update={"portfolio_ids": assigned})
            self._setups[sid] = updated_setup
            for pid in assigned:
                self._portfolio_to_setup[pid] = sid
                portfolio = self._portfolios[pid]
                if portfolio.start_date != updated_setup.start_date:
                    self._portfolios[pid] = portfolio.model_copy(update={"start_date": updated_setup.start_date})

    def _validate_allocation_budget(
        self,
        requested: float,
        setup_id: str,
        exclude_id: Optional[str] = None,
    ) -> None:
        total = 0.0
        for portfolio_id in self._setup_portfolios.get(setup_id, []):
            if portfolio_id == exclude_id:
                continue
            total += self._portfolios[portfolio_id].allocation_percent
        if total + requested > 1.0 + 1e-6:
            raise ValueError("Total allocation across the setup cannot exceed 100% of the Alpaca account")

    def list_setups(self) -> PortfolioSetupListResponse:
        with self._lock:
            setups = sorted(self._setups.values(), key=lambda item: item.created_at)
            return PortfolioSetupListResponse(setups=setups)

    def get_setup(self, setup_id: str) -> PortfolioSetup:
        with self._lock:
            if setup_id not in self._setups:
                raise KeyError(f"Portfolio setup '{setup_id}' not found")
            return self._setups[setup_id]

    def create_setup(self, payload: PortfolioSetupCreate) -> PortfolioSetup:
        with self._lock:
            now = _timestamp()
            sid = str(uuid4())
            start_date = self._normalize_datetime(payload.start_date)
            end_date = self._normalize_datetime(payload.end_date)
            if end_date < start_date:
                end_date = start_date
            setup = PortfolioSetup(
                id=sid,
                name=payload.name.strip(),
                description=(payload.description.strip() if payload.description else None),
                start_date=start_date,
                end_date=end_date,
                created_at=now,
                updated_at=now,
                portfolio_ids=[],
            )
            self._setups[sid] = setup
            self._setup_portfolios[sid] = []
            self._save()
            return self._setups[sid]

    def update_setup(self, setup_id: str, payload: PortfolioSetupUpdate) -> PortfolioSetup:
        with self._lock:
            if setup_id not in self._setups:
                raise KeyError(f"Portfolio setup '{setup_id}' not found")
            setup = self._setups[setup_id]
            updated = setup.model_copy()

            if payload.name is not None:
                updated = updated.model_copy(update={"name": payload.name.strip()})
            if payload.description is not None:
                updated = updated.model_copy(update={"description": payload.description.strip() or None})
            if payload.start_date is not None:
                start_date = self._normalize_datetime(payload.start_date)
                if payload.end_date is None and start_date > updated.end_date:
                    updated = updated.model_copy(update={"end_date": start_date})
                updated = updated.model_copy(update={"start_date": start_date})
            if payload.end_date is not None:
                end_date = self._normalize_datetime(payload.end_date)
                if end_date < updated.start_date:
                    raise ValueError("End date cannot be before start date")
                updated = updated.model_copy(update={"end_date": end_date})

            updated = updated.model_copy(update={"updated_at": _timestamp()})
            self._setups[setup_id] = updated
            self._enforce_setup_constraints()
            self._save()
            return self._setups[setup_id]

    def delete_setup(self, setup_id: str) -> None:
        with self._lock:
            if setup_id not in self._setups:
                raise KeyError(f"Portfolio setup '{setup_id}' not found")
            if self._setup_portfolios.get(setup_id):
                raise ValueError("Cannot delete a setup while it still contains portfolios")
            del self._setups[setup_id]
            self._setup_portfolios.pop(setup_id, None)
            if not self._setups:
                now = _timestamp()
                sid = str(uuid4())
                setup = PortfolioSetup(
                    id=sid,
                    name="Portfolio Setup",
                    description=None,
                    start_date=now,
                    end_date=now,
                    created_at=now,
                    updated_at=now,
                    portfolio_ids=[],
                )
                self._setups[sid] = setup
                self._setup_portfolios[sid] = []
            self._save()

    def list_portfolios(self, setup_id: str) -> PortfolioListResponse:
        with self._lock:
            if setup_id not in self._setups:
                raise KeyError(f"Portfolio setup '{setup_id}' not found")
            portfolios = [
                self._portfolios[pid]
                for pid in self._setup_portfolios.get(setup_id, [])
                if pid in self._portfolios
            ]
            portfolios.sort(key=lambda item: item.created_at)
            return PortfolioListResponse(portfolios=portfolios)

    def create_portfolio(self, setup_id: str, payload: PortfolioCreate) -> PortfolioResponse:
        with self._lock:
            if setup_id not in self._setups:
                raise KeyError(f"Portfolio setup '{setup_id}' not found")
            allocation = float(payload.allocation_percent)
            self._validate_allocation_budget(allocation, setup_id)

            now = _timestamp()
            pid = str(uuid4())
            symbols = _normalize_symbols(payload.symbols)
            allocations_map = self._normalize_allocations(symbols, payload.allocations)
            setup = self._setups[setup_id]

            portfolio = Portfolio(
                id=pid,
                name=payload.name.strip(),
                description=(payload.description.strip() if payload.description else None),
                symbols=symbols,
                allocation_percent=allocation,
                allocations=allocations_map,
                start_date=setup.start_date,
                created_at=now,
                updated_at=now,
            )

            self._portfolios[pid] = portfolio
            self._portfolio_symbols[pid] = allocations_map
            self._setup_portfolios.setdefault(setup_id, []).append(pid)
            self._portfolio_to_setup[pid] = setup_id
            self._update_setup_metadata(setup_id)
            self._save()
            return PortfolioResponse(portfolio=self._portfolios[pid])

    def update_portfolio(self, portfolio_id: str, payload: PortfolioUpdate) -> PortfolioResponse:
        with self._lock:
            if portfolio_id not in self._portfolios:
                raise KeyError(f"Portfolio '{portfolio_id}' not found")
            setup_id = self._portfolio_to_setup.get(portfolio_id)
            if setup_id is None or setup_id not in self._setups:
                raise ValueError("Portfolio is not associated with a setup")

            portfolio = self._portfolios[portfolio_id]
            updated = portfolio.model_copy()

            if payload.name is not None:
                updated = updated.model_copy(update={"name": payload.name.strip()})
            if payload.description is not None:
                updated = updated.model_copy(update={"description": payload.description.strip() or None})
            if payload.start_date is not None:
                raise ValueError("Portfolio start date is managed by its setup")

            symbols = updated.symbols
            allocations_override = None

            if payload.symbols is not None:
                symbols = _normalize_symbols(payload.symbols)

            if payload.allocations is not None:
                allocations_override = payload.allocations

            if payload.symbols is not None or payload.allocations is not None:
                allocations_map = self._recalculate_symbol_weights(
                    portfolio_id, symbols, allocations_override
                )
                updated = updated.model_copy(update={"symbols": symbols, "allocations": allocations_map})
            else:
                allocations_map = dict(self._portfolio_symbols.get(portfolio_id, {}) or {})
                updated = updated.model_copy(update={"allocations": allocations_map})

            if payload.allocation_percent is not None:
                allocation = float(payload.allocation_percent)
                self._validate_allocation_budget(allocation, setup_id, exclude_id=portfolio_id)
                updated = updated.model_copy(update={"allocation_percent": allocation})

            updated = updated.model_copy(update={"updated_at": _timestamp()})
            self._portfolios[portfolio_id] = updated
            self._update_setup_metadata(setup_id)
            self._save()
            return PortfolioResponse(portfolio=self._portfolios[portfolio_id])

    def delete_portfolio(self, portfolio_id: str) -> None:
        with self._lock:
            if portfolio_id not in self._portfolios:
                raise KeyError(f"Portfolio '{portfolio_id}' not found")
            setup_id = self._portfolio_to_setup.get(portfolio_id)
            if setup_id is not None:
                self._setup_portfolios.setdefault(setup_id, [])
                if portfolio_id in self._setup_portfolios[setup_id]:
                    self._setup_portfolios[setup_id].remove(portfolio_id)
                self._portfolio_to_setup.pop(portfolio_id, None)
            self._portfolios.pop(portfolio_id, None)
            self._portfolio_symbols.pop(portfolio_id, None)
            if setup_id is not None and setup_id in self._setups:
                self._update_setup_metadata(setup_id)
            self._save()

    def symbol_weights(self, portfolio_id: str) -> Dict[str, float]:
        with self._lock:
            if portfolio_id not in self._portfolios:
                raise KeyError(f"Portfolio '{portfolio_id}' not found")
            weights = self._portfolio_symbols.get(portfolio_id)
            if weights is None:
                symbols = self._portfolios[portfolio_id].symbols
                if not symbols:
                    return {}
                equal = round(1.0 / len(symbols), 6)
                return {symbol: equal for symbol in symbols}
            return dict(weights)

    def get_portfolio(self, portfolio_id: str) -> Portfolio:
        with self._lock:
            if portfolio_id not in self._portfolios:
                raise KeyError(f"Portfolio '{portfolio_id}' not found")
            return self._portfolios[portfolio_id]

    def portfolio_setup(self, portfolio_id: str) -> Optional[str]:
        with self._lock:
            return self._portfolio_to_setup.get(portfolio_id)

    def all_symbols(self) -> List[str]:
        with self._lock:
            symbols: set[str] = set()
            for weights in self._portfolio_symbols.values():
                symbols.update(weights.keys())
            return sorted(symbols)

    def setup_portfolios(self, setup_id: str) -> List[Portfolio]:
        with self._lock:
            if setup_id not in self._setups:
                raise KeyError(f"Portfolio setup '{setup_id}' not found")
            return [
                self._portfolios[pid]
                for pid in self._setup_portfolios.get(setup_id, [])
                if pid in self._portfolios
            ]

    def setup_symbol_allocations(self, setup_id: str) -> Dict[str, float]:
        with self._lock:
            if setup_id not in self._setups:
                raise KeyError(f"Portfolio setup '{setup_id}' not found")
            combined: Dict[str, float] = {}
            for pid in self._setup_portfolios.get(setup_id, []):
                portfolio = self._portfolios.get(pid)
                if portfolio is None:
                    continue
                allocation = portfolio.allocation_percent
                if allocation <= 0:
                    continue
                weights = self._portfolio_symbols.get(pid)
                symbols = portfolio.symbols
                if not symbols:
                    continue
                if not weights:
                    equal_weight = round(1.0 / len(symbols), 6)
                    weights = {symbol: equal_weight for symbol in symbols}
                for symbol, weight in weights.items():
                    combined[symbol] = combined.get(symbol, 0.0) + allocation * weight
            return combined

    def setup_total_allocation(self, setup_id: str) -> float:
        with self._lock:
            if setup_id not in self._setups:
                raise KeyError(f"Portfolio setup '{setup_id}' not found")
            return sum(
                self._portfolios[pid].allocation_percent
                for pid in self._setup_portfolios.get(setup_id, [])
                if pid in self._portfolios
            )

    def setup_start_date(self, setup_id: str) -> datetime:
        with self._lock:
            if setup_id not in self._setups:
                raise KeyError(f"Portfolio setup '{setup_id}' not found")
            return self._setups[setup_id].start_date

    def setup_end_date(self, setup_id: str) -> datetime:
        with self._lock:
            if setup_id not in self._setups:
                raise KeyError(f"Portfolio setup '{setup_id}' not found")
            return self._setups[setup_id].end_date

    def setup_portfolio_count(self, setup_id: str) -> int:
        with self._lock:
            if setup_id not in self._setups:
                raise KeyError(f"Portfolio setup '{setup_id}' not found")
            return len(self._setup_portfolios.get(setup_id, []))

