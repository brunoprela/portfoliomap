from __future__ import annotations

from contextlib import asynccontextmanager
import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .alpaca_feed import AlpacaFeedService
from .config import get_settings
from .portfolio_store import PortfolioStore
from .routes_portfolios import portfolios_router, setups_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings

    store_path = Path(settings.portfolio_store_path).expanduser().resolve()
    portfolio_store = PortfolioStore(store_path)
    app.state.portfolio_store = portfolio_store

    all_symbols = portfolio_store.all_symbols()
    if all_symbols:
        settings.alpaca_symbols = all_symbols

    feed = AlpacaFeedService(settings)
    app.state.alpaca_feed = feed

    try:
        await feed.start()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to start Alpaca feed: %s", exc)

    try:
        yield
    finally:
        try:
            await feed.stop()
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to stop Alpaca feed: %s", exc)


def create_app() -> FastAPI:
    app = FastAPI(title="Portfolio Map API", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(setups_router)
    app.include_router(portfolios_router)

    @app.get("/health", tags=["Health"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/alpaca/status", tags=["Alpaca"])
    async def alpaca_status(request: Request) -> dict[str, object]:
        settings = request.app.state.settings
        store = getattr(request.app.state, "portfolio_store", None)
        portfolio_count = 0
        total_allocation = 0.0
        if store is not None:
            setups = store.list_setups().setups
            for setup in setups:
                portfolio_count += store.setup_portfolio_count(setup.id)
                total_allocation += store.setup_total_allocation(setup.id)
        return {
            "feedEnabled": settings.enable_alpaca_feed,
            "hasCredentials": settings.has_alpaca_credentials,
            "accountId": settings.alpaca_account_id or None,
            "symbols": settings.alpaca_symbols,
            "pollIntervalSeconds": settings.alpaca_poll_interval,
            "portfolioCount": portfolio_count,
            "totalAllocationPercent": total_allocation,
        }

    @app.get("/api/projects", tags=["Projects"])
    async def list_projects() -> dict[str, list[dict[str, str]]]:
        return {
            "projects": [
                {
                    "id": "portfolio-map",
                    "name": "Portfolio Map",
                    "description": "Visualize skills and projects on an interactive map.",
                    "url": "https://example.com/portfolio-map",
                },
            ]
        }

    return app


app = create_app()


