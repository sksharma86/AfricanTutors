import type { Metadata } from "next";
import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { LinkButton } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { BOOKING_STATUS_LABEL, type BookingStatus } from "@/lib/booking-config";
import { partitionBookings } from "@/lib/bookings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDayHeading, formatTime, tzAbbreviation } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Student Dashboard",
};

interface BookingRow {
  id: string;
  student_id: string;
  public_reference: string;
  subject_name: string | null;
  other_subject_text: string | null;
  scheduled_start: string | null;
  duration_minutes: number | null;
  status: BookingStatus;
  is_free_trial: boolean;
  payment_status: string;
  tutor_display_name: string | null;
  students: { full_name: string; timezone: string } | null;
}

function awaitingPayment(b: BookingRow): boolean {
  return !b.is_free_trial && b.payment_status === "awaiting_payment" && (b.status === "confirmed" || b.status === "pending");
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const tone =
    status === "confirmed"
      ? "bg-gold-50 text-gold-700 border-gold-200"
      : status === "completed"
        ? "bg-ink-100 text-ink-600 border-ink-200"
        : status === "cancelled" || status === "no_show"
          ? "bg-red-50 text-red-600 border-red-200"
          : "bg-ink-50 text-ink-500 border-ink-200";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {BOOKING_STATUS_LABEL[status]}
    </span>
  );
}

function BookingCard({ b }: { b: BookingRow }) {
  const tz = b.students?.timezone ?? "America/Chicago";
  const subject = b.subject_name ?? (b.other_subject_text ? `Other — ${b.other_subject_text}` : "Session");
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-100 bg-white p-4">
      <div>
        <p className="font-medium text-ink-900">
          {subject}
          {b.is_free_trial ? <span className="ml-2 text-xs font-semibold text-gold-600">FREE TRIAL</span> : null}
        </p>
        <p className="mt-1 text-sm text-ink-500">
          {b.students?.full_name}
          {b.scheduled_start
            ? ` · ${formatDayHeading(b.scheduled_start, tz)}, ${formatTime(b.scheduled_start, tz)} (${tzAbbreviation(b.scheduled_start, tz)})`
            : " · time to be arranged"}
          {b.duration_minutes ? ` · ${b.duration_minutes} min` : ""}
        </p>
        {b.tutor_display_name ? (
          <p className="mt-0.5 text-xs text-ink-400">Tutor: {b.tutor_display_name}</p>
        ) : null}
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <StatusBadge status={b.status} />
        {awaitingPayment(b) ? (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            Payment required
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default async function StudentDashboardPage() {
  await requireRole("student", "/dashboard/student");
  const supabase = await createSupabaseServerClient();

  const { data: tutorApplication } = supabase
    ? await supabase.from("tutor_profiles").select("status").maybeSingle()
    : { data: null };

  const { data: bookingsRaw } = supabase
    ? await supabase
        .from("bookings")
        .select(
          "id, student_id, public_reference, subject_name, other_subject_text, scheduled_start, duration_minutes, status, is_free_trial, payment_status, tutor_display_name, students(full_name, timezone)",
        )
        .order("scheduled_start", { ascending: true, nullsFirst: false })
    : { data: null };
  const bookings = (bookingsRaw ?? []) as unknown as BookingRow[];

  // Per-student free-trial state (the trial belongs to the student, not the login).
  const { data: myStudents } = supabase
    ? await supabase.from("students").select("id, full_name").order("created_at").limit(50)
    : { data: null };
  type TrialState = "Available" | "Booked" | "Used";
  const trialByStudent = new Map<string, TrialState>();
  for (const s of (myStudents ?? []) as { id: string; full_name: string }[]) {
    const trial = bookings.find((b) => b.student_id === s.id && b.is_free_trial && b.status !== "cancelled");
    trialByStudent.set(
      s.id,
      !trial ? "Available" : trial.status === "completed" || trial.status === "no_show" ? "Used" : "Booked",
    );
  }
  const freeTrialAvailable =
    (myStudents ?? []).length === 0 || Array.from(trialByStudent.values()).some((v) => v === "Available");

  const { upcoming, past, next } = partitionBookings(bookings);

  return (
    <DashboardShell
      role="student"
      title="Welcome back"
      description="Book tutoring and keep track of your sessions."
      navItems={[
        { label: "Overview", available: true },
        { label: "Book a Session", available: true },
        { label: "Messages", available: false },
        { label: "Session History", available: false },
      ]}
    >
      {tutorApplication?.status === "pending" ? (
        <div className="mb-6 rounded-lg border border-gold-200 bg-gold-50 p-4 text-sm text-gold-800">
          Your tutor application is <span className="font-semibold">pending review</span>.
        </div>
      ) : null}

      {/* Free trial + CTA */}
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-ink-100 bg-ink-900 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-gold-300 uppercase">
            {freeTrialAvailable ? "New student offer" : "Book tutoring"}
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-white">
            {freeTrialAvailable ? "Your first 30 minutes are free" : "Ready for another session?"}
          </h2>
          <p className="mt-1 text-sm text-ink-200">
            {freeTrialAvailable
              ? "A real one-on-one session with an approved tutor. No credit card required."
              : "Book a 30- or 60-minute session with an approved African Tutors tutor."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <LinkButton href="/dashboard/student/book" variant="secondary" size="lg">
            Book a Session
          </LinkButton>
          <Link href="/dashboard/student/packages" className="text-sm font-medium text-gold-300 hover:text-gold-200">
            Buy tutoring minutes →
          </Link>
        </div>
      </div>

      {(myStudents ?? []).length > 0 ? (
        <div className="mb-8">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Students &amp; free trial</h3>
          <div className="space-y-2">
            {((myStudents ?? []) as { id: string; full_name: string }[]).map((s) => {
              const state = trialByStudent.get(s.id) ?? "Available";
              const tone =
                state === "Available"
                  ? "border-gold-200 bg-gold-50 text-gold-700"
                  : state === "Booked"
                    ? "border-ink-200 bg-ink-50 text-ink-600"
                    : "border-ink-200 bg-white text-ink-400";
              return (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-ink-100 bg-white px-4 py-2.5">
                  <span className="text-sm font-medium text-ink-900">{s.full_name}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>
                    Free trial: {state}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {next ? (
        <div className="mb-8">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Next session</h3>
          <BookingCard b={next} />
        </div>
      ) : null}

      <div className="mb-8">
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Upcoming &amp; requested</h3>
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-400">
            No upcoming sessions yet.{" "}
            <Link href="/dashboard/student/book" className="font-medium text-gold-700 hover:underline">
              Book one now
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
              <BookingCard key={b.id} b={b} />
            ))}
          </div>
        )}
      </div>

      {past.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Past sessions</h3>
          <div className="space-y-3">
            {past.map((b) => (
              <BookingCard key={b.id} b={b} />
            ))}
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}
