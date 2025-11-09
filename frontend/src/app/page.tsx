import { SetupComparisonGrid } from "@/components/SetupComparisonGrid";
import { SetupCreateForm } from "@/components/SetupCreateForm";
import { fetchAlpacaStatus, fetchSetupHistory, fetchSetupSnapshot, fetchSetups } from "@/lib/api";
import type { AlpacaStatus, CombinedHistory, CombinedSnapshot, PortfolioSetup, PortfolioSetupListResponse } from "@/lib/api";

export default async function Home() {
  let status: AlpacaStatus = {
    feedEnabled: false,
    hasCredentials: false,
    accountId: null,
    symbols: [],
    pollIntervalSeconds: 30,
    portfolioCount: 0,
    totalAllocationPercent: 0,
  };
  let setups: PortfolioSetupListResponse = { setups: [] };

  try {
    const [statusResponse, setupsResponse] = await Promise.all([
      fetchAlpacaStatus(),
      fetchSetups(),
    ]);
    status = statusResponse;
    setups = setupsResponse;
  } catch (error) {
    console.error('Failed to load setup metadata', error);
  }

  const comparisonData = await Promise.all(
    setups.setups.map(async (setup) => {
      let snapshot: CombinedSnapshot = {
        totalAllocationPercent: 0,
        portfolioCount: 0,
        earliestStartDate: null,
        latestEndDate: null,
        symbolAllocations: {},
        quotes: [],
      };
      let history: CombinedHistory = {
        startDate: setup.startDate,
        endDate: setup.endDate,
        history: [],
      };

      try {
        const [snapshotResponse, historyResponse] = await Promise.all([
          fetchSetupSnapshot(setup.id),
          fetchSetupHistory(setup.id),
        ]);
        snapshot = snapshotResponse;
        history = historyResponse;
      } catch (error) {
        console.error(`Failed to load aggregated data for setup ${setup.id}`, error);
      }

      return { setup, snapshot, history };
    })
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-16 bg-white px-6 py-20 font-sans text-gray-900 dark:bg-black dark:text-zinc-100 sm:px-12 lg:px-28">
      <header className="flex flex-col gap-4">
        <p className="text-3xl uppercase tracking-[0.35em] text-indigo-500 dark:text-indigo-400">
          Portfolio Map
        </p>

      </header>

      <SetupComparisonGrid items={comparisonData} />

      <SetupCreateForm />
    </main>
  );
}
