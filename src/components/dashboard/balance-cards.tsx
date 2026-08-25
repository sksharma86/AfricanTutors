import Link from "next/link";

import { Card } from "@/components/ui/card";
import { formatDuration, formatMoneyCents } from "@/lib/format.mjs";

/**
 * Human-readable Study Hall hours and account credit.
 * Customer-facing label is "Study Hall Hours" (internal fields unchanged).
 */
export function BalanceCards({
  minutes,
  creditCents,
}: {
  minutes: number;
  creditCents: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-5">
        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Study Hall Hours</p>
        <p className="mt-2 font-display text-3xl font-semibold text-ink-900">
          {minutes > 0 ? (
            <>
              {formatDuration(minutes)}
              <span className="mt-1 block text-base font-medium text-ink-500">remaining</span>
            </>
          ) : (
            "None yet"
          )}
        </p>
        <p className="mt-4">
          <Link
            href="/dashboard/student/packages#prepaid"
            className="inline-flex min-h-10 items-center rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-800"
          >
            Buy hours &amp; save
          </Link>
        </p>
        <p className="mt-2 text-xs text-ink-400">Prepaid hours never expire.</p>
      </Card>

      <Card className="p-5">
        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Account credit</p>
        <p className="mt-2 font-display text-3xl font-semibold text-ink-900">{formatMoneyCents(creditCents)}</p>
        <p className="mt-3 text-sm text-ink-400">Applied automatically at checkout.</p>
      </Card>
    </div>
  );
}
