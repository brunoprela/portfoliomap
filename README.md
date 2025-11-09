# Portfolio Map Monorepo

This repository contains a Next.js frontend and a FastAPI backend for building an interactive portfolio experience.

## Project Layout

- `frontend/` — Next.js 14 App Router project written in TypeScript.
- `backend/` — FastAPI application served with Uvicorn.

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.12+

### Backend

```bash
cd /Users/bruno/Developer/portfoliomap/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

The backend will listen on `http://127.0.0.1:8000` and, when enabled, will start the Alpaca → kdb+ streaming bridge during application startup. Portfolio definitions and allocation metadata are persisted as kdb+ tables under `backend/q/store/` (configurable via `PORTFOLIO_STORE_PATH`).

### kdb+ Tickerplant Stack

The canonical q scripts live in `backend/q/scripts`. They follow the tickerplant → RDB → HDB pattern used by the PyKX examples while keeping all changes scoped to this repository.

Run the stack in separate shells:

```bash
cd /Users/bruno/Developer/portfoliomap/backend/q
q scripts/tickerplant.q -p 5010
q scripts/rdb.q -p 5011
```

Historical partitions are written to `backend/q/hdb/YYYY.MM.DD/`, intraday logs to `backend/q/log/`, and long-lived portfolio metadata to `backend/q/store/`.

### Alpaca Integration

Copy `.env.example` to `.env` (or export the variables) and provide **your own** Alpaca paper credentials. Do not commit secrets.

```bash
cd /Users/bruno/Developer/portfoliomap/backend
cp .env.example .env
```

Key variables:

- `ENABLE_ALPACA_FEED=true` to start the bridge.
- `ALPACA_API_KEY` / `ALPACA_API_SECRET` for authentication.
- `PORTFOLIO_STORE_PATH` to control where the kdb+ portfolio tables are written (defaults to `./q/store`).

When the FastAPI server starts with the feed enabled, it connects to the tickerplant and publishes trades, quotes, orders, and positions sourced from Alpaca. The `/api/alpaca/status` endpoint exposes lightweight diagnostics, including which portfolio is active and its allocation of the single paper account.

### Frontend

```bash
cd /Users/bruno/Developer/portfoliomap/frontend
cp .env.local.example .env.local  # adjust the API URL if needed
npm install
npm run dev
```

Visit `http://localhost:3000` to load the Next.js app. The homepage now includes a live portfolio manager that lets you:

- Create paper portfolios with dedicated symbol sets and allocation percentages that sum to 100% of the Alpaca account.
- Activate a portfolio to switch the real-time subscriptions flowing into kdb+.
- Persist those definitions into the kdb+ store for cross-process access.

If the backend is unavailable, the UI surfaces a friendly warning for both the portfolio manager and the demo projects.


