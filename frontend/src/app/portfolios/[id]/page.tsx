import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PortfolioInspector } from '@/components/PortfolioInspector';
import type { PortfolioHistory, PortfolioSnapshot, TickerQuote } from '@/lib/api';
import { fetchPortfolio, fetchPortfolioHistory, fetchPortfolioSnapshot } from '@/lib/api';

type PortfolioPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ startDate?: string }>;
};

export default async function PortfolioPage({ params, searchParams }: PortfolioPageProps) {
  const resolvedParams = await params;
  const portfolioId = decodeURIComponent(resolvedParams.id ?? '');

  if (!portfolioId) {
    notFound();
  }

  const resolvedSearch = (await searchParams) ?? {};

  let portfolio;
  try {
    portfolio = await fetchPortfolio(portfolioId);
  } catch {
    notFound();
  }

  let snapshot: PortfolioSnapshot;
  try {
    snapshot = await fetchPortfolioSnapshot(portfolioId);
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

  const searchStart = resolvedSearch?.startDate;
  const portfolioStart = snapshot.portfolio.startDate ?? snapshot.portfolio.createdAt;
  const initialStartDate = (searchStart ?? portfolioStart).slice(0, 10);

  let history: PortfolioHistory;
  try {
    history = await fetchPortfolioHistory(portfolioId, initialStartDate);
  } catch {
    history = {
      portfolio: snapshot.portfolio,
      startDate: snapshot.portfolio.startDate ?? snapshot.portfolio.createdAt,
      endDate: snapshot.portfolio.startDate ?? snapshot.portfolio.createdAt,
      history: [],
    };
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-14 bg-white px-6 py-16 text-zinc-900 dark:bg-black dark:text-zinc-100 sm:px-12 lg:px-28">
      <nav className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/"
          className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          ← Back to dashboard
        </Link>
        <span className="text-xs uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500">
          Portfolio {portfolioId}
        </span>
      </nav>

      <PortfolioInspector portfolio={snapshot.portfolio} snapshot={snapshot} history={history} />
    </main>
  );
}
