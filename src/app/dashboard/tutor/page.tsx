import type { Metadata } from "next";
import Link from "next/link";

import {
  AvailabilityManager,
  type AvailabilityBlock,
  type ExceptionRow,
} from "@/components/dashboard/availability-manager";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { TutorCancelRequest } from "@/components/dashboard/tutor-cancel-request";
import { requireRole } from "@/lib/auth";
import { BOOKING_STATUS_LABEL, type BookingStatus } from "@/lib/booking-config";
import { partitionBookings } from "@/lib/bookings";
import { formatCents } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDayHeading, formatTime, tzAbbreviation } from "@/lib/timezone";

export const metadata: Metadata = { title: "Tutor Dashboard" };

interface TutorBooking {
  id: string;
  subject_name: string | null;
  other_subject_text: string | null;
  student_first_name: string | null;
  student_grade: string | null;
  request_note: string | null;
  scheduled_start: string | null;
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

function subjectOf(b: TutorBooking) {
  return b.subject_name ?? (b.other_subject_text ? `Other — ${b.other_subject_text}` : "Session");
}

// Module-scope (not called during component render body) so date math stays out
// of the Server Component's render purity scope.
function splitToday(upcoming: TutorBooking[]): { today: TutorBooking[]; later: TutorBooking[] } {
  const todayStr = new Date().toDateString();
  const today = upcoming.filter((b) => b.scheduled_start && new Date(b.scheduled_start).toDateString() === todayStr);
  const later = upcoming.filter((b) => !today.includes(b));
  return { today, later };
}

function UpcomingCard({ b, tz, openRequest }: { b: TutorBooking; tz: string; openRequest: boolean }) {
  const joinable = (b.status === "confirmed" || b.status === "pending") && b.scheduled_start;
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink-900">
            {subjectOf(b)}
            {b.is_free_trial ? <span className="ml-2 text-xs font-semibold text-gold-600">FREE TRIAL</span> : null}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {b.student_first_name ?? "Student"}
            {b.student_grade ? ` · Grade ${b.student_grade}` : ""}
            {b.scheduled_start ? ` · ${formatDayHeading(b.scheduled_start, tz)}, ${formatTime(b.scheduled_start, tz)} (${tzAbbreviation(b.scheduled_start, tz)})` : ""}
            {b.duration_minutes ? ` · ${b.duration_minutes} min` : ""}
          </p>
          {b.request_note ? <p className="mt-1 text-sm text-ink-600">Focus: {b.request_note}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full border border-ink-200 bg-ink-50 px-2.5 py-0.5 text-xs font-medium text-ink-600">{BOOKING_STATUS_LABEL[b.status]}</span>
          {joinable ? (
            <Link href={`/dashboard/session/${b.id}`} className="rounded-lg bg-gold-400 px-3 py-1 text-xs font-semibold text-ink-900 hover:bg-gold-300">
              Join session
            </Link>
          ) : null}
          {b.status === "confirmed" || b.status === "pending" ? <TutorCancelRequest bookingId={b.id} alreadyRequested={openRequest} /> : null}
        </div>
      </div>
    </div>
  );
}

function HistoryRow({ b, tz, earning }: { b: TutorBooking; tz: string; earning?: Earning }) {
  return (
    <tr>
      <td className="py-2 pr-3 text-ink-700">{b.scheduled_start ? formatDayHeading(b.scheduled_start, tz) : "—"}</td>
      <td className="py-2 pr-3 text-ink-800">{subjectOf(b)}</td>
      <td className="py-2 pr-3 text-ink-600">{b.student_first_name ?? "Student"}</td>
      <td className="py-2 pr-3 text-ink-600">{b.duration_minutes ?? "—"} min</td>
      <td className="py-2 pr-3 text-ink-600">{BOOKING_STATUS_LABEL[b.status]}</td>
      <td className="py-2 pr-3 font-medium text-ink-900">{earning ? formatCents(earning.amount_cents) : "—"}</td>
      <td className="py-2 text-ink-500">{earning ? earning.status : "—"}</td>
    </tr>
  );
}

export default async function TutorDashboardPage() {
  await requireRole("tutor", "/dashboard/tutor");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase!.auth.getUser();
  const tutorId = user!.id;

  const [{ data: profile }, { data: bookingsRaw }, { data: avail }, { data: exc }, { data: subs }, { data: earningsRaw }, { data: reqs }] =
    await Promise.all([
      supabase!.from("tutor_profiles").select("timezone, comp_rate_cents_per_hour, status").eq("profile_id", tutorId).maybeSingle(),
      supabase!
        .from("bookings")
        .select("id, subject_name, other_subject_text, student_first_name, student_grade, request_note, scheduled_start, duration_minutes, status, is_free_trial")
        .order("scheduled_start", { ascending: true, nullsFirst: false }),
      supabase!.from("tutor_availability").select("id, day_of_week, start_time, end_time"),
      supabase!.from("tutor_availability_exceptions").select("id, starts_at, ends_at, reason"),
      supabase!.from("tutor_subjects").select("subject_id, subjects(name)"),
      supabase!.from("tutor_earnings").select("booking_id, amount_cents, status, earned_at, paid_at").order("earned_at", { ascending: false, nullsFirst: false }),
      supabase!.from("tutor_cancellation_requests").select("booking_id").eq("status", "open"),
    ]);

  const tz = profile?.timezone ?? "Africa/Lagos";
  const bookings = (bookingsRaw ?? []) as unknown as TutorBooking[];
  const earnings = (earningsRaw ?? []) as Earning[];
  const openReqBookings = new Set(((reqs ?? []) as { booking_id: string }[]).map((r) => r.booking_id));
  const earningByBooking = new Map<string, Earning>();
  for (const e of earnings) if (e.booking_id) earningByBooking.set(e.booking_id, e);

  const { upcoming, past } = partitionBookings(bookings);
  const { today, later: laterUpcoming } = splitToday(upcoming);

  const approvedSubjects = ((subs ?? []) as unknown as { subjects: { name: string } | null }[]).map((r) => r.subjects?.name).filter(Boolean) as string[];

  // Earnings summary from authoritative snapshot records (never the current rate).
  let totalEarned = 0, totalPaid = 0, outstanding = 0;
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
      title="Welcome back"
      description="Your schedule, earnings, and availability."
      navItems={[
        { label: "Sessions", available: true },
        { label: "Earnings", available: true },
        { label: "Availability", available: true },
        { label: "Messages", available: false },
      ]}
    >
      {profile?.status && profile.status !== "approved" ? (
        <div className="mb-6 rounded-lg border border-gold-200 bg-gold-50 p-4 text-sm text-gold-800">
          Your tutor account is <span className="font-semibold">{profile.status}</span>. You&apos;ll be matched to sessions once an admin approves you.
        </div>
      ) : null}

      {/* Earnings summary */}
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
            {typeof profile?.comp_rate_cents_per_hour === "number" ? `${formatCents(profile.comp_rate_cents_per_hour)}/hr` : "Not set"}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">Set by admin</p>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Approved subjects</h3>
        {approvedSubjects.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 px-4 py-4 text-sm text-ink-400">No subjects assigned yet (admin-controlled).</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {approvedSubjects.map((s) => (
              <span key={s} className="rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-sm text-gold-700">{s}</span>
            ))}
          </div>
        )}
      </section>

      {today.length > 0 ? (
        <section className="mb-8">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Today</h3>
          <div className="space-y-3">{today.map((b) => <UpcomingCard key={b.id} b={b} tz={tz} openRequest={openReqBookings.has(b.id)} />)}</div>
        </section>
      ) : null}

      <section className="mb-8">
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Upcoming sessions</h3>
        {laterUpcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-400">No upcoming sessions.</p>
        ) : (
          <div className="space-y-3">{laterUpcoming.map((b) => <UpcomingCard key={b.id} b={b} tz={tz} openRequest={openReqBookings.has(b.id)} />)}</div>
        )}
        <p className="mt-2 text-xs text-ink-400">Sessions are conducted and recorded on-platform. Times shown in your timezone ({tz}).</p>
      </section>

      {past.length > 0 ? (
        <section className="mb-8">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Session history</h3>
          <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white p-2">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-400">
                <tr><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Subject</th><th className="py-2 pr-3">Student</th><th className="py-2 pr-3">Length</th><th className="py-2 pr-3">Outcome</th><th className="py-2 pr-3">Earning</th><th className="py-2">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {past.map((b) => <HistoryRow key={b.id} b={b} tz={tz} earning={earningByBooking.get(b.id)} />)}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {payouts.length > 0 ? (
        <section className="mb-8">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Payout history</h3>
          <div className="space-y-2">
            {payouts.map((e, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm">
                <span className="text-ink-600">Paid {e.paid_at ? formatDayHeading(e.paid_at, tz) : ""}</span>
                <span className="font-medium text-ink-900">{formatCents(e.amount_cents)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-400">Payouts are processed manually by African Tutors.</p>
        </section>
      ) : null}

      <section>
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Availability</h3>
        <AvailabilityManager tutorId={tutorId} timezone={tz} blocks={(avail ?? []) as AvailabilityBlock[]} exceptions={(exc ?? []) as ExceptionRow[]} />
      </section>
    </DashboardShell>
  );
}
