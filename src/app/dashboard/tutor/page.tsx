import type { Metadata } from "next";

import {
  AvailabilityManager,
  type AvailabilityBlock,
  type ExceptionRow,
} from "@/components/dashboard/availability-manager";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { GuideJoinControl } from "@/components/dashboard/guide-join-control";
import { GuideSessionReport } from "@/components/dashboard/guide-session-report";
import { TutorCancelRequest } from "@/components/dashboard/tutor-cancel-request";
import { requireRole } from "@/lib/auth";
import { BOOKING_STATUS_LABEL, type BookingStatus } from "@/lib/booking-config";
import { partitionBookings } from "@/lib/bookings";
import { formatCents } from "@/lib/pricing";
import { formatStudyHallDuration } from "@/lib/studyhall-duration.mjs";
import { tutorTimezone } from "@/lib/tutor-schedule.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDayHeading, formatTime, tzAbbreviation } from "@/lib/timezone";

export const metadata: Metadata = { title: "Guide Dashboard · Study Hall (at home)" };

interface GuideBooking {
  id: string;
  subject_name: string | null;
  other_subject_text: string | null;
  student_first_name: string | null;
  student_grade: string | null;
  request_note: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  duration_minutes: number | null;
  status: BookingStatus;
  is_free_trial: boolean;
}
interface Earning {
  booking_id: string | null;
  amount_cents: number;
  status: string;
  earned_at: string | null;
  paid_at: string | null;
}

function splitToday(upcoming: GuideBooking[]): { today: GuideBooking[]; later: GuideBooking[] } {
  const todayStr = new Date().toDateString();
  const today = upcoming.filter((b) => b.scheduled_start && new Date(b.scheduled_start).toDateString() === todayStr);
  const later = upcoming.filter((b) => !today.includes(b));
  return { today, later };
}

