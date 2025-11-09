'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { createSetup } from '@/lib/api';

export function SetupCreateForm() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const today = new Date().toISOString().slice(0, 10);
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!name.trim()) {
            setError('Setup name is required.');
            return;
        }

        const start = new Date(`${startDate}T00:00:00Z`);
        const end = new Date(`${endDate}T00:00:00Z`);
        if (start > end) {
            setError('Start date must be on or before the end date.');
            return;
        }

        setError(null);
        startTransition(async () => {
            try {
                const setup = await createSetup({
                    name: name.trim(),
                    description: description.trim() || undefined,
                    startDate: `${startDate}T00:00:00Z`,
                    endDate: `${endDate}T23:59:59Z`,
                });
                setName('');
                setDescription('');
                router.refresh();
                router.push(`/setups/${setup.id}`);
            } catch (cause) {
                const message =
                    cause instanceof Error ? cause.message : 'Failed to create setup.';
                setError(message);
            }
        });
    };

    return (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                    Create Portfolio Setup
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Name
                        <input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Global Equity Allocation"
                            required
                            disabled={isPending}
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Start Date
                        <input
                            type="date"
                            value={startDate}
                            max={endDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            disabled={isPending}
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        End Date
                        <input
                            type="date"
                            value={endDate}
                            min={startDate}
                            max={today}
                            onChange={(event) => setEndDate(event.target.value)}
                            disabled={isPending}
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                    </label>
                </div>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Description
                    <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Optional description"
                        disabled={isPending}
                        className="min-h-[80px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                </label>
                {error ? (
                    <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
                ) : null}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isPending}
                        className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isPending ? 'Creating…' : 'Create Setup'}
                    </button>
                </div>
            </form>
        </section>
    );
}

