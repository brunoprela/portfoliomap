from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List

import requests
from fastapi import APIRouter, HTTPException, Query, Request, status

from .models import (
    CombinedHistoryResponse,
    CombinedSnapshotResponse,
    GlobalEndDateUpdate,
    GlobalStartDateResponse,
    GlobalStartDateUpdate,
    PortfolioCreate,
    PortfolioListResponse,
    PortfolioResponse,
    PortfolioSnapshotResponse,
    PortfolioHistoryResponse,
    PortfolioUpdate,
    PortfolioHistoryPoint,
    TickerPrice,
)




logger = logging.getLogger(__name__)


def _settings(request: Request):
    return getattr(request.app.state, "settings", None)


router = APIRouter(prefix="/api/portfolios", tags=["Portfolios"])


def _store(request: Request):
    store = getattr(request.app.state, "portfolio_store", None)
    if store is None:  # pragma: no cover - should not happen
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Portfolio store unavailable")
    return store


def _feed(request: Request):
    return getattr(request.app.state, "alpaca_feed", None)


async def _refresh_feed_subscriptions(request: Request) -> None:
    store = _store(request)
    symbols = store.all_symbols()

    settings = _settings(request)
    if settings is not None:
        settings.alpaca_symbols = symbols

    feed = _feed(request)
    if feed is not None:
        await feed.set_symbols(symbols)


def _fetch_latest_trades(settings, symbols: List[str]) -> Dict[str, TickerPrice]:
    if not symbols:
        return {}
    if not settings or not getattr(settings, "has_alpaca_credentials", False):
        return {symbol: TickerPrice(symbol=symbol) for symbol in symbols}

    url = "https://data.alpaca.markets/v2/stocks/trades/latest"
    params = {"symbols": ",".join(symbols)}
    feed = getattr(settings, "alpaca_data_feed", None)
    if feed:
        params["feed"] = feed
    headers = {
        "APCA-API-KEY-ID": settings.alpaca_api_key,
        "APCA-API-SECRET-KEY": settings.alpaca_api_secret,
    }

    try:
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        payload = response.json() or {}
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to load latest trades from Alpaca: %s", exc)
        return {symbol: TickerPrice(symbol=symbol) for symbol in symbols}

    trades = payload.get("trades", {})
    quotes: Dict[str, TickerPrice] = {}

    for symbol in symbols:
        trade = trades.get(symbol) or trades.get(symbol.upper()) or {}
        price = trade.get("p")
        timestamp = trade.get("t")
        parsed_ts = None
        if isinstance(timestamp, str):
            try:
                parsed_ts = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            except ValueError:
                parsed_ts = None
        quotes[symbol] = TickerPrice(
            symbol=symbol,
            price=float(price) if price is not None else None,
            exchange=trade.get("x"),
            timestamp=parsed_ts,
            conditions=trade.get("c"),
        )

    return quotes


def _fetch_historical_bars(
    settings, symbols: List[str], start_date: date, end_date: date
) -> Dict[str, List[Dict[str, object]]]:
    if not symbols:
        return {}
    if not settings or not getattr(settings, "has_alpaca_credentials", False):
        return {symbol: [] for symbol in symbols}

    url = "https://data.alpaca.markets/v2/stocks/bars"
    params = {
        "symbols": ",".join(symbols),
        "timeframe": "1Day",
        "start": datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc).isoformat(),
        "end": datetime.combine(end_date, datetime.max.time(), tzinfo=timezone.utc).isoformat(),
        "adjustment": "split",
    }
    feed = getattr(settings, "alpaca_data_feed", None)
    if feed:
        params["feed"] = feed
    headers = {
        "APCA-API-KEY-ID": settings.alpaca_api_key,
        "APCA-API-SECRET-KEY": settings.alpaca_api_secret,
    }

    try:
        response = requests.get(url, params=params, headers=headers, timeout=15)
        response.raise_for_status()
        payload = response.json() or {}
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to load historical bars from Alpaca: %s", exc)
        return {symbol: [] for symbol in symbols}

    bars_payload = payload.get("bars", {})
    return {symbol: bars_payload.get(symbol, []) for symbol in symbols}








