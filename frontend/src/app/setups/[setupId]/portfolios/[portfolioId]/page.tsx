import Link from "next/link";
import { notFound } from "next/navigation";

import { PortfolioInspector } from "@/components/PortfolioInspector";
import type { PortfolioHistory, PortfolioSnapshot, TickerQuote } from "@/lib/api";
import {
  fetchPortfolio,
  fetchPortfolioHistory,
  fetchPortfolioSnapshot,
  fetchSetup,
} from "@/lib/api";

type PortfolioDetailPageProps = {
  params: Promise<{ setupId: string; portfolioId: string }>;
};

export default async function PortfolioDetailPage({ params }: PortfolioDetailPageProps) {
  const resolvedParams = await params;
  const setupId = decodeURIComponent(resolvedParams.setupId ?? "");
  const portfolioId = decodeURIComponent(resolvedParams.portfolioId ?? "");

  if (!setupId || !portfolioId) {
    notFound();
  }

  try {
    await fetchSetup(setupId);
  } catch {
    notFound();
  }

  let portfolio;
  try {
    portfolio = await fetchPortfolio(setupId, portfolioId);
  } catch {
    notFound();
  }

  let snapshot: PortfolioSnapshot;
  try {
    snapshot = await fetchPortfolioSnapshot(setupId, portfolioId);
  } catch {
    const fallbackQuotes: TickerQuote[] = portfolio.symbols.map((symbol) => ({
      symbol,
      price: null,
      exchange: null,
      timestamp: null,
      conditions: null,
      weight: null,
    }));
    snapshot = {
      portfolio,
      quotes: fallbackQuotes,
    };
  }

  let history: PortfolioHistory;
  try {
    history = await fetchPortfolioHistory(setupId, portfolioId, snapshot.portfolio.startDate.slice(0, 10));
  } catch {
    history = {
      portfolio: snapshot.portfolio,
      startDate: snapshot.portfolio.startDate ?? snapshot.portfolio.createdAt,
      endDate: snapshot.portfolio.startDate ?? snapshot.portfolio.createdAt,
      history: [],
    };
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 bg-white px-6 py-16 text-zinc-900 dark:bg-black dark:text-zinc-100 sm:px-10 lg:px-14">
      <nav className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href={`/setups/${setupId}`}
          className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          ← Back to setup
        </Link>
        <span className="text-xs uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500">
          Portfolio {portfolioId}
        </span>
      </nav>

      <PortfolioInspector portfolio={snapshot.portfolio} snapshot={snapshot} history={history} />
    </main>
  );
}

