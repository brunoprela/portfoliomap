'use client';

import type { CombinedHistory } from '@/lib/api';

type CombinedPortfolioPerformanceProps = {
    history: CombinedHistory;
    selectedStartDate: string | null;
    selectedEndDate: string | null;
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

export function CombinedPortfolioPerformance({ history, selectedStartDate, selectedEndDate }: CombinedPortfolioPerformanceProps) {
    const historyPoints = history.history;

    if (historyPoints.length < 2) {
        return (
            <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                <header>
                    <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                        Combined Performance
                    </h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Not enough data to render a performance chart yet.
                    </p>
                </header>
            </section>
        );
    }

    const values = historyPoints.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    const chartPoints = historyPoints
        .map((point, index) => {
            const x = (index / (historyPoints.length - 1)) * 100;
            const y = 100 - ((point.value - minValue) / range) * 100;
            return `${x},${y}`;
        })
        .join(' ');

    const firstDataDate = historyPoints.length > 0 ? historyPoints[0].date : null;
    const lastDataDate = historyPoints.length > 0 ? historyPoints[historyPoints.length - 1].date : null;
    const actualStartDate = firstDataDate ?? selectedStartDate ?? history.startDate;
    const actualEndDate = lastDataDate ?? selectedEndDate ?? history.endDate;

    const headerStartLabel = formatDate(actualStartDate);
    const headerEndLabel = formatDate(actualEndDate);

    const selectedStart = selectedStartDate ?? null;
    const selectedEnd = selectedEndDate ?? null;
    const selectedStartDateObj = selectedStart ? new Date(selectedStart) : null;
    const selectedEndDateObj = selectedEnd ? new Date(selectedEnd) : null;
    const actualStartObj = actualStartDate ? new Date(actualStartDate) : null;
    const actualEndObj = actualEndDate ? new Date(actualEndDate) : null;

    const dataGapAtStart =
        selectedStartDateObj && actualStartObj && actualStartObj > selectedStartDateObj;
    const dataGapAtEnd = selectedEndDateObj && actualEndObj && actualEndObj < selectedEndDateObj;

    const totalReturn =
        historyPoints.length < 2
            ? 0
            : historyPoints[historyPoints.length - 1].value / historyPoints[0].value - 1;

    return (
        <section className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <header className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                    Combined Performance
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Cumulative return from {headerStartLabel} to {headerEndLabel}.
                </p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Total return: {formatPercent(totalReturn)}
                </p>
            </header>

            {(dataGapAtStart || dataGapAtEnd) ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Data availability within selected range
                    {selectedStart ? ` ${formatDate(selectedStart)} ` : ' '}
                    {selectedStart && selectedEnd ? '– ' : ''}
                    {selectedEnd ? `${formatDate(selectedEnd)} ` : ''}
                    is currently {formatDate(firstDataDate)} – {formatDate(lastDataDate)}.
                </p>
            ) : null}

            <div className="h-[260px] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                    <defs>
                        <linearGradient id="combined-portfolio-chart-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(79, 70, 229, 0.35)" />
                            <stop offset="100%" stopColor="rgba(129, 140, 248, 0.05)" />
                        </linearGradient>
                    </defs>
                    <polyline
                        points={chartPoints}
                        fill="none"
                        stroke="rgb(99, 102, 241)"
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                    />
                    <polygon
                        points={`0,100 ${chartPoints} 100,100`}
                        fill="url(#combined-portfolio-chart-fill)"
                        opacity={0.6}
                    />
                </svg>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
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
        </section>
    );
}