def _build_portfolio_history(
    symbols: List[str],
    weights: Dict[str, float],
    bars: Dict[str, List[Dict[str, object]]],
) -> List[PortfolioHistoryPoint]:
    price_maps: Dict[str, Dict[datetime, float]] = {}
    for symbol in symbols:
        entries = bars.get(symbol, []) or []
        symbol_prices: Dict[datetime, float] = {}
        for entry in entries:
            timestamp = entry.get("t") or entry.get("time")
            if not isinstance(timestamp, str):
                continue
            try:
                dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            except ValueError:
                continue
            close_price = entry.get("c")
            if close_price is None or not isinstance(close_price, (int, float, str)):
                continue
            try:
                price_value = float(close_price)
            except (TypeError, ValueError):
                continue
            symbol_prices[dt] = price_value
        if symbol_prices:
            price_maps[symbol] = symbol_prices

    if not price_maps:
        return []

    date_sets = [set(price_map.keys()) for price_map in price_maps.values() if price_map]
    if not date_sets:
        return []

    common_dates = sorted(set.intersection(*date_sets))
    if not common_dates:
        return []

    history: List[PortfolioHistoryPoint] = []
    base_value: float | None = None

    for dt in common_dates:
        components: Dict[str, float] = {}
        total = 0.0
        skip = False
        for symbol in symbols:
            price = price_maps.get(symbol, {}).get(dt)
            if price is None:
                skip = True
                break
            weight = weights.get(symbol) or 0.0
            component = weight * price
            components[symbol] = component
            total += component
        if skip or total <= 0.0:
            continue
        if base_value is None:
            base_value = total
        normalized = total / base_value if base_value else 1.0
        history.append(
            PortfolioHistoryPoint(date=dt, value=normalized, components=components)
        )

    return history


@router.get("/combined/snapshot", response_model=CombinedSnapshotResponse)
async def combined_snapshot(request: Request) -> CombinedSnapshotResponse:
    store = _store(request)
    symbol_allocations = store.combined_symbol_allocations()
    symbols = sorted(symbol_allocations.keys())
    settings = _settings(request)

    quotes_map = _fetch_latest_trades(settings, symbols) if symbols else {}
    quotes: List[TickerPrice] = []
    for symbol in symbols:
        base_quote = quotes_map.get(symbol)
        weight = symbol_allocations.get(symbol)
        if base_quote is not None:
            quote = base_quote.model_copy(update={"weight": weight})
        else:
            quote = TickerPrice(symbol=symbol, weight=weight)
        quotes.append(quote)

    return CombinedSnapshotResponse(
        total_allocation_percent=store.total_allocation_percent(),
        portfolio_count=store.portfolio_count(),
        earliest_start_date=store.combined_start_date(),
        latest_end_date=store.combined_end_date(),
        symbol_allocations=symbol_allocations,
        quotes=quotes,
    )


@router.get("/combined/history", response_model=CombinedHistoryResponse)
async def combined_history(
    request: Request,
    start_date: date | None = Query(default=None, alias="startDate"),
) -> CombinedHistoryResponse:
    store = _store(request)
    symbol_allocations = store.combined_symbol_allocations()
    symbols = sorted(symbol_allocations.keys())

    today = datetime.now(tz=timezone.utc).date()
    earliest_start = store.combined_start_date()
    earliest_date = earliest_start.date() if earliest_start is not None else today

    if start_date is None or start_date < earliest_date:
        start_date_obj = earliest_date
    else:
        start_date_obj = start_date

    combined_start_dt = store.combined_start_date()
    combined_start = combined_start_dt.date() if combined_start_dt else None
    combined_end_dt = store.combined_end_date()
    combined_end = combined_end_dt.date() if combined_end_dt else None
    effective_end = combined_end if combined_end is not None else today
    if start_date_obj > effective_end:
        start_date_obj = effective_end

    settings = _settings(request)
    bars = _fetch_historical_bars(settings, symbols, start_date_obj, effective_end) if symbols else {}
    history_points = _build_portfolio_history(symbols, symbol_allocations, bars) if symbols else []

    if history_points:
        history_start = history_points[0].date
        history_end = history_points[-1].date
    else:
        history_start = datetime.combine(start_date_obj, datetime.min.time(), tzinfo=timezone.utc)
        history_end = datetime.combine(effective_end, datetime.min.time(), tzinfo=timezone.utc)

    return CombinedHistoryResponse(
        start_date=history_start,
        end_date=history_end,
        history=history_points,
    )


@router.post("/combined/start-date", response_model=CombinedSnapshotResponse)
async def update_combined_start_date(request: Request, payload: GlobalStartDateUpdate) -> CombinedSnapshotResponse:
    store = _store(request)
    try:
        store.set_global_start_date(payload.start_date)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return await combined_snapshot(request)


