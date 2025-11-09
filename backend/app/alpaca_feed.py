from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional

import pykx as kx
from alpaca.data.enums import DataFeed  # type: ignore[import-not-found]
from alpaca.data.live.stock import StockDataStream  # type: ignore[import-not-found]
from alpaca.trading.client import TradingClient  # type: ignore[import-not-found]
from alpaca.trading.requests import GetOrdersRequest  # type: ignore[import-not-found]
from alpaca.trading.enums import OrderStatus  # type: ignore[import-not-found]

from .config import Settings


logger = logging.getLogger(__name__)


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class KdbPublisher:
    def __init__(self, settings: Settings) -> None:
        host, port = settings.kdb_tp_endpoint
        self._conn = kx.QConnection(host=host, port=port)  # type: ignore[abstract]
        self._lock = asyncio.Lock()

    async def publish(self, table: str, rows: List[dict]) -> None:
        if not rows:
            return

        data = {key: [row.get(key) for row in rows] for key in rows[0].keys()}
        table_obj = kx.Table(data=data)

        async with self._lock:
            self._conn(".u.upd", kx.SymbolAtom(table), table_obj)

    def close(self) -> None:
        self._conn.close()


class AlpacaFeedService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.publisher: Optional[KdbPublisher] = None
        self.stream: Optional[StockDataStream] = None
        self.trading_client: Optional[TradingClient] = None
        self._tasks: list[asyncio.Task] = []
        self._running = False
        self._symbols: List[str] = []

    async def start(self) -> None:
        if not self.settings.enable_alpaca_feed:
            logger.info("Alpaca feed disabled via configuration")
            return

        if not self.settings.has_alpaca_credentials:
            logger.warning("Alpaca credentials are not configured; skipping stream startup")
            return

        symbols = self.settings.alpaca_symbols
        if symbols:
            logger.info("Starting Alpaca stream for symbols: %s", ", ".join(symbols))
        else:
            logger.warning("Starting Alpaca stream with no symbol subscriptions configured")

        self.publisher = KdbPublisher(self.settings)

        feed_name = getattr(self.settings, 'alpaca_data_feed', 'sip').lower()
        feed_map = {
            'sip': DataFeed.SIP,
            'iex': DataFeed.IEX,
            'otc': getattr(DataFeed, 'OTC', DataFeed.IEX),
        }
        data_feed = feed_map.get(feed_name, DataFeed.SIP)

        stream = StockDataStream(
            api_key=self.settings.alpaca_api_key,
            secret_key=self.settings.alpaca_api_secret,
            url_override=self.settings.alpaca_stream_endpoint,
            data_feed=data_feed,
        )

        if symbols:
            stream.subscribe_trades(self._handle_trade, *symbols)
            stream.subscribe_quotes(self._handle_quote, *symbols)
            self._symbols = list(symbols)
        self.stream = stream

        self.trading_client = TradingClient(
            self.settings.alpaca_api_key,
            self.settings.alpaca_api_secret,
            paper=True,
        )

        self._running = True
        self._tasks.append(asyncio.create_task(self._run_stream()))
        self._tasks.append(asyncio.create_task(self._poll_orders()))
        self._tasks.append(asyncio.create_task(self._poll_positions()))

    async def stop(self) -> None:
        self._running = False
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()

        if self.stream is not None:
            await asyncio.to_thread(self.stream.stop)

        if self.publisher is not None:
            self.publisher.close()
            self.publisher = None

        self._symbols = []

    async def _run_stream(self) -> None:
        if self.stream is None:
            return
        try:
            await asyncio.to_thread(self.stream.run)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("Alpaca stream terminated unexpectedly: %s", exc)

    async def set_symbols(self, symbols: List[str]) -> None:
        normalized = sorted({symbol.strip().upper() for symbol in symbols if symbol.strip()})
        self.settings.alpaca_symbols = normalized

        if not self._running or self.stream is None:
            self._symbols = normalized
            return

        current = set(self._symbols)
        desired = set(normalized)

        to_remove = sorted(current - desired)
        to_add = sorted(desired - current)

        if to_remove:
            await asyncio.to_thread(self.stream.unsubscribe_trades, *to_remove)
            await asyncio.to_thread(self.stream.unsubscribe_quotes, *to_remove)

        if to_add:
            await asyncio.to_thread(self.stream.subscribe_trades, self._handle_trade, *to_add)
            await asyncio.to_thread(self.stream.subscribe_quotes, self._handle_quote, *to_add)

        self._symbols = normalized

    async def _handle_trade(self, trade) -> None:
        if self.publisher is None:
            return

        row = {
            "time": _ensure_utc(trade.timestamp),
            "sym": trade.symbol,
            "exchange": getattr(trade, "exchange", ""),
            "price": float(trade.price),
            "size": int(trade.size),
            "condition": (trade.conditions[0] if getattr(trade, "conditions", None) else "NA"),
        }
        await self.publisher.publish("trades", [row])

    async def _handle_quote(self, quote) -> None:
        if self.publisher is None:
            return

        row = {
            "time": _ensure_utc(quote.timestamp),
            "sym": quote.symbol,
            "bid": float(quote.bid_price),
            "bidSize": int(quote.bid_size),
            "ask": float(quote.ask_price),
            "askSize": int(quote.ask_size),
            "source": getattr(quote, "conditions", ["NA"])[0],
        }
        await self.publisher.publish("quotes", [row])

    async def _poll_orders(self) -> None:
        if self.trading_client is None:
            return

        while self._running:
            try:
                orders = await asyncio.to_thread(
                    self.trading_client.get_orders,
                    GetOrdersRequest(status=OrderStatus.ALL, limit=50),
                )
                rows = [
                    {
                        "time": _ensure_utc(order.created_at),
                        "sym": order.symbol,
                        "id": order.id,
                        "side": order.side.value,
                        "status": order.status.value,
                        "filledQty": int(float(order.filled_qty or 0)),
                        "remainingQty": max(
                            int(float(order.qty or 0)) - int(float(order.filled_qty or 0)),
                            0,
                        ),
                        "limitPrice": float(order.limit_price or 0),
                    }
                    for order in orders
                ]
                if rows and self.publisher is not None:
                    await self.publisher.publish("orders", rows)
            except Exception as exc:  # noqa: BLE001
                logger.exception("Failed to poll Alpaca orders: %s", exc)

            await asyncio.sleep(self.settings.alpaca_poll_interval)

    async def _poll_positions(self) -> None:
        if self.trading_client is None:
            return

        while self._running:
            try:
                positions = await asyncio.to_thread(self.trading_client.get_all_positions)
                rows = [
                    {
                        "date": datetime.now(tz=timezone.utc).date(),
                        "sym": position.symbol,
                        "qty": int(float(position.qty or 0)),
                        "avgPrice": float(position.avg_entry_price or 0),
                        "marketValue": float(position.market_value or 0),
                        "unrealizedPL": float(position.unrealized_pl or 0),
                    }
                    for position in positions
                ]
                if rows and self.publisher is not None:
                    await self.publisher.publish("positions", rows)
            except Exception as exc:  # noqa: BLE001
                logger.exception("Failed to poll Alpaca positions: %s", exc)

            await asyncio.sleep(self.settings.alpaca_poll_interval)
