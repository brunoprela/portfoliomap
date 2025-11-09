import Link from "next/link";
import { PortfolioManager } from "@/components/PortfolioManager";
import {
  fetchAlpacaStatus,
  fetchPortfolios,
  fetchProjects,
} from "@/lib/api";
import type {
  AlpacaStatus,
  PortfolioListResponse,
  Project,
} from "@/lib/api";

export default async function Home() {
  let projects: Project[] = [];
  let errorMessage: string | null = null;
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

  try {
    projects = await fetchProjects();
  } catch (error) {
    console.error("Failed to load projects", error);
    errorMessage =
      "We couldn’t reach the backend. Make sure the FastAPI server is running.";
  }

  try {
    const [portfolioResponse, statusResponse] = await Promise.all([
      fetchPortfolios(),
      fetchAlpacaStatus(),
    ]);
    portfolios = portfolioResponse;
    status = statusResponse;
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

      <PortfolioManager initialPortfolios={portfolios} initialStatus={status} />

      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-medium text-zinc-800 dark:text-zinc-100">
          Featured Projects
        </h2>

        {errorMessage ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            {errorMessage}
          </p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2">
            {projects.map((project) => (
              <li
                key={project.id}
                className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-500/40"
              >
                <div>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    {project.name}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {project.description}
                  </p>
                </div>
                <Link
                  href={project.url}
                  className="mt-auto text-sm font-medium text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  View project →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
