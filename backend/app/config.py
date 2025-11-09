from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import BaseModel, Field
from dotenv import load_dotenv


_DEFAULT_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_DEFAULT_ENV_PATH, override=False)
load_dotenv(override=False)


class Settings(BaseModel):
    environment: str = Field(default="local", alias="PORTFOLIOMAP_ENV")
    kdb_tp_host: str = Field(default="localhost", alias="KDB_TP_HOST")
    kdb_tp_port: int = Field(default=5010, alias="KDB_TP_PORT")
    enable_alpaca_feed: bool = Field(default=False, alias="ENABLE_ALPACA_FEED")
    alpaca_api_key: str = Field(default="", alias="ALPACA_API_KEY")
    alpaca_api_secret: str = Field(default="", alias="ALPACA_API_SECRET")
    alpaca_endpoint: str = Field(default="https://paper-api.alpaca.markets", alias="ALPACA_ENDPOINT")
    alpaca_stream_endpoint: str = Field(
        default="wss://stream.data.alpaca.markets/v2/sip", alias="ALPACA_STREAM_ENDPOINT"
    )
    alpaca_account_id: str = Field(default="", alias="ALPACA_ACCOUNT_ID")
    alpaca_data_feed: str = Field(default="sip", alias="ALPACA_DATA_FEED")
    alpaca_symbols: List[str] = Field(default_factory=list, alias="ALPACA_SYMBOLS")
    alpaca_poll_interval: int = Field(default=30, alias="ALPACA_POLL_INTERVAL")
    portfolio_store_path: str = Field(default="./q/store", alias="PORTFOLIO_STORE_PATH")

    model_config = {
        "populate_by_name": True,
        "extra": "ignore",
    }

    @property
    def kdb_tp_endpoint(self) -> tuple[str, int]:
        return self.kdb_tp_host, self.kdb_tp_port

    @property
    def has_alpaca_credentials(self) -> bool:
        return bool(self.alpaca_api_key and self.alpaca_api_secret)


@lru_cache
def get_settings() -> Settings:
    symbols_raw = os.getenv("ALPACA_SYMBOLS", "")
    symbols = [sym.strip().upper() for sym in symbols_raw.split(",") if sym.strip()]

    return Settings(
        PORTFOLIOMAP_ENV=os.getenv("PORTFOLIOMAP_ENV", "local"),
        KDB_TP_HOST=os.getenv("KDB_TP_HOST", "localhost"),
        KDB_TP_PORT=int(os.getenv("KDB_TP_PORT", "5010")),
        ENABLE_ALPACA_FEED=os.getenv("ENABLE_ALPACA_FEED", "false").lower() in {"1", "true", "yes"},
        ALPACA_API_KEY=os.getenv("ALPACA_API_KEY", ""),
        ALPACA_API_SECRET=os.getenv("ALPACA_API_SECRET", ""),
        ALPACA_ENDPOINT=os.getenv("ALPACA_ENDPOINT", "https://paper-api.alpaca.markets"),
        ALPACA_STREAM_ENDPOINT=os.getenv(
            "ALPACA_STREAM_ENDPOINT", "wss://stream.data.alpaca.markets/v2/sip"
        ),
        ALPACA_ACCOUNT_ID=os.getenv("ALPACA_ACCOUNT_ID", ""),
        ALPACA_SYMBOLS=symbols,
        ALPACA_DATA_FEED=os.getenv("ALPACA_DATA_FEED", "sip"),
        ALPACA_POLL_INTERVAL=int(os.getenv("ALPACA_POLL_INTERVAL", "30")),
        PORTFOLIO_STORE_PATH=os.getenv("PORTFOLIO_STORE_PATH", "./q/store"),
    )
