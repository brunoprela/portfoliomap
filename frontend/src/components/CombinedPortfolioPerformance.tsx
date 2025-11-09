'use client';

import { useMemo, useState } from 'react';

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

    const svgWidth = 720;
    const svgHeight = 320;
    const margin = { top: 20, right: 28, bottom: 36, left: 52 };
    const chartWidth = svgWidth - margin.left - margin.right;
    const chartHeight = svgHeight - margin.top - margin.bottom;

    const coordinates = useMemo(
        () =>
            historyPoints.map((point, index) => {
                const x = margin.left + (index / (historyPoints.length - 1)) * chartWidth;
                const y =
                    margin.top +
                    chartHeight -
                    ((point.value - minValue) / range) * chartHeight;
                return { x, y, point };
            }),
        [chartHeight, chartWidth, historyPoints, margin.left, margin.top, minValue, range],
    );

    const pathD = coordinates
        .map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`)
        .join(' ');
    const areaD = `${pathD} L ${margin.left + chartWidth} ${margin.top + chartHeight} L ${margin.left} ${margin.top + chartHeight} Z`;

    const firstDataDate = coordinates[0]?.point.date ?? null;
    const lastDataDate = coordinates[coordinates.length - 1]?.point.date ?? null;
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

    const xTicks = useMemo(() => {
        const desiredTicks = Math.min(6, historyPoints.length);
        const step = Math.max(1, Math.floor((historyPoints.length - 1) / (desiredTicks - 1 || 1)));
        const ticks: { index: number; label: string; x: number }[] = [];
        for (let i = 0; i < historyPoints.length; i += step) {
            const coord = coordinates[i];
            if (!coord) {
                continue;
            }
            ticks.push({ index: i, label: formatDate(historyPoints[i].date), x: coord.x });
        }
        const lastTick = coordinates[coordinates.length - 1];
        if (lastTick && ticks[ticks.length - 1]?.index !== historyPoints.length - 1) {
            const lastPoint = historyPoints[historyPoints.length - 1];
            ticks.push({ index: historyPoints.length - 1, label: formatDate(lastPoint?.date ?? null), x: lastTick.x });
        }
        return ticks;
    }, [coordinates, historyPoints]);

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
        const relativeX = Math.min(
            Math.max(svgX - margin.left, 0),
            chartWidth,
        );
        const ratio = relativeX / chartWidth;
        const index = Math.round(ratio * (coordinates.length - 1));
        setHoverIndex(index);
    };

    const handlePointerLeave = () => {
        setHoverIndex(null);
    };

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

            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                <svg
                    width="100%"
                    height="320"
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    preserveAspectRatio="none"
                    onMouseMove={handlePointerMove}
                    onMouseLeave={handlePointerLeave}
                >
                    <defs>
                        <linearGradient id="combined-chart-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(79, 70, 229, 0.25)" />
                            <stop offset="100%" stopColor="rgba(129, 140, 248, 0.05)" />
                        </linearGradient>
                    </defs>

                    {/* Axes */}
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

                    <path d={areaD} fill="url(#combined-chart-fill)" opacity={0.7} />
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
                            {formatDate(activePoint.point.date)}
                        </p>
                        <p className="text-zinc-600 dark:text-zinc-300">
                            Index {(activePoint.point.value * 100).toFixed(2)}
                        </p>
                    </div>
                ) : null}
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
                                    {formatDate(point.date)}
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

