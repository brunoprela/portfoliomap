'use client';

import { useMemo, useState } from 'react';

import type {
  Portfolio,
  PortfolioHistory,
  PortfolioHistoryPoint,
  PortfolioSnapshot,
  TickerQuote,
} from '@/lib/api';
import { fetchPortfolioHistory } from '@/lib/api';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

function formatPrice(quote: TickerQuote): string {
  if (quote.price == null) {
    return '—';
  }
  return currencyFormatter.format(quote.price);
}

function formatTimestamp(quote: TickerQuote): string {
  if (!quote.timestamp) {
    return '—';
  }
  try {
    return new Date(quote.timestamp).toLocaleString();
  } catch {
    return quote.timestamp;
  }
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  return `${Math.round(value * 100)}%`;
}

type PortfolioPerformanceChartProps = {
  history: PortfolioHistoryPoint[];
};

function PortfolioPerformanceChart({ history }: PortfolioPerformanceChartProps) {
  if (history.length < 2) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Not enough historical data to render a performance chart.
      </p>
    );
  }

  const values = history.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const points = history
    .map((point, index) => {
      const x = (index / (history.length - 1)) * 100;
      const y = 100 - ((point.value - minValue) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="portfolio-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(79, 70, 229, 0.35)" />
          <stop offset="100%" stopColor="rgba(129, 140, 248, 0.05)" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke="rgb(99, 102, 241)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <polygon
        points={`0,100 ${points} 100,100`}
        fill="url(#portfolio-chart-fill)"
        opacity={0.6}
      />
    </svg>
  );
}

type PortfolioInspectorProps = {
  portfolio: Portfolio;
  snapshot: PortfolioSnapshot;
  history: PortfolioHistory;
};

export function PortfolioInspector({ portfolio, snapshot, history }: PortfolioInspectorProps) {
  const initialSymbol = snapshot.quotes[0]?.symbol ?? portfolio.symbols[0] ?? '';
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
  const [historyState, setHistoryState] = useState<PortfolioHistory>(history);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [startDate, setStartDate] = useState(() => history.startDate.slice(0, 10));

  const historyPoints = historyState.history;

  const allocationMap = useMemo(() => {
    const weights = snapshot.portfolio.allocations ?? portfolio.allocations ?? {};
    return weights;
  }, [portfolio.allocations, snapshot.portfolio.allocations]);

  const quotesBySymbol = useMemo(() => {
    const map = new Map<string, TickerQuote>();
    snapshot.quotes.forEach((quote) => {
      map.set(quote.symbol, quote);
    });
    return map;
  }, [snapshot.quotes]);

  const selectedQuote = selectedSymbol ? quotesBySymbol.get(selectedSymbol) : undefined;

  const portfolioCurrentValue = useMemo(() => {
    return snapshot.quotes.reduce((total, quote) => {
      const weight = allocationMap?.[quote.symbol] ?? quote.weight ?? 0;
      if (quote.price == null) {
        return total;
      }
      return total + quote.price * weight;
    }, 0);
  }, [allocationMap, snapshot.quotes]);

  const totalReturn = useMemo(() => {
    if (historyPoints.length < 2) {
      return 0;
    }
    const startValue = historyPoints[0].value || 1;
    const endValue = historyPoints[historyPoints.length - 1].value || 1;
    return endValue / startValue - 1;
  }, [historyPoints]);

  const handleStartDateChange = async (value: string) => {
    setStartDate(value);
    if (!value) {
      return;
    }
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const nextHistory = await fetchPortfolioHistory(portfolio.id, value);
      setHistoryState(nextHistory);
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : 'Failed to load historical performance.',
      );
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const historyStartLabel = new Date(historyState.startDate).toLocaleDateString();
  const historyEndLabel = new Date(historyState.endDate).toLocaleDateString();

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-500 dark:text-indigo-400">
              Portfolio Overview
            </p>
            <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
              {portfolio.name}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Allocation {formatPercent(portfolio.allocationPercent)} · Symbols{' '}
              {portfolio.symbols.join(', ')}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <label className="flex flex-col items-end gap-1">
              <span className="text-xs uppercase tracking-[0.2em]">Start Date</span>
              <input
                type="date"
                value={startDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => handleStartDateChange(event.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <span>
              Current value:{' '}
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {currencyFormatter.format(portfolioCurrentValue)}
              </span>
            </span>
            <span>
              Total return:{' '}
              <span
                className={
                  totalReturn >= 0
                    ? 'font-medium text-emerald-600 dark:text-emerald-400'
                    : 'font-medium text-rose-600 dark:text-rose-400'
                }
              >
                {Math.round(totalReturn * 100)}%
              </span>
            </span>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {portfolio.symbols.map((symbol) => {
            const quote = quotesBySymbol.get(symbol) ?? {
              symbol,
              price: null,
              exchange: null,
              timestamp: null,
              conditions: null,
              weight: allocationMap?.[symbol] ?? null,
            };
            const isActive = symbol === selectedSymbol;
            const weight = allocationMap?.[symbol] ?? quote.weight ?? 0;
            return (
              <button
                key={symbol}
                type="button"
                onClick={() => setSelectedSymbol(symbol)}
                className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isActive
                    ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-500/10'
                    : 'border-zinc-200 bg-white hover:border-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-500/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    {symbol}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatPercent(weight)}
                  </span>
                </div>
                <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatPrice(quote)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {quote.exchange ?? '—'} • {formatTimestamp(quote)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Performance
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Cumulative return from {historyStartLabel} to {historyEndLabel}.
            </p>
          </div>
        </header>
        <div className="h-[260px] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          {isLoadingHistory ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading history…</p>
          ) : (
            <PortfolioPerformanceChart history={historyPoints} />
          )}
        </div>
        {historyError ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{historyError}</p>
        ) : null}
        {historyPoints.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
              <thead className="bg-zinc-50 dark:bg-zinc-900/60">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                    Index
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {historyPoints.slice(-10).map((point) => (
                  <tr key={point.date}>
                    <td className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300">
                      {new Date(point.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {(point.value * 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {selectedQuote && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <p>
            Last trade:{' '}
            <span className="font-medium text-zinc-900 dark:text-zinc-50">
              {formatPrice(selectedQuote)}
            </span>{' '}
            on {formatTimestamp(selectedQuote)}{' '}
            {selectedQuote.exchange ? `via ${selectedQuote.exchange}` : ''}
          </p>
          {selectedQuote.conditions ? (
            <p className="mt-1">Conditions: {selectedQuote.conditions.join(', ')}</p>
          ) : null}
        </section>
      )}
    </div>
  );
}
