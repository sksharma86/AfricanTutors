"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ManagementStatusPill } from "@/components/dashboard/management-status-pill";
import { formatCompensationTotals } from "@/lib/compensation-currency.mjs";
import {
  comingUpBookings,
  isStudyHallLive,
  managementOperationalStatus,
  todayDateInTz,
  calendarDateInTz,
} from "@/lib/management-ops.mjs";
import { browserTimezone, formatTime } from "@/lib/timezone";

export interface OverviewBooking {
  id: string;
  student_first_name: string | null;
  tutor_display_name: string | null;
  tutor_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  duration_minutes: number | null;
  status: string;
  payment_status: string;
  is_free_trial: boolean;
}

export interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  bookingId?: string | null;
}

export function ManagementOverview({
  bookings,
  presenceByBooking,
  attentionItems,
  guidesActive,
  outstandingTotals,
}: {
  bookings: OverviewBooking[];
  presenceByBooking: Record<
    string,
    {
      student_first_joined_at?: string | null;
      tutor_first_joined_at?: string | null;
      student_last_seen_at?: string | null;
      tutor_last_seen_at?: string | null;
      student_last_left_at?: string | null;
      tutor_last_left_at?: string | null;
    }
  >;
  attentionItems: AttentionItem[];
  guidesActive: number;
  outstandingTotals: { currency: string; earned: number; paid: number; outstanding: number }[];
}) {
  const tz = useMemo(() => browserTimezone(), []);
  const [nowMs] = useState(() => Date.now());
  const today = todayDateInTz(tz, nowMs);
  const attentionIds = useMemo(
    () => new Set(attentionItems.map((i) => i.bookingId).filter(Boolean) as string[]),
    [attentionItems],
  );

  const todayCount = bookings.filter(
    (b) => b.scheduled_start && calendarDateInTz(b.scheduled_start, tz) === today,
  ).length;
  const liveCount = bookings.filter((b) => isStudyHallLive(b, presenceByBooking[b.id], nowMs)).length;
  const coming = comingUpBookings(bookings, { presenceByBooking, nowMs, limit: 8, attentionIds });

  return (
    <div className="space-y-10">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-ink-100 pb-6 sm:grid-cols-5">
        <Metric label="Study Halls today" value={String(todayCount)} />
        <Metric label="Live now" value={String(liveCount)} live={liveCount > 0} />
        <Metric label="Guides active" value={String(guidesActive)} />
        <Metric label="Needs attention" value={String(attentionItems.length)} alert={attentionItems.length > 0} />
        <Metric
          label="Outstanding Guide pay"
          value={formatCompensationTotals(outstandingTotals, "outstanding")}
        />
      </dl>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink-900">Needs attention</h2>
        <p className="mt-1 text-sm text-ink-500">
          Call Parent escalations, coverage gaps, and failed parent messages appear here.
        </p>
        {attentionItems.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-ink-600">
            Everything is running normally.
            <br />
            No coverage issues, failed notifications, or unresolved parent requests.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-100">
            {attentionItems.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">{item.title}</p>
                  {item.detail ? <p className="mt-0.5 text-sm text-ink-500">{item.detail}</p> : null}
                </div>
                <Link
                  href={item.href}
                  className="shrink-0 text-sm font-semibold text-gold-700 hover:underline"
                >
                  {item.action}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-ink-900">Coming up</h2>
          <Link href="/dashboard/admin/study-halls" className="text-sm font-medium text-ink-500 hover:text-ink-800">
            All Study Halls
          </Link>
        </div>
        {coming.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">Nothing coming up right now.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {(coming as (OverviewBooking & { statusLayer?: string })[]).map((b) => {
              const status = String(b.statusLayer ?? managementOperationalStatus(b as never, {
                presence: (presenceByBooking[b.id] ?? null) as never,
                nowMs,
                attention: attentionIds.has(b.id),
              }));
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                  <span className="w-20 font-medium text-ink-900">
                    {b.scheduled_start ? formatTime(b.scheduled_start, tz) : "—"}
                  </span>
                  <span className="min-w-[7rem] text-ink-800">{b.student_first_name ?? "Child"}</span>
                  <span className="min-w-[7rem] text-ink-500">{b.tutor_display_name ?? "No Guide"}</span>
                  <ManagementStatusPill status={status} />
                  <Link href={`/dashboard/admin/study-halls/${b.id}`} className="ml-auto font-medium text-ink-600 hover:underline">
                    View
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  live,
  alert,
}: {
  label: string;
  value: string;
  live?: boolean;
  alert?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">{label}</dt>
      <dd
        className={`mt-1 font-display text-xl font-semibold ${
          live ? "text-emerald-800" : alert ? "text-gold-800" : "text-ink-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
