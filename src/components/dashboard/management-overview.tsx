"use client";

import { useMemo, useState } from "react";

import { ManagementStatusLabel } from "@/components/dashboard/management-status-pill";
import { ManagementSurface } from "@/components/dashboard/management-surface";
import { LinkButton } from "@/components/ui/button";
import { PortalTextLink } from "@/components/ui/portal-text-link";
import { formatCents } from "@/lib/pricing";
import { formatCompensationTotals } from "@/lib/compensation-currency.mjs";
import { bookingChildNames } from "@/lib/household-children.mjs";
import {
  managementClockLabel,
  managementCoverageSummary,
  managementPaymentsTodayCents,
  managementRecentActivity,
  managementTodayPulse,
  managementTodayShort,
  managementTodayWorkload,
} from "@/lib/management-console.mjs";
import {
  managementDateLabel,
  managementOperationalStatus,
  presentNeedsAttention,
} from "@/lib/management-ops.mjs";
import { formatDuration } from "@/lib/format.mjs";
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
  guides = [],
  reports = [],
  payments = [],
  nowMs: nowMsProp,
  timeZone,
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
  guides?: { status: string; approved_at?: string | null }[];
  reports?: { booking_id?: string | null; submitted_at?: string | null }[];
  payments?: { created_at?: string | null; status?: string; stripe_paid_cents?: number }[];
  nowMs?: number;
  timeZone?: string;
}) {
  const tz = useMemo(() => timeZone || browserTimezone(), [timeZone]);
  const [clientNow] = useState(() => new Date().getTime());
  const nowMs = nowMsProp ?? clientNow;
  const presented = useMemo(() => presentNeedsAttention(attentionItems), [attentionItems]);
  const pulse = managementTodayPulse(bookings, presenceByBooking, tz, nowMs);
  const coverage = managementCoverageSummary(bookings, guides, tz, nowMs);
  const workload = managementTodayWorkload(bookings, tz, nowMs);
  const activity = managementRecentActivity(bookings, reports, nowMs);
  const paymentsToday = managementPaymentsTodayCents(payments, tz, nowMs);
  const disputes = attentionItems.filter((i) => i.kind === "dispute").length;
  const hasIssues = presented.length > 0;

  return (
    <div className="mg-home">
      <header className="mg-home-head">
        <h1 className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">Operations</h1>
        <p className="text-[12.5px] text-[var(--mg-muted)]">{managementClockLabel(nowMs, tz) || managementDateLabel(nowMs, tz)}</p>
      </header>

      <div className="mg-home-grid">
        <div className="mg-home-today">
          <ManagementSurface command>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-gold-300 uppercase">
                Today · {managementTodayShort(nowMs, tz)}
              </p>
              {hasIssues ? (
                <p className="text-[12.5px] text-[#e8c56a]">
                  {presented.length} {presented.length === 1 ? "issue requires" : "issues require"} attention
                </p>
              ) : (
                <p className="text-[12.5px] text-white/55">No operational issues require attention.</p>
              )}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <PulseStat label="Study Halls today" value={pulse.count} />
              <PulseStat label="Live now" value={pulse.live} live={pulse.live > 0} />
              <PulseStat label="Upcoming" value={pulse.upcoming} />
              <PulseStat label="Completed" value={pulse.completed} />
            </dl>
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase">Next start</p>
              {pulse.next ? (
                <p className="mt-1 text-[15px] font-medium text-white">
                  {pulse.next.scheduled_start ? formatTime(pulse.next.scheduled_start, tz) : "—"}
                  <span className="font-normal text-white/62">
                    {" "}
                    · {bookingChildNames(pulse.next, "Child")}
                    {pulse.next.tutor_display_name ? ` · ${pulse.next.tutor_display_name}` : " · No Guide"}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-white/55">
                  {pulse.count === 0 ? "No Study Halls scheduled today." : "No more Study Halls scheduled today."}
                </p>
              )}
            </div>
          </ManagementSurface>
        </div>

        <div className="mg-home-halls">
          <ManagementSurface>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--mg-muted)] uppercase">Study Halls</p>
              <PortalTextLink href="/dashboard/admin/study-halls">
                {pulse.count === 0 ? "View schedule →" : "View all →"}
              </PortalTextLink>
            </div>
            {pulse.count === 0 ? (
              <p className="mt-3 text-sm text-[var(--mg-muted)]">No Study Halls scheduled today.</p>
            ) : (
              <div className="mt-2">
                {pulse.liveRows.length ? (
                  <DispatchGroup
                    title={`Live now · ${pulse.live}`}
                    rows={pulse.liveRows}
                    tz={tz}
                    presenceByBooking={presenceByBooking}
                    nowMs={nowMs}
                    live
                  />
                ) : null}
                <DispatchGroup
                  title={`Starting next · ${pulse.upcoming}`}
                  rows={pulse.nextRows}
                  tz={tz}
                  presenceByBooking={presenceByBooking}
                  nowMs={nowMs}
                />
              </div>
            )}
          </ManagementSurface>
        </div>

        <div className="mg-home-attention">
          <AttentionCard items={presented} />
        </div>

        <div className="mg-home-coverage">
          <ManagementSurface>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--mg-muted)] uppercase">Guide coverage</p>
              <PortalTextLink href="/dashboard/admin/guides">Manage Guides →</PortalTextLink>
            </div>
            <p className="mt-2 font-display text-[1.7rem] font-semibold leading-none tracking-[-0.04em] text-[var(--mg-ink)]">
              {guidesActive}
            </p>
            <p className="mt-1 text-[13px] text-[var(--mg-muted)]">Guides active</p>
            <p className="mt-3 text-[13px] text-[var(--mg-ink)]">
              {coverage.todayOpen === 0
                ? "No open Study Halls today."
                : coverage.covered
                  ? `${coverage.assigned} / ${coverage.todayOpen} Study Halls assigned`
                  : `${coverage.needing} of ${coverage.todayOpen} need a Guide`}
            </p>
            {coverage.applications > 0 ? (
              <p className="mt-2">
                <PortalTextLink href="/dashboard/admin/guides">{coverage.applications} awaiting review →</PortalTextLink>
              </p>
            ) : (
              <p className="mt-2 text-[12.5px] text-[var(--mg-muted)]">No applications awaiting review.</p>
            )}
            {workload.length ? (
              <ul className="mt-3 divide-y divide-[#1c1915]/[0.06]">
                {workload.map((row) => (
                  <li key={row.name} className="flex justify-between gap-3 py-1.5 text-[13px]">
                    <span className="truncate text-[var(--mg-ink)]">{row.name}</span>
                    <span className="shrink-0 text-[var(--mg-muted)]">
                      {row.sessions} Study Hall{row.sessions === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </ManagementSurface>
        </div>

        <div className="mg-home-finance">
          <ManagementSurface>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--mg-muted)] uppercase">Finance</p>
              <PortalTextLink href="/dashboard/admin/finance">Open Finance →</PortalTextLink>
            </div>
            <p className="mt-2 font-display text-[1.55rem] font-semibold leading-none tracking-[-0.04em] text-[var(--mg-ink)]">
              {formatCents(paymentsToday)}
            </p>
            <p className="mt-1 text-[13px] text-[var(--mg-muted)]">Customer payments today</p>
            <p className="mt-3 text-[13px] text-[var(--mg-ink)]">
              <span className="sr-only">Outstanding Guide pay </span>
              {formatCompensationTotals(outstandingTotals, "outstanding")}
              <span className="text-[var(--mg-muted)]"> Outstanding Guide pay</span>
            </p>
            <p className="mt-1 text-[13px] text-[var(--mg-muted)]">
              {disputes} pending dispute{disputes === 1 ? "" : "s"}
            </p>
          </ManagementSurface>
        </div>

        <div className="mg-home-activity">
          <ManagementSurface>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--mg-muted)] uppercase">Recent activity</p>
            {activity.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--mg-muted)]">No recent operational activity.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Type</th>
                      <th>Details</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((row) => (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap tabular-nums">{formatTime(new Date(row.at).toISOString(), tz)}</td>
                        <td className="whitespace-nowrap">{row.type}</td>
                        <td>
                          <a href={row.href} className="underline-offset-4 hover:underline">
                            {row.details}
                          </a>
                        </td>
                        <td className="whitespace-nowrap text-[var(--mg-muted)]">{row.by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ManagementSurface>
        </div>
      </div>
    </div>
  );
}

function PulseStat({ label, value, live }: { label: string; value: number; live?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-[0.12em] text-white/42 uppercase">{label}</dt>
      <dd className={`mt-1 font-display text-[1.85rem] font-semibold leading-none tracking-[-0.04em] ${live ? "text-[#9dcbad]" : "text-white"}`}>
        {value}
      </dd>
    </div>
  );
}

function DispatchGroup({
  title,
  rows,
  tz,
  presenceByBooking,
  nowMs,
  live,
}: {
  title: string;
  rows: OverviewBooking[];
  tz: string;
  presenceByBooking: Record<string, object | undefined>;
  nowMs: number;
  live?: boolean;
}) {
  if (!rows.length) return null;
  return (
    <div className={live ? "mb-3" : ""}>
      <p className="text-[11px] font-medium text-[var(--mg-muted)]">{title}</p>
      <ul className="mt-0.5 divide-y divide-[#1c1915]/[0.06]">
        {rows.map((b) => {
          const status = managementOperationalStatus(b as never, {
            presence: (presenceByBooking[b.id] ?? null) as never,
            nowMs,
            issues: b.issues as never,
          });
          return (
            <li key={b.id} className="grid grid-cols-[4.4rem_minmax(0,1fr)_auto] items-baseline gap-2 py-1.5 text-[13px]">
              <span className="tabular-nums text-[var(--mg-ink)]">
                {b.scheduled_start ? formatTime(b.scheduled_start, tz) : "—"}
              </span>
              <span className="min-w-0 truncate">
                {bookingChildNames(b, "Child")}
                <span className="text-[var(--mg-muted)]">
                  {" "}
                  · {b.tutor_display_name ?? "No Guide"}
                  {b.duration_minutes ? ` · ${formatDuration(b.duration_minutes)}` : ""}
                </span>
              </span>
              {live ? (
                <span className="text-[12px] font-medium text-[var(--mg-positive)]">Live</span>
              ) : (
                <ManagementStatusLabel status={String(status)} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AttentionCard({
  items,
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
}) {
  return (
    <ManagementSurface attention={items.length > 0}>
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--mg-muted)] uppercase">
        Needs attention
        <span className="text-[var(--mg-ink)]"> · {items.length}</span>
      </p>
      {items.length === 0 ? (
        <div className="mt-3">
          <p className="text-[15px] font-medium text-[var(--mg-positive)]">Clear</p>
          <p className="mt-1 text-sm leading-6 text-[var(--mg-muted)]">
            Everything is running normally.
            <br />
            No coverage issues, failed notifications, or unresolved parent requests.
          </p>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-[#1c1915]/[0.06]">
          {items.slice(0, 4).map((item) => (
            <li key={item.id} className="py-2.5">
              <p className={`text-[13px] font-medium ${item.urgent ? "text-[var(--mg-critical)]" : "text-[var(--mg-ink)]"}`}>
                {item.title}
              </p>
              {item.detail ? <p className="mt-0.5 text-[12.5px] text-[var(--mg-muted)]">{item.detail}</p> : null}
              <p className="mt-1.5">
                <LinkButton href={item.href} variant={item.action === "Assign Guide" ? "primary" : "outline"} size="sm">
                  {item.action} →
                </LinkButton>
              </p>
            </li>
          ))}
        </ul>
      )}
    </ManagementSurface>
  );
}
