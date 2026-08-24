import Link from "next/link";

import { Card } from "@/components/ui/card";
import { formatDuration, formatMoneyCents } from "@/lib/format.mjs";

/**
 * Human-readable account balances. Customers see tutoring TIME and dollar
 * CREDIT — never ledger terminology or raw minutes-as-a-number.
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
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4 text-forest-500">
            <circle cx="12" cy="12" r="8.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12l3 2" />
          </svg>
          Study Hall balance
        </div>
        <p className="mt-2 font-display text-3xl font-semibold text-ink-900">
          {minutes > 0 ? formatDuration(minutes) : "None yet"}
        </p>
        <p className="mt-3 text-sm">
          <Link href="/dashboard/student/packages" className="font-medium text-gold-700 hover:underline">
            Buy hours →
          </Link>
        </p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4 text-gold-600">
            <rect x="3.5" y="6" width="17" height="12" rx="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 10h17" />
          </svg>
          Account credit
        </div>
        <p className="mt-2 font-display text-3xl font-semibold text-ink-900">{formatMoneyCents(creditCents)}</p>
        <p className="mt-3 text-sm text-ink-400">Applied automatically at checkout.</p>
      </Card>
    </div>
  );
}
