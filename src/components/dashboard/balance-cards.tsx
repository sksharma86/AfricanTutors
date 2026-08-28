import { PortalTextLink } from "@/components/ui/portal-text-link";
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
      <section className="flex items-center justify-between gap-4 rounded-2xl bg-white/75 px-4 py-3 ring-1 ring-ink-900/[0.05]">
        <p className="text-sm text-ink-700">
          <span className="font-semibold text-ink-900">{hours}</span>
          <span className="text-ink-500"> available</span>
        </p>
        {preferFreeSession && minutes === 0 ? null : (
          <PortalTextLink href="/dashboard/student/packages#prepaid" className="shrink-0">
            Buy hours &amp; save →
          </PortalTextLink>
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
            <PortalTextLink href="/dashboard/student/packages#prepaid">Buy hours &amp; save</PortalTextLink>
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
