'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import type { Portfolio, PortfolioHistory } from '@/lib/api';

type PortfolioComparisonItem = {
    portfolio: Portfolio;
    history: PortfolioHistory;
};

type PortfolioComparisonGridProps = {
    items: PortfolioComparisonItem[];
    selectedStartDate: string | null;
    selectedEndDate: string | null;
};

function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

function formatDateUTC(value: string | null): string {
    if (!value) {
        return '—';
    }
    try {
        return new Date(value).toLocaleDateString(undefined, { timeZone: 'UTC' });
    } catch {
        return value;
    }
}

function buildSparklinePath(history: PortfolioHistory) {
    const points = history.history;
    if (points.length < 2) {
        return { path: '', area: '', coordinates: [] as { x: number; y: number; value: number }[] };
    }
    const values = points.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    const width = 180;
    const height = 60;
    const padding = 6;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const coordinates = points.map((point, index) => {
        const x = padding + (index / (points.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((point.value - minValue) / range) * chartHeight;
        return { x, y, value: point.value };
    });

    const path = coordinates
        .map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`)
        .join(' ');
    const area = `${path} L ${padding + chartWidth} ${padding + chartHeight} L ${padding} ${padding + chartHeight} Z`;

    return { path, area, coordinates };
}

export function PortfolioComparisonGrid({ items, selectedStartDate, selectedEndDate }: PortfolioComparisonGridProps) {
    const computed = useMemo(() => {
        return items.map(({ portfolio, history }) => {
            const points = history.history;
            const totalReturn =
                points.length < 2
                    ? 0
                    : points[points.length - 1].value / points[0].value - 1;
            const { path, area } = buildSparklinePath(history);
            const dataStartDate = points.length > 0 ? points[0].date : history.startDate;
            const dataEndDate = points.length > 0 ? points[points.length - 1].date : history.endDate;
            return {
                portfolio,
                history,
                totalReturn,
                sparklinePath: path,
                sparklineArea: area,
                dataStartDate,
                dataEndDate,
            };
        });
    }, [items]);

    if (computed.length === 0) {
        return null;
    }

    return (
        <section className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <header className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                    Portfolio Comparison
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Performance for each portfolio setup across the selected global date range.
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Global range {formatDateUTC(selectedStartDate)} – {formatDateUTC(selectedEndDate)}.
                </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {computed.map(({ portfolio, totalReturn, sparklinePath, sparklineArea, dataStartDate, dataEndDate }) => {
                    return (
                        <article
                            key={portfolio.id}
                            className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
                        >
                            <header className="flex items-start justify-between gap-2">
                                <div>
                                    <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                                        {portfolio.name}
                                    </h3>
                                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                                        Allocation {formatPercent(portfolio.allocationPercent)}
                                    </p>
                                </div>
                                <Link
                                    href={`/portfolios/${portfolio.id}`}
                                    className="text-xs font-medium text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                                >
                                    Inspect →
                                </Link>
                            </header>

                            <div className="flex items-baseline justify-between text-sm text-zinc-600 dark:text-zinc-300">
                                <span>Return:</span>
                                <span
                                    className={
                                        totalReturn >= 0
                                            ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                                            : 'font-semibold text-rose-600 dark:text-rose-400'
                                    }
                                >
                                    {formatPercent(totalReturn)}
                                </span>
                            </div>

                            <div className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                                <span>
                                    Data coverage {formatDateUTC(dataStartDate)} – {formatDateUTC(dataEndDate)}
                                </span>
                                <span>Symbols: {portfolio.symbols.join(', ') || '—'}</span>
                            </div>

                            <div className="h-[90px] w-full overflow-hidden rounded-xl bg-zinc-50 p-2 dark:bg-zinc-900/60">
                                {sparklinePath === '' ? (
                                    <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                                        Not enough data yet.
                                    </p>
                                ) : (
                                    <svg viewBox="0 0 192 72" preserveAspectRatio="none" className="h-full w-full">
                                        <defs>
                                            <linearGradient id={`spark-${portfolio.id}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="rgba(79, 70, 229, 0.25)" />
                                                <stop offset="100%" stopColor="rgba(129, 140, 248, 0.05)" />
                                            </linearGradient>
                                        </defs>
                                        <path d={sparklineArea} fill={`url(#spark-${portfolio.id})`} opacity={0.8} />
                                        <path
                                            d={sparklinePath}
                                            fill="none"
                                            stroke="rgb(79, 70, 229)"
                                            strokeWidth={1.6}
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

