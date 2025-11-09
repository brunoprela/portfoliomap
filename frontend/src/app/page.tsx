import { CombinedPortfolioOverview } from "@/components/CombinedPortfolioOverview";
import { CombinedPortfolioPerformance } from "@/components/CombinedPortfolioPerformance";
import { CombinedDateRangeForm } from "@/components/CombinedDateRangeForm";
import { PortfolioManager } from "@/components/PortfolioManager";
import {
  fetchAlpacaStatus,
  fetchCombinedHistory,
  fetchCombinedSnapshot,
  fetchPortfolios,
} from "@/lib/api";
import type {
  AlpacaStatus,
  CombinedHistory,
  CombinedSnapshot,
  PortfolioListResponse,
} from "@/lib/api";

export default async function Home() {
  let portfolios: PortfolioListResponse = {
    portfolios: [],
  };
  let status: AlpacaStatus = {
    feedEnabled: false,
    hasCredentials: false,
    accountId: null,
    symbols: [],
    pollIntervalSeconds: 30,
    portfolioCount: 0,
    totalAllocationPercent: 0,
  };

  let combinedSnapshot: CombinedSnapshot = {
    totalAllocationPercent: 0,
    portfolioCount: 0,
    earliestStartDate: null,
    latestEndDate: null,
    symbolAllocations: {},
    quotes: [],
  };

  let combinedHistory: CombinedHistory = {
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    history: [],
  };

  try {
    const [portfolioResponse, statusResponse, snapshotResponse, historyResponse] =
      await Promise.all([
        fetchPortfolios(),
        fetchAlpacaStatus(),
        fetchCombinedSnapshot(),
        fetchCombinedHistory(),
      ]);
    portfolios = portfolioResponse;
    status = statusResponse;
    combinedSnapshot = snapshotResponse;
    combinedHistory = historyResponse;
  } catch (error) {
    console.error("Failed to load portfolio metadata", error);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-12 bg-white px-6 py-20 font-sans text-gray-900 dark:bg-black dark:text-zinc-100 sm:px-12 lg:px-24">
      <header className="flex flex-col gap-4">
        <p className="text-sm uppercase tracking-[0.35em] text-indigo-500 dark:text-indigo-400">
          Portfolio Map
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Orchestrate Alpaca paper trades across portfolios
        </h1>
        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Spin up kdb+ tickerplant pipelines, assign allocations to different
          paper portfolios, and subscribe to symbol sets in real time—all from
          a single Alpaca account.
        </p>
      </header>

      <CombinedPortfolioOverview snapshot={combinedSnapshot} status={status} />

      <CombinedDateRangeForm
        initialStartDate={combinedSnapshot.earliestStartDate}
        initialEndDate={combinedSnapshot.latestEndDate}
      />

      <CombinedPortfolioPerformance
        history={combinedHistory}
        selectedStartDate={combinedSnapshot.earliestStartDate}
        selectedEndDate={combinedSnapshot.latestEndDate}
      />

      <PortfolioManager initialPortfolios={portfolios} />
    </main>
  );
}
