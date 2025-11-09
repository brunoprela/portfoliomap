'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { updateCombinedEndDate, updateCombinedStartDate } from '@/lib/api';

type CombinedDateRangeFormProps = {
    initialStartDate: string | null;
    initialEndDate: string | null;
};

function normalizeInput(value: string | null | undefined, fallback: string) {
    if (!value) {
        return fallback;
    }
    return value.slice(0, 10);
}

export function CombinedDateRangeForm({ initialStartDate, initialEndDate }: CombinedDateRangeFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const today = new Date().toISOString().slice(0, 10);

    const [startValue, setStartValue] = useState(() => normalizeInput(initialStartDate, today));
    const [endValue, setEndValue] = useState(() => normalizeInput(initialEndDate, today));
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!startValue || !endValue) {
            setError('Both start and end dates are required.');
            return;
        }

        const startDateObj = new Date(`${startValue}T00:00:00Z`);
        const endDateObj = new Date(`${endValue}T23:59:59Z`);
        if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
            setError('Please choose valid dates.');
            return;
        }
        if (startDateObj > endDateObj) {
            setError('Start date must be on or before the end date.');
            return;
        }

        setError(null);
        startTransition(async () => {
            try {
                if (initialStartDate?.slice(0, 10) !== startValue) {
                    await updateCombinedStartDate(`${startValue}T00:00:00Z`);
                }
                if (initialEndDate?.slice(0, 10) !== endValue) {
                    await updateCombinedEndDate(`${endValue}T23:59:59Z`);
                }
                router.refresh();
            } catch (cause) {
                const message =
                    cause instanceof Error ? cause.message : 'Failed to update date range.';
                setError(message);
            }
        });
    };

    return (
        <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Global Start Date
                    </label>
                    <input
                        type="date"
                        value={startValue}
                        max={endValue || today}
                        onChange={(event) => setStartValue(event.target.value)}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Global End Date
                    </label>
                    <input
                        type="date"
                        value={endValue}
                        min={startValue}
                        max={today}
                        onChange={(event) => setEndValue(event.target.value)}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isPending}
                    className="h-10 rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isPending ? 'Saving…' : 'Save Dates'}
                </button>
            </form>
            {error ? (
                <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
            ) : null}
        </section>
    );
}

