import Link from "next/link";

import { formatPrepaidHoursLabel } from "@/lib/parent-portal.mjs";
import { formatMoneyCents } from "@/lib/format.mjs";

/**
 * Unused prepaid/package minutes + account credit.
 * Customer-facing label is "Prepaid Hours" (internal fields unchanged).
 */
export function BalanceCards({
  minutes,
  creditCents,
  preferFreeSession = false,
  compact = false,
}: {
  minutes: number;
  creditCents: number;
  /** Soften package CTA for brand-new parents who still have a free session. */
  preferFreeSession?: boolean;
  compact?: boolean;
}) {
  const hours = minutes > 0 ? formatPrepaidHoursLabel(minutes) : "0 hours";

  if (compact) {
    return (
      <section>
        <p className="text-sm text-ink-700">
          <span className="font-medium text-ink-900">{hours}</span>
          <span className="text-ink-500"> available</span>
        </p>
        {preferFreeSession && minutes === 0 ? (
          <p className="mt-1 text-sm text-ink-500">Prepaid packages are optional later.</p>
        ) : (
          <p className="mt-1">
            <Link href="/dashboard/student/packages#prepaid" className="text-sm font-medium text-ink-600 hover:underline">
              Buy hours &amp; save
            </Link>
          </p>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Prepaid Hours</p>
        <p className="mt-1 font-display text-3xl font-semibold text-ink-900">
          {hours}
          <span className="mt-1 block text-base font-medium text-ink-500">remaining</span>
        </p>
        {preferFreeSession && minutes === 0 ? (
          <p className="mt-3 text-sm text-ink-600">
            Start with your free 60-minute Study Hall — no card needed. Prepaid packages are optional later.
          </p>
        ) : (
          <p className="mt-3">
            <Link
              href="/dashboard/student/packages#prepaid"
              className="text-sm font-semibold text-gold-700 hover:underline"
            >
              Buy hours &amp; save
            </Link>
          </p>
        )}
        <p className="mt-2 text-xs text-ink-400">Prepaid hours never expire.</p>
      </div>
      {creditCents > 0 ? (
        <p className="text-sm text-ink-500">
          Account credit: <span className="font-medium text-ink-800">{formatMoneyCents(creditCents)}</span>
          <span className="text-ink-400"> · applied at checkout</span>
        </p>
      ) : null}
    </div>
  );
}
