'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type {
    AlpacaStatus,
    Portfolio,
    PortfolioListResponse,
    PortfolioPayload,
} from '@/lib/api';
import { createPortfolio, deletePortfolio, updatePortfolio } from '@/lib/api';

function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

function parseSymbols(input: string): string[] {
    return input
        .split(',')
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean);
}

const todayISO = new Date().toISOString().slice(0, 10);

type PortfolioFormState = {
    name: string;
    description: string;
    symbols: string;
    allocationPercent: string;
    startDate: string;
    allocations: Record<string, string>;
};

const defaultFormState: PortfolioFormState = {
    name: '',
    description: '',
    symbols: '',
    allocationPercent: '10',
    startDate: todayISO,
    allocations: {},
};

function coerceAllocation(value: string): number {
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed) || parsed < 0) {
        return 0;
    }
    return Math.min(parsed, 100);
}

function portfolioToForm(portfolio: Portfolio): PortfolioFormState {
    const allocations: Record<string, string> = {};
    const symbols = portfolio.symbols;
    const weights = portfolio.allocations ?? {};
    const fallbackWeight = symbols.length ? 1 / symbols.length : 0;
    symbols.forEach((symbol) => {
        const weight = weights?.[symbol] ?? fallbackWeight;
        const percent = weight * 100;
        allocations[symbol] = percent.toFixed(2);
    });
    const startDate = (portfolio.startDate ?? portfolio.createdAt).slice(0, 10);
    return {
        name: portfolio.name,
        description: portfolio.description ?? '',
        symbols: symbols.join(', '),
        allocationPercent: (portfolio.allocationPercent * 100).toString(),
        startDate,
        allocations,
    };
}

type PortfolioManagerProps = {
    initialPortfolios: PortfolioListResponse;
    initialStatus: AlpacaStatus;
};

