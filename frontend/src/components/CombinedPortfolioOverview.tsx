import type { AlpacaStatus, CombinedSnapshot } from '@/lib/api';

type CombinedSymbolAllocation = {
    symbol: string;
    allocationPercent: number;
};

type CombinedPortfolioOverviewProps = {
    snapshot: CombinedSnapshot;
    status: AlpacaStatus;
};

function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null): string {
    if (!value) {
        return "—";
    }
    try {
        return new Date(value).toLocaleDateString(undefined, { timeZone: 'UTC' });
    } catch {
        return value;
    }
}

export function CombinedPortfolioOverview({ snapshot, status }: CombinedPortfolioOverviewProps) {
    const hasPortfolios = snapshot.portfolioCount > 0;
    const symbols = Object.keys(snapshot.symbolAllocations).sort();
    const symbolAllocations: CombinedSymbolAllocation[] = symbols.map((symbol) => ({
        symbol,
        allocationPercent: snapshot.symbolAllocations[symbol] ?? 0,
    })).sort((a, b) => b.allocationPercent - a.allocationPercent);

    const displaySymbols = status.symbols.length > 0 ? status.symbols : symbols;

    return (
        <section className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <header className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                    Combined Portfolio Overview
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    All portfolios stream simultaneously into kdb+. These metrics reflect the combined view across every allocation that is currently configured.
                </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                        Feed Status
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {status.feedEnabled ? "Streaming" : "Offline"}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {status.hasCredentials ? "Credentials configured" : "Missing credentials"}
                    </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                        Portfolios
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {snapshot.portfolioCount}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Earliest start {formatDate(snapshot.earliestStartDate)}
                    </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                        Total Allocation
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatPercent(snapshot.totalAllocationPercent)}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Out of 100% paper equity
                    </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                        Global End Date
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatDate(snapshot.latestEndDate)}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Limits backfill coverage
                    </p>
                </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                    Streaming Symbols
                </p>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {displaySymbols.length > 0 ? displaySymbols.join(", ") : "None configured"}
                </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                    <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Combined Allocation by Symbol
                    </h3>
                </header>
                {hasPortfolios && symbolAllocations.length > 0 ? (
                    <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/60">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                                    Symbol
                                </th>
                                <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                                    Combined Allocation
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {symbolAllocations.map((item) => (
                                <tr key={item.symbol}>
                                    <td className="px-4 py-2 font-semibold text-zinc-900 dark:text-zinc-100">
                                        {item.symbol}
                                    </td>
                                    <td className="px-4 py-2 text-right text-zinc-700 dark:text-zinc-300">
                                        {formatPercent(item.allocationPercent)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                        Create your first portfolio to begin streaming data and populate the combined view.
                    </p>
                )}
            </div>
        </section>
    );
}

