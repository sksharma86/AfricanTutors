"use client";

import { LinkButton } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-50 text-ink-400">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.7} stroke="currentColor" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <h1 className="mt-5 font-display text-xl font-semibold text-ink-900">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-ink-500">
          We couldn&apos;t load this page right now. Please try again in a moment.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-800"
          >
            Try again
          </button>
          <LinkButton href="/dashboard/student" variant="outline" size="md">
            Back to dashboard
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
