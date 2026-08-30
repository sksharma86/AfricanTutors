import Link from "next/link";

import { GuideSurface } from "@/components/dashboard/guide-surface";
import { formatCompensationMinor } from "@/lib/compensation-currency.mjs";

export function GuideEarningsCard({
  outstanding,
  paidMonth,
  currency,
}: {
  outstanding: number;
  paidMonth: number;
  currency: string;
}) {
  return (
    <GuideSurface className="px-4 py-3.5">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--gp-muted)] uppercase">Earnings</p>
      <p className="mt-2 font-display text-[1.85rem] font-semibold leading-none tracking-[-0.04em] text-[var(--gp-ink)]">
        {formatCompensationMinor(outstanding, currency)}
      </p>
      <p className="mt-1 text-[13px] text-[var(--gp-muted)]">Outstanding</p>
      <p className="mt-3 text-[13px] text-[var(--gp-ink)]">
        {formatCompensationMinor(paidMonth, currency)}
        <span className="text-[var(--gp-muted)]"> paid this month</span>
      </p>
      <p className="mt-3">
        <Link href="/dashboard/tutor/earnings" className="text-[13px] font-medium text-[var(--gp-ink)] underline-offset-4 hover:underline">
          View earnings →
        </Link>
      </p>
    </GuideSurface>
  );
}