@router.post("/combined/end-date", response_model=CombinedSnapshotResponse)
async def update_combined_end_date(request: Request, payload: GlobalEndDateUpdate) -> CombinedSnapshotResponse:
    store = _store(request)
    try:
        store.set_global_end_date(payload.end_date)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return await combined_snapshot(request)


@router.get("", response_model=PortfolioListResponse)
async def list_portfolios(request: Request) -> PortfolioListResponse:
    store = _store(request)
    return store.list_portfolios()


@router.get("/{portfolio_id}", response_model=PortfolioResponse)
async def read_portfolio(request: Request, portfolio_id: str) -> PortfolioResponse:
    store = _store(request)
    try:
        portfolio = store.get_portfolio(portfolio_id)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PortfolioResponse(portfolio=portfolio)


@router.get("/{portfolio_id}/snapshot", response_model=PortfolioSnapshotResponse)
async def portfolio_snapshot(request: Request, portfolio_id: str) -> PortfolioSnapshotResponse:
    store = _store(request)
    try:
        portfolio = store.get_portfolio(portfolio_id)
        weights = store.symbol_weights(portfolio_id)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    settings = _settings(request)
    symbols = portfolio.symbols
    quotes_map = _fetch_latest_trades(settings, symbols)

    quotes: List[TickerPrice] = []
    for symbol in symbols:
        base_quote = quotes_map.get(symbol)
        weight = weights.get(symbol)
        if base_quote is not None:
            quote = base_quote.model_copy(update={"weight": weight})
        else:
            quote = TickerPrice(symbol=symbol, weight=weight)
        quotes.append(quote)

    return PortfolioSnapshotResponse(portfolio=portfolio, quotes=quotes)




@router.get("/{portfolio_id}/history", response_model=PortfolioHistoryResponse)
async def portfolio_history(
    request: Request,
    portfolio_id: str,
    start_date: date | None = Query(default=None, alias="startDate"),
) -> PortfolioHistoryResponse:
    store = _store(request)
    try:
        portfolio = store.get_portfolio(portfolio_id)
        weights = store.symbol_weights(portfolio_id)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    today = datetime.now(tz=timezone.utc).date()
    combined_start_dt = store.combined_start_date()
    combined_start = combined_start_dt.date() if combined_start_dt else None
    combined_end_dt = store.combined_end_date()
    combined_end = combined_end_dt.date() if combined_end_dt else None
    portfolio_start = (portfolio.start_date or portfolio.created_at).date()

    if start_date is None:
        if combined_start is not None:
            start_date_obj = combined_start
        else:
            start_date_obj = portfolio_start
    else:
        start_date_obj = start_date

    if combined_start is not None and start_date_obj < combined_start:
        start_date_obj = combined_start

    effective_end = combined_end if combined_end is not None else today
    if start_date_obj > effective_end:
        start_date_obj = effective_end

    settings = _settings(request)

    bars = _fetch_historical_bars(settings, portfolio.symbols, start_date_obj, effective_end)
    history_points = _build_portfolio_history(portfolio.symbols, weights, bars)

    if history_points:
        history_start = history_points[0].date
        history_end = history_points[-1].date
    else:
        history_start = datetime.combine(start_date_obj, datetime.min.time(), tzinfo=timezone.utc)
        history_end = datetime.combine(effective_end, datetime.min.time(), tzinfo=timezone.utc)

    return PortfolioHistoryResponse(
        portfolio=portfolio,
        start_date=history_start,
        end_date=history_end,
        history=history_points,
    )

@router.post("", status_code=status.HTTP_201_CREATED, response_model=PortfolioResponse)
async def create_portfolio(request: Request, payload: PortfolioCreate) -> PortfolioResponse:
    store = _store(request)
    try:
        response = store.create_portfolio(payload)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    await _refresh_feed_subscriptions(request)
    return response


@router.put("/{portfolio_id}", response_model=PortfolioResponse)
async def update_portfolio(request: Request, portfolio_id: str, payload: PortfolioUpdate) -> PortfolioResponse:
    store = _store(request)
    try:
        response = store.update_portfolio(portfolio_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await _refresh_feed_subscriptions(request)
    return response


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio(request: Request, portfolio_id: str) -> None:
    store = _store(request)
    try:
        store.delete_portfolio(portfolio_id)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await _refresh_feed_subscriptions(request)
