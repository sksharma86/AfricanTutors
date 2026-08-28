"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ManagementStatusLabel } from "@/components/dashboard/management-status-pill";
import { formatCompensationTotals } from "@/lib/compensation-currency.mjs";
import { bookingChildNames } from "@/lib/household-children.mjs";
import {
  comingUpBookings,
  isStudyHallLive,
  managementDateLabel,
  managementGreeting,
  managementOperationalStatus,
  presentNeedsAttention,
  todayDateInTz,
  calendarDateInTz,
} from "@/lib/management-ops.mjs";
import { browserTimezone, formatTime } from "@/lib/timezone";

export interface OverviewBooking {
  id: string;
  student_first_name: string | null;
  student_first_names?: string[] | null;
  child_count?: number | null;
  tutor_display_name: string | null;
  tutor_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  duration_minutes: number | null;
  status: string;
  payment_status: string;
  is_free_trial: boolean;
  issues?: { kind: string; title: string; summary: string; detail: string | null; action: string }[];
}

export interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  bookingId?: string | null;
  kind?: string;
  summary?: string;
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
  const presented = useMemo(() => presentNeedsAttention(attentionItems), [attentionItems]);

  const todayCount = bookings.filter(
    (b) => b.scheduled_start && calendarDateInTz(b.scheduled_start, tz) === today,
  ).length;
  const liveCount = bookings.filter((b) => isStudyHallLive(b, presenceByBooking[b.id], nowMs)).length;
  const coming = comingUpBookings(bookings, { presenceByBooking, nowMs, limit: 8 });
  const hasIssues = presented.length > 0;

  return (
    <div className="space-y-10">
      <header>
        <p className="font-display text-2xl font-semibold text-ink-900">{managementGreeting(nowMs, tz)}</p>
        <p className="mt-1 text-sm text-ink-500">{managementDateLabel(nowMs, tz)}</p>
      </header>

      {hasIssues ? <AttentionBlock items={presented} dominate /> : null}

      <dl className="flex flex-wrap gap-x-8 gap-y-4 border-y border-ink-100 py-5">
        <Metric label="Study Halls today" value={String(todayCount)} />
        <span className="hidden h-10 w-px bg-ink-100 sm:block" aria-hidden />
        <Metric label="Live now" value={String(liveCount)} live={liveCount > 0} />
        <span className="hidden h-10 w-px bg-ink-100 sm:block" aria-hidden />
        <Metric label="Guides active" value={String(guidesActive)} />
        <span className="hidden h-10 w-px bg-ink-100 sm:block" aria-hidden />
        <Metric label="Need attention" value={String(presented.length)} alert={hasIssues} />
        <span className="hidden h-10 w-px bg-ink-100 sm:block" aria-hidden />
        <Metric label="Outstanding Guide pay" value={formatCompensationTotals(outstandingTotals, "outstanding")} />
      </dl>

      {hasIssues ? null : <AttentionBlock items={presented} dominate={false} />}

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
            {(coming as (OverviewBooking & { statusLayer?: string; issues?: OverviewBooking["issues"] })[]).map((b) => {
              const status = String(
                b.statusLayer ??
                  managementOperationalStatus(b as never, {
                    presence: (presenceByBooking[b.id] ?? null) as never,
                    nowMs,
                    issues: b.issues as never,
                  }),
              );
              const reasons = (b.issues ?? []).map((i) => i.title);
              return (
                <li key={b.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 py-2.5 text-sm sm:grid-cols-[5rem_7rem_7rem_minmax(0,1fr)_auto]">
                  <span className="font-medium text-ink-900">
                    {b.scheduled_start ? formatTime(b.scheduled_start, tz) : "—"}
                  </span>
                  <span className="truncate text-ink-800">{bookingChildNames(b, "Child")}</span>
                  <span className="hidden truncate text-ink-500 sm:block">{b.tutor_display_name ?? "No Guide"}</span>
                  <span className="col-span-2 min-w-0 sm:col-span-1">
                    {reasons.length ? (
                      <span className="text-ink-700">{reasons.join(" · ")}</span>
                    ) : (
                      <ManagementStatusLabel status={status} />
                    )}
                  </span>
                  <Link href={`/dashboard/admin/study-halls/${b.id}`} className="font-medium text-ink-600 hover:underline">
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

function AttentionBlock({
  items,
  dominate,
}: {
  items: {
    id: string;
    href: string;
    action: string;
    title: string;
    summary: string;
    detail: string;
    reasons: string[];
    issueCount: number;
    urgent: boolean;
  }[];
  dominate: boolean;
}) {
  return (
    <section>
      <h2 className={dominate ? "font-display text-2xl font-semibold text-ink-900" : "font-display text-lg font-semibold text-ink-900"}>
        Needs attention
        {items.length > 0 ? <span className="text-ink-400"> · {items.length}</span> : null}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-ink-600">
          Everything is running normally.
          <br />
          No coverage issues, failed notifications, or unresolved parent requests.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-ink-100">
          {items.map((item) => (
            <li key={item.id} className="grid gap-1 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6">
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${item.urgent ? "text-red-800" : "text-ink-900"}`}>{item.title}</p>
                {item.issueCount > 1 ? (
                  <ul className="mt-1 text-sm text-ink-700">
                    {item.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : item.summary ? (
                  <p className="mt-0.5 text-sm text-ink-600">{item.summary}</p>
                ) : null}
                {item.detail ? <p className="mt-0.5 text-sm text-ink-500">{item.detail}</p> : null}
              </div>
              <Link href={item.href} className="shrink-0 text-sm font-semibold text-gold-700 hover:underline">
                {item.action}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
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
    <div className="min-w-[6.5rem]">
      <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">{label}</dt>
      <dd
        className={`mt-1 font-display text-xl font-semibold ${
          live ? "text-emerald-800" : alert ? "text-red-800" : "text-ink-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
