import Link from "next/link";
import { notFound } from "next/navigation";

import { CombinedPortfolioOverview } from "@/components/CombinedPortfolioOverview";
import { CombinedPortfolioPerformance } from "@/components/CombinedPortfolioPerformance";
import { PortfolioComparisonGrid } from "@/components/PortfolioComparisonGrid";
import { PortfolioManager } from "@/components/PortfolioManager";
import { SetupDateRangeForm } from "@/components/SetupDateRangeForm";
import {
  fetchAlpacaStatus,
  fetchPortfolioHistory,
  fetchPortfolios,
  fetchSetup,
  fetchSetupHistory,
  fetchSetupSnapshot,
} from "@/lib/api";
import type {
  AlpacaStatus,
  CombinedHistory,
  CombinedSnapshot,
  PortfolioHistory,
  PortfolioListResponse,
  PortfolioSetup,
} from "@/lib/api";

type SetupPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SetupPage({ params }: SetupPageProps) {
  const resolvedParams = await params;
  const setupId = decodeURIComponent(resolvedParams.id ?? "");

  if (!setupId) {
    notFound();
  }

  let status: AlpacaStatus = {
    feedEnabled: false,
    hasCredentials: false,
    accountId: null,
    symbols: [],
    pollIntervalSeconds: 30,
    portfolioCount: 0,
    totalAllocationPercent: 0,
  };
  let setup: PortfolioSetup | null = null;
  let snapshot: CombinedSnapshot | null = null;
  let history: CombinedHistory | null = null;
  let portfolios: PortfolioListResponse | null = null;

  try {
    const [statusResponse, setupResponse, snapshotResponse, historyResponse, portfoliosResponse] =
      await Promise.all([
        fetchAlpacaStatus(),
        fetchSetup(setupId),
        fetchSetupSnapshot(setupId),
        fetchSetupHistory(setupId),
        fetchPortfolios(setupId),
      ]);
    status = statusResponse;
    setup = setupResponse;
    snapshot = snapshotResponse;
    history = historyResponse;
    portfolios = portfoliosResponse;
  } catch (error) {
    console.error(`Failed to load setup ${setupId}`, error);
  }

  if (!setup || !snapshot || !history || !portfolios) {
    notFound();
  }

  const subComparisons = await Promise.all(
    portfolios.portfolios.map(async (portfolio) => {
      let portfolioHistory: PortfolioHistory = {
        portfolio,
        startDate: setup!.startDate,
        endDate: setup!.endDate,
        history: [],
      };
      try {
        portfolioHistory = await fetchPortfolioHistory(
          setupId,
          portfolio.id,
          setup.startDate.slice(0, 10),
        );
      } catch (error) {
        console.error(`Failed to load history for portfolio ${portfolio.id}`, error);
      }
      return { portfolio, history: portfolioHistory };
    }),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-16 bg-white px-6 py-16 text-zinc-900 dark:bg-black dark:text-zinc-100 sm:px-12 lg:px-28">
      <nav className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/"
          className="font-medium text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          ← Back to dashboard
        </Link>
        <span className="text-xs uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500">
          Setup {setupId}
        </span>
      </nav>

      <CombinedPortfolioOverview snapshot={snapshot} status={status} />

      <SetupDateRangeForm
        setupId={setupId}
        initialStartDate={snapshot.earliestStartDate ?? setup.startDate}
        initialEndDate={snapshot.latestEndDate ?? setup.endDate}
      />

      <CombinedPortfolioPerformance
        history={history}
        selectedStartDate={snapshot.earliestStartDate}
        selectedEndDate={snapshot.latestEndDate}
      />

      <PortfolioComparisonGrid
        items={subComparisons}
        selectedStartDate={setup.startDate}
        selectedEndDate={setup.endDate}
      />

      <PortfolioManager setupId={setupId} initialPortfolios={portfolios} />
    </main>
  );
}

