import { SetupComparisonGrid } from "@/components/SetupComparisonGrid";
import { fetchSetupHistory, fetchSetupSnapshot, fetchSetups } from "@/lib/api";
import type { CombinedHistory, CombinedSnapshot, PortfolioSetupListResponse } from "@/lib/api";

export default async function Home() {
  let setups: PortfolioSetupListResponse = { setups: [] };

  try {
    const setupsResponse = await fetchSetups();
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

    </main>
  );
}
