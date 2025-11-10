'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import type { CombinedHistory, CombinedSnapshot, PortfolioSetup } from '@/lib/api';
import { SetupCreateForm } from '@/components/SetupCreateForm';
import { deleteSetup } from '@/lib/api';

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

    const width = 200;
    const height = 100;
    const padding = 12;
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
    const [showCreate, setShowCreate] = useState(false);
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    return (
        <section className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <header className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                            Portfolio Setups
                        </h2>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Compare each setup's performance across the selected date range.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowCreate((value) => !value)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-200 text-2xl font-semibold text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:border-indigo-400 dark:hover:bg-indigo-500/10"
                        aria-expanded={showCreate}
                        aria-label={showCreate ? 'Hide create setup form' : 'Show create setup form'}
                    >
                        {showCreate ? '–' : '+'}
                    </button>
                </div>
                {showCreate ? (
                    <div>
                        <SetupCreateForm />
                    </div>
                ) : null}
            </header>

            {items.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    No portfolio setups yet. Use the “+” button to create your first setup.
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {items.map(({ setup, snapshot, history }) => {
                        const totalReturn =
                            history.history.length < 2
                                ? 0
                                : history.history[history.history.length - 1].value /
                                      history.history[0].value -
                                      1;
                        const { path, area } = buildSparkline(history);

                        return (
                            <li
                                key={setup.id}
                                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                                            {setup.name}
                                        </h3>
                                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                                            {formatDate(snapshot.earliestStartDate)} – {formatDate(snapshot.latestEndDate)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!window.confirm(`Delete setup "${setup.name}"? This cannot be undone.`)) {
                                                    return;
                                                }
                                                startTransition(async () => {
                                                    try {
                                                        await deleteSetup(setup.id);
                                                        router.refresh();
                                                    } catch (error) {
                                                        console.error('Failed to delete setup', error);
                                                    }
                                                });
                                            }}
                                            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                                            disabled={isPending}
                                        >
                                            Delete
                                        </button>
                                        <Link
                                            href={`/setups/${setup.id}`}
                                            className="rounded-full border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                                        >
                                            Inspect →
                                        </Link>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div className="flex flex-col gap-3">
                                        {setup.description ? (
                                            <p className="text-sm text-zinc-600 dark:text-zinc-300">{setup.description}</p>
                                        ) : null}
                                        <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600 dark:text-zinc-300">
                                            <span className="flex items-baseline gap-1">
                                                <span className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                                                    Allocation
                                                </span>
                                                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                                    {formatPercent(snapshot.totalAllocationPercent)}
                                                </span>
                                            </span>
                                            <span className="flex items-baseline gap-1">
                                                <span className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                                                    Total return
                                                </span>
                                                <span
                                                    className={
                                                        totalReturn >= 0
                                                            ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                                                            : 'font-semibold text-rose-600 dark:text-rose-400'
                                                    }
                                                >
                                                    {formatPercent(totalReturn)}
                                                </span>
                                            </span>
                                            <span className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                                                Portfolios {snapshot.portfolioCount}
                                            </span>
                                            <span className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                                                Symbols {Object.keys(snapshot.symbolAllocations).length}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="h-[90px] md:h-[100px] md:w-56">
                                        <div className="h-full w-full overflow-hidden rounded-xl bg-zinc-50 p-2 dark:bg-zinc-900/60">
                                            {path === '' ? (
                                                <p className="flex h-full items-center justify-center text-xs text-zinc-500 dark:text-zinc-400">
                                                    Not enough data yet.
                                                </p>
                                            ) : (
                                                <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="h-full w-full">
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
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}