function AssignmentCard({ b, tz, openRequest }: { b: GuideBooking; tz: string; openRequest: boolean }) {
  const when =
    b.scheduled_start != null
      ? `${formatDayHeading(b.scheduled_start, tz)}, ${formatTime(b.scheduled_start, tz)}–${
          b.scheduled_end ? formatTime(b.scheduled_end, tz) : "—"
        } (${tzAbbreviation(b.scheduled_start, tz)})`
      : "Time to be confirmed";

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-ink-900">Study Hall</p>
            {b.is_free_trial ? (
              <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-gold-700 uppercase">
                Free session
              </span>
            ) : null}
            <span className="rounded-full border border-ink-200 bg-ink-50 px-2.5 py-0.5 text-xs font-medium text-ink-600">
              {BOOKING_STATUS_LABEL[b.status]}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-ink-700">
            <span className="font-medium text-ink-900">{b.student_first_name ?? "Child"}</span>
            {b.student_grade ? <span className="text-ink-500"> · Grade {b.student_grade}</span> : null}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {when}
            {b.duration_minutes ? (
              <span className="text-ink-400"> · {formatStudyHallDuration(b.duration_minutes)}</span>
            ) : null}
          </p>
          {b.request_note ? (
            <p className="mt-1 text-sm text-ink-600">
              Parent note: <span className="text-ink-700">{b.request_note}</span>
            </p>
          ) : null}
          <p className="mt-2 text-xs text-ink-400">
            Your role: presence, focus, accountability, and calm redirection — not tutoring or homework answers.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <GuideJoinControl
            bookingId={b.id}
            status={b.status}
            scheduledStart={b.scheduled_start}
            scheduledEnd={b.scheduled_end}
          />
          {b.status === "confirmed" || b.status === "pending" ? (
            <TutorCancelRequest bookingId={b.id} alreadyRequested={openRequest} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HistoryRow({
  b,
  tz,
  earning,
  reportSubmitted,
  reportsReady,
}: {
  b: GuideBooking;
  tz: string;
  earning?: Earning;
  reportSubmitted: boolean;
  reportsReady: boolean;
}) {
  const needsReport = reportsReady && b.status === "completed" && !reportSubmitted;
  return (
    <tr>
      <td className="py-2 pr-3 text-ink-700">{b.scheduled_start ? formatDayHeading(b.scheduled_start, tz) : "—"}</td>
      <td className="py-2 pr-3 text-ink-800">Study Hall</td>
      <td className="py-2 pr-3 text-ink-600">{b.student_first_name ?? "Child"}</td>
      <td className="py-2 pr-3 text-ink-600">{formatStudyHallDuration(b.duration_minutes)}</td>
      <td className="py-2 pr-3 text-ink-600">{BOOKING_STATUS_LABEL[b.status]}</td>
      <td className="py-2 pr-3 align-top">
        {needsReport ? (
          <GuideSessionReport
            bookingId={b.id}
            childName={b.student_first_name}
            alreadySubmitted={false}
          />
        ) : reportSubmitted ? (
          <span className="text-xs font-medium text-forest-700">Report submitted</span>
        ) : (
          <span className="text-ink-400">—</span>
        )}
      </td>
      <td className="py-2 pr-3 font-medium text-ink-900">{earning ? formatCents(earning.amount_cents) : "—"}</td>
      <td className="py-2 text-ink-500">{earning ? earning.status : "—"}</td>
    </tr>
  );
}

export default async function GuideDashboardPage() {
  await requireRole("tutor", "/dashboard/tutor");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase!.auth.getUser();
  const tutorId = user!.id;

  const [{ data: profile }, { data: bookingsRaw }, { data: avail }, { data: exc }, { data: earningsRaw }, { data: reqs }, reportsRes] =
    await Promise.all([
      supabase!.from("tutor_profiles").select("timezone, comp_rate_cents_per_hour, status").eq("profile_id", tutorId).maybeSingle(),
      supabase!
        .from("bookings")
        .select(
          "id, subject_name, other_subject_text, student_first_name, student_grade, request_note, scheduled_start, scheduled_end, duration_minutes, status, is_free_trial",
        )
        .order("scheduled_start", { ascending: true, nullsFirst: false }),
      supabase!.from("tutor_availability").select("id, day_of_week, start_time, end_time"),
      supabase!.from("tutor_availability_exceptions").select("id, starts_at, ends_at, reason"),
      supabase!
        .from("tutor_earnings")
        .select("booking_id, amount_cents, status, earned_at, paid_at")
        .order("earned_at", { ascending: false, nullsFirst: false }),
      supabase!.from("tutor_cancellation_requests").select("booking_id").eq("status", "open"),
      // Table lands with migration 0023; tolerate missing relation until applied.
      supabase!.from("session_reports").select("booking_id").then(
        (r) => r,
        () => ({ data: null, error: null }),
      ),
    ]);

  const tz = tutorTimezone(profile?.timezone);
  const bookings = (bookingsRaw ?? []) as unknown as GuideBooking[];
  const earnings = (earningsRaw ?? []) as Earning[];
  const openReqBookings = new Set(((reqs ?? []) as { booking_id: string }[]).map((r) => r.booking_id));
  // Migration 0023: hide report CTAs until session_reports exists in this environment.
  const reportsReady = !reportsRes.error;
  const reportedBookings = new Set(
    reportsReady ? ((reportsRes.data ?? []) as { booking_id: string }[]).map((r) => r.booking_id) : [],
  );
  const earningByBooking = new Map<string, Earning>();
  for (const e of earnings) if (e.booking_id) earningByBooking.set(e.booking_id, e);

  const { upcoming, past } = partitionBookings(bookings);
  const { today, later: laterUpcoming } = splitToday(upcoming);
  const needsReport = reportsReady
    ? past.filter((b) => b.status === "completed" && !reportedBookings.has(b.id))
    : [];

  let totalEarned = 0,
    totalPaid = 0,
    outstanding = 0;
  for (const e of earnings) {
    if (e.status === "voided") continue;
    totalEarned += e.amount_cents;
    if (e.status === "paid") totalPaid += e.amount_cents;
    else outstanding += e.amount_cents;
  }
  const payouts = earnings.filter((e) => e.status === "paid" && e.paid_at);

  return (
    <DashboardShell
      role="tutor"
      title="Guide workspace"
      description="Your Study Hall assignments, earnings, and availability."
      navItems={[
        { label: "Study Halls", available: true },
        { label: "Earnings", available: true },
        { label: "Availability", available: true },
        { label: "Messages", available: false },
      ]}
    >
      {profile?.status && profile.status !== "approved" ? (
        <div className="mb-6 rounded-lg border border-gold-200 bg-gold-50 p-4 text-sm text-gold-800">
          Your Guide account is <span className="font-semibold">{profile.status}</span>. Assignment and earnings tools
          stay limited until an admin restores approval.
        </div>
      ) : null}

      <section className="mb-8 rounded-xl border border-forest-200 bg-forest-50/60 p-4 text-sm leading-6 text-ink-700">
        <p className="font-medium text-ink-900">Your Study Hall role</p>
        <p className="mt-1">
          Be present, supervise homework, encourage focus, redirect gently when needed, and keep a calm productive
          routine. You are not expected to teach lessons, solve homework, or act as a subject tutor. During a live
          session, use Call Parent when you need parent involvement — the parent&apos;s number stays private.
        </p>
      </section>

      <section className="mb-8 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-ink-100 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-400">Earned</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink-900">{formatCents(totalEarned)}</p>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-400">Paid</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink-900">{formatCents(totalPaid)}</p>
        </div>
        <div className="rounded-2xl border border-gold-200 bg-gold-50 p-4">
          <p className="text-xs uppercase tracking-wide text-gold-700">Outstanding</p>
          <p className="mt-1 font-display text-2xl font-semibold text-gold-800">{formatCents(outstanding)}</p>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-400">Your rate</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink-900">
            {typeof profile?.comp_rate_cents_per_hour === "number"
              ? `${formatCents(profile.comp_rate_cents_per_hour)}/hr`
              : "Not set"}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">Set by admin · scales with session length</p>
        </div>
      </section>

      {today.length > 0 ? (
        <section className="mb-8">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Today&apos;s Study Halls</h3>
          <div className="space-y-3">
            {today.map((b) => (
              <AssignmentCard key={b.id} b={b} tz={tz} openRequest={openReqBookings.has(b.id)} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Upcoming assignments</h3>
        {laterUpcoming.length === 0 && today.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-400">
            No upcoming Study Hall assignments. Keep your availability up to date so you can be matched.
          </p>
        ) : laterUpcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 px-4 py-4 text-center text-sm text-ink-400">
            Nothing else scheduled after today.
          </p>
        ) : (
          <div className="space-y-3">
            {laterUpcoming.map((b) => (
              <AssignmentCard key={b.id} b={b} tz={tz} openRequest={openReqBookings.has(b.id)} />
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-ink-400">
          Ready to join 5 minutes before start. Times shown in your timezone ({tz}). Sessions are recorded on-platform.
        </p>
      </section>

      {needsReport.length > 0 ? (
        <section className="mb-8">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Reports to complete</h3>
          <div className="space-y-3">
            {needsReport.map((b) => (
              <div
                key={b.id}
                className="flex flex-col gap-3 rounded-xl border border-gold-200 bg-gold-50/50 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink-900">
                    {b.student_first_name ?? "Child"}
                    {b.student_grade ? <span className="font-normal text-ink-500"> · Grade {b.student_grade}</span> : null}
                  </p>
                  <p className="mt-1 text-sm text-ink-600">
                    {b.scheduled_start ? formatDayHeading(b.scheduled_start, tz) : "Completed Study Hall"}
                    {b.duration_minutes ? (
                      <span className="text-ink-400"> · {formatStudyHallDuration(b.duration_minutes)}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">~30–60 seconds · shared with the parent</p>
                </div>
                <GuideSessionReport
                  bookingId={b.id}
                  childName={b.student_first_name}
                  alreadySubmitted={false}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section className="mb-8">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Completed Study Halls</h3>
          <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white p-2">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Session</th>
                  <th className="py-2 pr-3">Child</th>
                  <th className="py-2 pr-3">Length</th>
                  <th className="py-2 pr-3">Outcome</th>
                  <th className="py-2 pr-3">Report</th>
                  <th className="py-2 pr-3">Earning</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {past.map((b) => (
                  <HistoryRow
                    key={b.id}
                    b={b}
                    tz={tz}
                    earning={earningByBooking.get(b.id)}
                    reportSubmitted={reportedBookings.has(b.id)}
                    reportsReady={reportsReady}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-400">
            After each completed Study Hall, submit a short parent-facing report (focus, what they worked on,
            redirection). Reports are final once submitted. Earnings already scale with session length (1h / 2h / 3h).
          </p>
        </section>
      ) : null}

      {payouts.length > 0 ? (
        <section className="mb-8">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Payout history</h3>
          <div className="space-y-2">
            {payouts.map((e, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm"
              >
                <span className="text-ink-600">Paid {e.paid_at ? formatDayHeading(e.paid_at, tz) : ""}</span>
                <span className="font-medium text-ink-900">{formatCents(e.amount_cents)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-400">Payouts are processed manually by Study Hall (at home).</p>
        </section>
      ) : null}

      <section>
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Availability</h3>
        <p className="mb-3 text-sm text-ink-500">
          Keep continuous blocks open for the full Study Hall length parents book (1, 2, or 3 hours). Assignment never
          stitches multiple Guides into one session.
        </p>
        <AvailabilityManager
          tutorId={tutorId}
          timezone={tz}
          blocks={(avail ?? []) as AvailabilityBlock[]}
          exceptions={(exc ?? []) as ExceptionRow[]}
        />
      </section>
    </DashboardShell>
  );
}
