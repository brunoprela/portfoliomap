'use client';

import Link from 'next/link';

import type { CombinedHistory, CombinedSnapshot, PortfolioSetup } from '@/lib/api';

type SetupComparisonItem = {
    setup: PortfolioSetup;
    snapshot: CombinedSnapshot;
    history: CombinedHistory;
};

type SetupComparisonGridProps = {
    items: SetupComparisonItem[];
};

function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null): string {
    if (!value) {
        return '—';
    }
    try {
        return new Date(value).toLocaleDateString(undefined, { timeZone: 'UTC' });
    } catch {
        return value;
    }
}

function buildSparkline(history: CombinedHistory) {
    const points = history.history;
    if (points.length < 2) {
        return { path: '', area: '' };
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
        return { x, y };
    });

    const path = coordinates
        .map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`)
        .join(' ');
    const area = `${path} L ${padding + chartWidth} ${padding + chartHeight} L ${padding} ${padding + chartHeight} Z`;

    return { path, area };
}

export function SetupComparisonGrid({ items }: SetupComparisonGridProps) {
    if (items.length === 0) {
        return null;
    }

    return (
        <section className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <header className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                    Portfolio Setups
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Compare each setup's performance across the selected date range.
                </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map(({ setup, snapshot, history }) => {
                    const totalReturn =
                        history.history.length < 2
                            ? 0
                            : history.history[history.history.length - 1].value / history.history[0].value - 1;
                    const { path, area } = buildSparkline(history);

                    return (
                        <article
                            key={setup.id}
                            className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
                        >
                            <header className="flex items-start justify-between gap-2">
                                <div>
                                    <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                                        {setup.name}
                                    </h3>
                                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                                        {formatDate(snapshot.earliestStartDate)} – {formatDate(snapshot.latestEndDate)}
                                    </p>
                                </div>
                                <Link
                                    href={`/setups/${setup.id}`}
                                    className="text-xs font-medium text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                                >
                                    Inspect →
                                </Link>
                            </header>

                            {setup.description ? (
                                <p className="text-sm text-zinc-600 dark:text-zinc-300">{setup.description}</p>
                            ) : null}

                            <div className="flex items-baseline justify-between text-sm text-zinc-600 dark:text-zinc-300">
                                <span>Allocation:</span>
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                    {formatPercent(snapshot.totalAllocationPercent)}
                                </span>
                            </div>

                            <div className="flex items-baseline justify-between text-sm text-zinc-600 dark:text-zinc-300">
                                <span>Total return:</span>
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

                            <div className="flex items-baseline justify-between text-xs text-zinc-500 dark:text-zinc-400">
                                <span>Portfolios: {snapshot.portfolioCount}</span>
                                <span>Symbols: {Object.keys(snapshot.symbolAllocations).length}</span>
                            </div>

                            <div className="h-[90px] w-full overflow-hidden rounded-xl bg-zinc-50 p-2 dark:bg-zinc-900/60">
                                {path === '' ? (
                                    <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                                        Not enough data yet.
                                    </p>
                                ) : (
                                    <svg viewBox="0 0 192 72" preserveAspectRatio="none" className="h-full w-full">
                                        <defs>
                                            <linearGradient id={`setup-spark-${setup.id}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="rgba(79, 70, 229, 0.25)" />
                                                <stop offset="100%" stopColor="rgba(129, 140, 248, 0.05)" />
                                            </linearGradient>
                                        </defs>
                                        <path d={area} fill={`url(#setup-spark-${setup.id})`} opacity={0.8} />
                                        <path
                                            d={path}
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

