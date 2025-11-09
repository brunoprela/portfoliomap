'use client';
import { useMemo, useState } from 'react';


import type {
  Portfolio,
  PortfolioHistory,
  PortfolioSnapshot,
  TickerQuote,
} from '@/lib/api';

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

function formatDateUTC(value: string): string {
  try {
    return new Date(value).toLocaleDateString(undefined, { timeZone: 'UTC' });
  } catch {
    return value;
  }
}

type InteractivePortfolioChartProps = {
  history: PortfolioHistory;
};

function InteractivePortfolioChart({ history }: InteractivePortfolioChartProps) {
  const points = history.history;
  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const svgWidth = 720;
  const svgHeight = 320;
  const margin = { top: 20, right: 28, bottom: 36, left: 52 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  const coordinates = useMemo(
    () =>
      points.length === 0
        ? []
        : points.map((point, index) => {
          const denominator = Math.max(points.length - 1, 1);
          const x = margin.left + (index / denominator) * chartWidth;
          const y =
            margin.top +
            chartHeight -
            ((point.value - minValue) / range) * chartHeight;
          return { x, y, point };
        }),
    [chartHeight, chartWidth, points, margin.left, margin.top, minValue, range],
  );

  const pathD = coordinates.length
    ? coordinates.map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`).join(' ')
    : '';
  const areaD = coordinates.length
    ? `${pathD} L ${margin.left + chartWidth} ${margin.top + chartHeight} L ${margin.left} ${margin.top + chartHeight} Z`
    : '';

  const xTicks = useMemo(() => {
    if (points.length === 0) {
      return [];
    }
    const desiredTicks = Math.min(6, points.length);
    const step = Math.max(1, Math.floor((points.length - 1) / (desiredTicks - 1 || 1)));
    const ticks: { index: number; label: string; x: number }[] = [];
    for (let i = 0; i < points.length; i += step) {
      const coord = coordinates[i];
      if (!coord) {
        continue;
      }
      ticks.push({ index: i, label: formatDateUTC(points[i].date), x: coord.x });
    }
    const lastCoord = coordinates[coordinates.length - 1];
    if (lastCoord && ticks[ticks.length - 1]?.index !== points.length - 1) {
      const lastPoint = points[points.length - 1];
      ticks.push({ index: points.length - 1, label: formatDateUTC(lastPoint.date), x: lastCoord.x });
    }
    return ticks;
  }, [coordinates, points]);

  const yTicks = useMemo(() => {
    const divisions = 4;
    const ticks: { value: number; y: number }[] = [];
    for (let i = 0; i <= divisions; i += 1) {
      const value = minValue + (range * i) / divisions;
      const y = margin.top + chartHeight - ((value - minValue) / range) * chartHeight;
      ticks.push({ value, y });
    }
    return ticks;
  }, [chartHeight, margin.top, minValue, range]);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const activePoint = hoverIndex != null ? coordinates[hoverIndex] : null;

  const handlePointerMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * svgWidth;
    const relativeX = Math.min(Math.max(svgX - margin.left, 0), chartWidth);
    const ratio = relativeX / chartWidth;
    const index = Math.round(ratio * (coordinates.length - 1));
    setHoverIndex(index);
  };

  const handlePointerLeave = () => setHoverIndex(null);

  if (coordinates.length < 2) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-zinc-500 dark:text-zinc-400">
        Not enough historical data to render a performance chart.
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <svg
        width="100%"
        height="320"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="none"
        onMouseMove={handlePointerMove}
        onMouseLeave={handlePointerLeave}
      >
        <defs>
          <linearGradient id="portfolio-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(79, 70, 229, 0.25)" />
            <stop offset="100%" stopColor="rgba(129, 140, 248, 0.05)" />
          </linearGradient>
        </defs>

        <line
          x1={margin.left}
          y1={margin.top + chartHeight}
          x2={margin.left + chartWidth}
          y2={margin.top + chartHeight}
          stroke="rgb(228, 228, 231)"
          strokeWidth={1}
        />
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + chartHeight}
          stroke="rgb(228, 228, 231)"
          strokeWidth={1}
        />

        {xTicks.map((tick) => (
          <g key={`x-${tick.index}`}>
            <line
              x1={tick.x}
              y1={margin.top + chartHeight}
              x2={tick.x}
              y2={margin.top + chartHeight + 6}
              stroke="rgb(161, 161, 170)"
              strokeWidth={1}
            />
            <text
              x={tick.x}
              y={margin.top + chartHeight + 24}
              textAnchor="middle"
              className="fill-zinc-500 text-[11px]"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {yTicks.map((tick, index) => (
          <g key={`y-${index}`}>
            <line
              x1={margin.left - 6}
              y1={tick.y}
              x2={margin.left + chartWidth}
              y2={tick.y}
              stroke="rgba(212, 212, 216, 0.4)"
              strokeWidth={index === 0 ? 1.5 : 1}
              strokeDasharray={index === 0 ? '0' : '4 6'}
            />
            <text
              x={margin.left - 12}
              y={tick.y + 4}
              textAnchor="end"
              className="fill-zinc-500 text-[11px]"
            >
              {(tick.value * 100).toFixed(0)}
            </text>
          </g>
        ))}

        <path d={areaD} fill="url(#portfolio-chart-fill)" opacity={0.7} />
        <path
          d={pathD}
          fill="none"
          stroke="rgb(79, 70, 229)"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {activePoint ? (
          <g>
            <line
              x1={activePoint.x}
              y1={margin.top}
              x2={activePoint.x}
              y2={margin.top + chartHeight}
              stroke="rgba(79, 70, 229, 0.35)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r={4}
              fill="rgb(79, 70, 229)"
              stroke="#fff"
              strokeWidth={1.5}
            />
          </g>
        ) : null}
      </svg>

      {activePoint ? (
        <div
          className="pointer-events-none absolute top-4 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          style={{ left: `${(activePoint.x / svgWidth) * 100}%` }}
        >
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatDateUTC(activePoint.point.date)}
          </p>
          <p className="text-zinc-600 dark:text-zinc-300">
            Index {(activePoint.point.value * 100).toFixed(2)}
          </p>
        </div>
      ) : null}
    </div>
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
  const historyPoints = history.history;

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

  const historyStartLabel = formatDateUTC(history.startDate);
  const historyEndLabel = formatDateUTC(history.endDate);
  const dataStartDate = historyPoints.length > 0 ? historyPoints[0].date : null;
  const dataEndDate = historyPoints.length > 0 ? historyPoints[historyPoints.length - 1].date : null;
  const dataGapAtStart = dataStartDate && new Date(dataStartDate) > new Date(history.startDate);
  const dataGapAtEnd = dataEndDate && new Date(dataEndDate) < new Date(history.endDate);

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
          <div className="flex flex-col items-end gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-left sm:grid-cols-4">
              <div className="col-span-1">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  Global Start
                </p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatDateUTC(history.startDate)}
                </p>
              </div>
              <div className="col-span-1">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  Global End
                </p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatDateUTC(history.endDate)}
                </p>
              </div>
              <div className="col-span-1">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  Current Value
                </p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {currencyFormatter.format(portfolioCurrentValue)}
                </p>
              </div>
              <div className="col-span-1">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  Total Return
                </p>
                <p
                  className={
                    totalReturn >= 0
                      ? 'font-medium text-emerald-600 dark:text-emerald-400'
                      : 'font-medium text-rose-600 dark:text-rose-400'
                  }
                >
                  {Math.round(totalReturn * 100)}%
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Date range managed globally from the dashboard.
            </p>
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
                className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isActive
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
        {(dataGapAtStart || dataGapAtEnd) ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Data availability is currently {formatDateUTC(dataStartDate ?? history.startDate)} –{' '}
            {formatDateUTC(dataEndDate ?? history.endDate)}.
          </p>
        ) : null}
        <div className="h-[320px] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <InteractivePortfolioChart history={history} />
        </div>
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
                      {formatDateUTC(point.date)}
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
