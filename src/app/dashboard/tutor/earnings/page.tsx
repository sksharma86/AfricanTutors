import type { Metadata } from "next";

import { GuidePage } from "@/components/dashboard/guide-page";
import { GuideSurface } from "@/components/dashboard/guide-surface";
import { requireRole } from "@/lib/auth";
import {
  aggregateCompensationByCurrency,
  formatCompensationHourly,
  formatCompensationMinor,
  formatCompensationTotals,
} from "@/lib/compensation-currency.mjs";
import { guideEarningStatusLabel } from "@/lib/guide-portal.mjs";
import { loadGuideWorkspace } from "@/lib/guide-portal-data";
import { formatStudyHallDuration } from "@/lib/studyhall-duration.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tutorTimezone } from "@/lib/tutor-schedule.mjs";
import { formatDayHeading } from "@/lib/timezone";

export const metadata: Metadata = { title: "Earnings" };
export const dynamic = "force-dynamic";

export default async function GuideEarningsPage() {
  const user = await requireRole("tutor", "/dashboard/tutor/earnings");
  const supabase = await createSupabaseServerClient();
  const data = await loadGuideWorkspace(supabase!, user.id);
  const tz = tutorTimezone(data.profile?.timezone);
  const compCurrency = data.profile?.comp_currency ?? "USD";
  const totals = aggregateCompensationByCurrency(data.earnings);
  const history = [...data.earnings].sort((a, b) => Date.parse(b.earned_at ?? "") - Date.parse(a.earned_at ?? ""));
  const byBooking = new Map(data.bookings.map((b) => [b.id, b]));

  return (
    <GuidePage>
      <h1 id="earnings" className="font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-[var(--gp-ink)]">
        Earnings
      </h1>

      <GuideSurface className="mt-6">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">Hourly rate</p>
        <p className="mt-2 font-display text-3xl font-semibold text-ink-900">
          {typeof data.profile?.comp_rate_cents_per_hour === "number"
            ? formatCompensationHourly(data.profile.comp_rate_cents_per_hour, compCurrency)
            : "Not set"}
        </p>
        <p className="mt-1 text-sm text-ink-400">Set by admin · scales with session length</p>

        <dl className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold tracking-[0.14em] text-gold-700 uppercase">Outstanding</dt>
            <dd className="mt-1 font-display text-2xl font-semibold text-ink-900">
              {totals.length === 0
                ? formatCompensationMinor(0, compCurrency)
                : formatCompensationTotals(totals, "outstanding")}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">Paid</dt>
            <dd className="mt-1 font-display text-2xl font-semibold text-ink-900">
              {totals.length === 0 ? formatCompensationMinor(0, compCurrency) : formatCompensationTotals(totals, "paid")}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-ink-500">
          Earned{" "}
          {totals.length === 0 ? formatCompensationMinor(0, compCurrency) : formatCompensationTotals(totals, "earned")}
        </p>
      </GuideSurface>

      <section className="mt-8">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">Payment history</p>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No earnings yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {history.map((e, i) => {
              const booking = e.booking_id ? byBooking.get(e.booking_id) : null;
              return (
                <li key={`${e.booking_id ?? "x"}-${i}`} className="flex items-baseline justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {e.earned_at ? formatDayHeading(e.earned_at, tz) : "—"}
                    </p>
                    <p className="text-sm text-ink-500">
                      {booking?.duration_minutes ? formatStudyHallDuration(booking.duration_minutes) : "Study Hall"}
                      {" · "}
                      {guideEarningStatusLabel(e.status)}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-ink-900">
                    {formatCompensationMinor(e.amount_cents, e.currency ?? "USD")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-xs text-ink-400">Payouts are processed manually by Study Hall (at home).</p>
      </section>
    </GuidePage>
  );
}
