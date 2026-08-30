import { ParentIconClock } from "@/components/dashboard/parent-icons";
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
  const wholeHours = Math.max(0, Math.floor((Number(minutes) || 0) / 60));
  const remainder = Math.max(0, Math.round(Number(minutes) || 0) % 60);
  const buy = preferFreeSession && minutes === 0 ? null : (
    <PortalTextLink href="/dashboard/student/packages#prepaid" className="shrink-0">
      Buy hours &amp; save →
    </PortalTextLink>
  );

  if (compact) {
    return (
      <section className="flex items-center justify-between gap-4 rounded-[18px] bg-[var(--pp-card)] px-5 py-4 shadow-[var(--pp-shadow-1)] ring-1 ring-[#1c1915]/[0.05]">
        <div className="flex items-center gap-3.5">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-[#f3e6c4] text-[#c9a227]">
            <ParentIconClock />
          </span>
          <div>
            <p className="font-display text-[2rem] font-semibold leading-none tracking-[-0.04em] text-[var(--pp-ink)]">
              {wholeHours}
              {remainder > 0 ? <span className="ml-1 text-base font-medium text-[var(--pp-muted)]">+{remainder}m</span> : null}
            </p>
            <p className="mt-1.5 text-sm text-[var(--pp-muted)]">
              <span className="sr-only">{hours} </span>hours available
            </p>
          </div>
        </div>
        {buy}
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold tracking-wide text-[var(--pp-muted)] uppercase">Prepaid Hours</p>
        <p className="mt-1 font-display text-4xl font-semibold tracking-[-0.04em] text-[var(--pp-ink)]">
          {wholeHours}
          <span className="mt-1 block text-base font-medium text-[var(--pp-muted)]">
            {hours} remaining
          </span>
        </p>
        {preferFreeSession && minutes === 0 ? (
          <p className="mt-3 text-sm text-[var(--pp-muted)]">
            Start with your free 60-minute Study Hall — no card needed. Prepaid packages are optional later.
          </p>
        ) : (
          <p className="mt-3">
            <PortalTextLink href="/dashboard/student/packages#prepaid">Buy hours &amp; save</PortalTextLink>
          </p>
        )}
        <p className="mt-2 text-xs text-[#8a8376]">Prepaid hours never expire.</p>
      </div>
      {creditCents > 0 ? (
        <p className="text-sm text-[var(--pp-muted)]">
          Account credit: <span className="font-medium text-[var(--pp-ink)]">{formatMoneyCents(creditCents)}</span>
          <span className="text-[#8a8376]"> · applied at checkout</span>
        </p>
      ) : null}
    </div>
  );
}
