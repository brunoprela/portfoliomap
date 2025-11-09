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

    def __init__(self, storage_root: Path) -> None:
        self._root = storage_root if storage_root.suffix == "" else storage_root.parent
        self._root.mkdir(parents=True, exist_ok=True)
        self._portfolios_path = self._root / "portfolios"
        self._symbols_path = self._root / "portfolio_symbols"

        self._lock = Lock()
        self._portfolios: Dict[str, Portfolio] = {}
        self._portfolio_symbols: Dict[str, Dict[str, float]] = {}

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

    @staticmethod
    def _parse_timestamp(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(str(value))
        except ValueError:
            return None

    def _save(self) -> None:
        portfolios_frame = self._build_portfolios_frame()
        symbols_frame = self._build_symbols_frame()

        self._write_table(self._portfolios_path, portfolios_frame)
        self._write_table(self._symbols_path, symbols_frame)

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

    def _validate_allocation_budget(
        self,
        requested: float,
        exclude_id: Optional[str] = None,
    ) -> None:
        total = 0.0
        for existing_id, portfolio in self._portfolios.items():
            if existing_id == exclude_id:
                continue
            total += portfolio.allocation_percent
        if total + requested > 1.0 + 1e-6:
            raise ValueError("Total allocation across portfolios cannot exceed 100% of the Alpaca account")

    def list_portfolios(self) -> PortfolioListResponse:
        with self._lock:
            portfolios = sorted(self._portfolios.values(), key=lambda item: item.created_at)
            return PortfolioListResponse(portfolios=portfolios)

    def create_portfolio(self, payload: PortfolioCreate) -> PortfolioResponse:
        with self._lock:
            allocation = float(payload.allocation_percent)
            self._validate_allocation_budget(allocation)

            now = _timestamp()
            pid = str(uuid4())
            symbols = _normalize_symbols(payload.symbols)

            start_date = payload.start_date or now
            if start_date.tzinfo is None:
                start_date = start_date.replace(tzinfo=timezone.utc)
            else:
                start_date = start_date.astimezone(timezone.utc)

            allocations_map = self._normalize_allocations(symbols, payload.allocations)

            portfolio = Portfolio(
                id=pid,
                name=payload.name.strip(),
                description=(payload.description.strip() if payload.description else None),
                symbols=symbols,
                allocation_percent=allocation,
                allocations=allocations_map,
                start_date=start_date,
                created_at=now,
                updated_at=now,
            )

            self._portfolios[pid] = portfolio
            self._portfolio_symbols[pid] = allocations_map
            self._save()
            return PortfolioResponse(portfolio=portfolio)

    def update_portfolio(self, portfolio_id: str, payload: PortfolioUpdate) -> PortfolioResponse:
        with self._lock:
            if portfolio_id not in self._portfolios:
                raise KeyError(f"Portfolio '{portfolio_id}' not found")

            portfolio = self._portfolios[portfolio_id]
            updated = portfolio.model_copy()

            if payload.name is not None:
                updated.name = payload.name.strip()
            if payload.description is not None:
                updated.description = payload.description.strip() or None

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
                updated.symbols = symbols
                updated.allocations = allocations_map
            else:
                allocations_map = dict(self._portfolio_symbols.get(portfolio_id, {}) or {})
                updated.allocations = allocations_map

            if payload.allocation_percent is not None:
                allocation = float(payload.allocation_percent)
                self._validate_allocation_budget(allocation, exclude_id=portfolio_id)
                updated.allocation_percent = allocation

            if payload.start_date is not None:
                start_date = payload.start_date
                if start_date.tzinfo is None:
                    start_date = start_date.replace(tzinfo=timezone.utc)
                else:
                    start_date = start_date.astimezone(timezone.utc)
                updated.start_date = start_date

            updated.updated_at = _timestamp()
            self._portfolios[portfolio_id] = updated
            self._save()
            return PortfolioResponse(portfolio=updated)

    def delete_portfolio(self, portfolio_id: str) -> None:
        with self._lock:
            if portfolio_id not in self._portfolios:
                raise KeyError(f"Portfolio '{portfolio_id}' not found")

            del self._portfolios[portfolio_id]
            self._portfolio_symbols.pop(portfolio_id, None)
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

    def all_symbols(self) -> List[str]:
        with self._lock:
            symbols: set[str] = set()
            for weights in self._portfolio_symbols.values():
                symbols.update(weights.keys())
            return sorted(symbols)