export function PortfolioManager({
    initialPortfolios,
    initialStatus,
}: PortfolioManagerProps) {
    const [portfolios, setPortfolios] = useState<Portfolio[]>(
        initialPortfolios.portfolios,
    );
    const [status, setStatus] = useState<AlpacaStatus>(initialStatus);
    const [formState, setFormState] = useState<PortfolioFormState>(
        defaultFormState,
    );
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const totalAllocation = useMemo(
        () => portfolios.reduce((sum, portfolio) => sum + (portfolio.allocationPercent ?? 0), 0),
        [portfolios],
    );

    const streamingSymbols = useMemo(() => {
        const set = new Set<string>();
        portfolios.forEach((portfolio) => {
            portfolio.symbols.forEach((symbol) => set.add(symbol));
        });
        return Array.from(set).sort();
    }, [portfolios]);

    const portfolioCount = portfolios.length;

    useEffect(() => {
        setStatus((current) => {
            const currentSymbols = current.symbols ?? [];
            const sameSymbols =
                currentSymbols.length === streamingSymbols.length &&
                currentSymbols.every((symbol, index) => symbol === streamingSymbols[index]);
            const sameTotal =
                Math.abs((current.totalAllocationPercent ?? 0) - totalAllocation) < 1e-9;
            const sameCount = current.portfolioCount === portfolioCount;
            if (sameSymbols && sameTotal && sameCount) {
                return current;
            }
            return {
                ...current,
                symbols: streamingSymbols,
                totalAllocationPercent: totalAllocation,
                portfolioCount,
            };
        });
    }, [streamingSymbols, totalAllocation, portfolioCount]);

    const parsedSymbols = useMemo(
        () => parseSymbols(formState.symbols),
        [formState.symbols],
    );
    const allocationSum = parsedSymbols.reduce((sum, symbol) => {
        const raw = formState.allocations[symbol];
        const value = raw ? Number.parseFloat(raw) : 0;
        return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const allocationWarning = allocationSum <= 0 || allocationSum > 100.0001;

    const resetForm = () => {
        const freshStartDate = new Date().toISOString().slice(0, 10);
        setFormState({
            ...defaultFormState,
            startDate: freshStartDate,
            allocations: {},
        });
        setEditingId(null);
        setError(null);
    };

    const handleChange = (field: keyof PortfolioFormState, value: string) => {
        if (field === 'allocationPercent') {
            const sanitized = value.replace(/[^0-9.]/g, '');
            setFormState((current) => ({ ...current, allocationPercent: sanitized }));
            return;
        }

        if (field === 'symbols') {
            const nextSymbols = parseSymbols(value);
            setFormState((current) => {
                const existing = current.allocations;
                const fallback = nextSymbols.length ? (100 / nextSymbols.length).toFixed(2) : '0';
                const nextAllocations: Record<string, string> = {};
                nextSymbols.forEach((symbol) => {
                    nextAllocations[symbol] = existing[symbol] ?? fallback;
                });
                return {
                    ...current,
                    symbols: value,
                    allocations: nextAllocations,
                };
            });
            return;
        }

        if (field === 'startDate') {
            setFormState((current) => ({ ...current, startDate: value }));
            return;
        }

        setFormState((current) => ({ ...current, [field]: value }));
    };

    const handleAllocationChange = (symbol: string, value: string) => {
        const sanitized = value.replace(/[^0-9.]/g, '');
        setFormState((current) => ({
            ...current,
            allocations: {
                ...current.allocations,
                [symbol]: sanitized,
            },
        }));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const allocationPercent = coerceAllocation(formState.allocationPercent);
            const symbols = parseSymbols(formState.symbols);

            if (symbols.length === 0) {
                throw new Error('Please provide at least one symbol');
            }

            const allocationEntries = symbols.map((symbol) => {
                const raw = formState.allocations[symbol];
                const percent = raw ? parseFloat(raw) : 0;
                return { symbol, percent: Number.isFinite(percent) ? percent : 0 };
            });

            const totalPercent = allocationEntries.reduce((sum, entry) => sum + entry.percent, 0);
            if (totalPercent <= 0) {
                throw new Error('Allocation percentages must sum to a positive value.');
            }

            const normalizedAllocations: Record<string, number> = {};
            allocationEntries.forEach(({ symbol, percent }) => {
                const normalized = percent <= 0 ? 0 : percent / totalPercent;
                normalizedAllocations[symbol] = parseFloat(normalized.toFixed(6));
            });

            const startDateIso = formState.startDate
                ? new Date(`${formState.startDate}T00:00:00Z`).toISOString()
                : undefined;

            const payload: PortfolioPayload = {
                name: formState.name.trim(),
                description: formState.description.trim() || undefined,
                symbols,
                allocation_percent: allocationPercent / 100,
                start_date: startDateIso,
                allocations: normalizedAllocations,
            };

            if (!payload.name) {
                throw new Error('Portfolio name is required');
            }

            if (editingId) {
                const updated = await updatePortfolio(editingId, payload);
                setPortfolios((current) =>
                    current.map((portfolio) =>
                        portfolio.id === editingId ? updated : portfolio,
                    ),
                );
            } else {
                const created = await createPortfolio(payload);
                setPortfolios((current) => [...current, created]);
            }

            resetForm();
        } catch (cause) {
            const message =
                cause instanceof Error ? cause.message : 'Unexpected error occurred';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };


    const handleEdit = (portfolio: Portfolio) => {
        setEditingId(portfolio.id);
        setFormState(portfolioToForm(portfolio));
        setError(null);
    };

    const handleDelete = async (portfolioId: string) => {
        if (!window.confirm('Delete this portfolio? This cannot be undone.')) {
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            await deletePortfolio(portfolioId);
            setPortfolios((current) =>
                current.filter((portfolio) => portfolio.id !== portfolioId),
            );
        } catch (cause) {
            const message =
                cause instanceof Error ? cause.message : 'Unexpected error occurred';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="flex flex-col gap-6">
            <header className="flex flex-col gap-2">
                <h2 className="text-2xl font-medium text-zinc-800 dark:text-zinc-100">
                    Portfolio Manager
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Configure virtual portfolios to divide your Alpaca paper account.
                    Every portfolio you create streams simultaneously into kdb+ and shares
                    the same paper buying power, so pay attention to the combined
                    allocation across all of them.
                </p>
                <div className="flex flex-wrap gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div>
                        <span className="text-zinc-500 dark:text-zinc-400">Feed Status:</span>{' '}
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {status.feedEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                    <div>
                        <span className="text-zinc-500 dark:text-zinc-400">Portfolios:</span>{' '}
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {portfolioCount}
                        </span>
                    </div>
                    <div>
                        <span className="text-zinc-500 dark:text-zinc-400">Total Allocation:</span>{' '}
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {formatPercent(totalAllocation)}
                        </span>
                    </div>
                    <div>
                        <span className="text-zinc-500 dark:text-zinc-400">Streaming Symbols:</span>{' '}
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {streamingSymbols.length > 0 ? streamingSymbols.join(', ') : 'None'}
                        </span>
                    </div>
                </div>
            </header>

            <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {editingId ? 'Update Portfolio' : 'Create Portfolio'}
                </h3>
                {error ? (
                    <p className="rounded border border-rose-300 bg-rose-100/60 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                        {error}
                    </p>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Name
                        <input
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            value={formState.name}
                            onChange={(event) => handleChange('name', event.target.value)}
                            placeholder="Growth Portfolio"
                            required
                            disabled={submitting}
                        />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Start Date
                        <input
                            type="date"
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            value={formState.startDate}
                            onChange={(event) => handleChange('startDate', event.target.value)}
                            max={todayISO}
                            disabled={submitting}
                        />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Allocation (%)
                        <input
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            value={formState.allocationPercent}
                            onChange={(event) => handleChange('allocationPercent', event.target.value)}
                            placeholder="25"
                            required
                            disabled={submitting}
                            inputMode="decimal"
                        />
                    </label>
                </div>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Description
                    <textarea
                        className="min-h-[80px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        value={formState.description}
                        onChange={(event) => handleChange('description', event.target.value)}
                        placeholder="High conviction tech names"
                        disabled={submitting}
                    />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Symbols (comma separated)
                    <input
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        value={formState.symbols}
                        onChange={(event) => handleChange('symbols', event.target.value)}
                        placeholder="AAPL, MSFT, NVDA"
                        disabled={submitting}
                    />
                </label>
                {parsedSymbols.length > 0 ? (
                    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Symbol allocations (%)</span>
                            <span
                                className={`text-xs ${allocationWarning ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400'}`}
                            >
                                Total: {allocationSum.toFixed(2)}% (normalized automatically)
                            </span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {parsedSymbols.map((symbol) => (
                                <label
                                    key={symbol}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                                >
                                    <span>{symbol}</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.1}
                                        value={formState.allocations[symbol] ?? ''}
                                        onChange={(event) => handleAllocationChange(symbol, event.target.value)}
                                        className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                                        disabled={submitting}
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                ) : null}
                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={submitting}
                    >
                        {editingId ? 'Save Changes' : 'Create Portfolio'}
                    </button>
                    {editingId ? (
                        <button
                            type="button"
                            onClick={resetForm}
                            className="text-sm font-medium text-zinc-600 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                    ) : null}
                </div>
            </form>

            <div className="flex flex-col gap-3">
                {portfolios.length === 0 ? (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        No portfolios yet. Create one above to start routing Alpaca data.
                    </p>
                ) : (
                    portfolios.map((portfolio) => {
                        return (
                            <article
                                key={portfolio.id}
                                className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
                            >
                                <header className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h4 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                                            {portfolio.name}
                                        </h4>
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                            Allocation {formatPercent(portfolio.allocationPercent)}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Link
                                            href={`/portfolios/${portfolio.id}`}
                                            className="rounded-full border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                                        >
                                            Inspect
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => handleEdit(portfolio)}
                                            className="rounded-full border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                                            disabled={submitting}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(portfolio.id)}
                                            className="rounded-full border border-rose-200 px-3 py-1 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/50"
                                            disabled={submitting}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </header>
                                {portfolio.description ? (
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                        {portfolio.description}
                                    </p>
                                ) : null}
                                <div className="flex flex-wrap gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                                    {portfolio.symbols.map((symbol) => {
                                        const weight = portfolio.allocations?.[symbol] ?? (portfolio.symbols.length ? 1 / portfolio.symbols.length : 0);
                                        return (
                                            <span
                                                key={`${portfolio.id}-${symbol}`}
                                                className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                                            >
                                                {symbol} · {formatPercent(weight)}
                                            </span>
                                        );
                                    })}
                                </div>
                            </article>
                        );
                    })
                )}
            </div>
        </section>
    );
}
