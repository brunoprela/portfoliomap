# Portfolio kdb+ Processes

This directory contains self-contained q scripts that follow the tickerplant → real-time database (RDB) → historical database (HDB) architecture used throughout the PyKX examples.

## Directory Layout

- `scripts/config.q` – shared port assignments and filesystem paths.
- `scripts/schema.q` – canonical table definitions for trades, quotes, orders, and positions.
- `scripts/tickerplant.q` – tickerplant accepting `.u.upd` publishes and fanning out to subscribers while logging intraday updates.
- `scripts/rdb.q` – real-time database that subscribes to the tickerplant and snapshots end-of-day partitions into `../hdb`.
- `store/` – lightweight kdb+ tables written by the FastAPI service for portfolio metadata (`portfolios`, `portfolio_symbols`, `portfolio_state`).

## Quickstart

1. Start the tickerplant:
   ```bash
   q scripts/tickerplant.q -p 5010
   ```
2. Start the real-time database:
   ```bash
   q scripts/rdb.q -p 5011
   ```
3. (Optional) start additional analytics processes that subscribe via `.u.sub`.

The Python Alpaca bridge in `backend/app/alpaca_feed.py` publishes into the tickerplant using the `.u.upd` entry point.

All intraday logs are written to `q/log/`, daily partitions are created under `q/hdb/YYYY.MM.DD/`, and long-lived portfolio definitions live in `q/store/`.
