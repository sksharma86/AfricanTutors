import type { Metadata } from "next";
import Link from "next/link";

import {
  AvailabilityManager,
  type AvailabilityBlock,
  type ExceptionRow,
} from "@/components/dashboard/availability-manager";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { BOOKING_STATUS_LABEL, type BookingStatus } from "@/lib/booking-config";
import { partitionBookings } from "@/lib/bookings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDayHeading, formatTime, tzAbbreviation } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Tutor Dashboard",
};

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

function SessionCard({ b, tz }: { b: TutorBooking; tz: string }) {
  const subject = b.subject_name ?? (b.other_subject_text ? `Other — ${b.other_subject_text}` : "Session");
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-ink-900">
          {subject}
          {b.is_free_trial ? <span className="ml-2 text-xs font-semibold text-gold-600">FREE TRIAL</span> : null}
        </p>
        <div className="flex items-center gap-2">
          {b.status === "confirmed" && b.scheduled_start ? (
            <Link
              href={`/dashboard/session/${b.id}`}
              className="rounded-lg bg-gold-400 px-3 py-1 text-xs font-semibold text-ink-900 hover:bg-gold-300"
            >
              Join session
            </Link>
          ) : null}
          <span className="rounded-full border border-ink-200 bg-ink-50 px-2.5 py-0.5 text-xs font-medium text-ink-600">
            {BOOKING_STATUS_LABEL[b.status]}
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm text-ink-500">
        {b.student_first_name ?? "Student"}
        {b.student_grade ? ` · Grade ${b.student_grade}` : ""}
        {b.scheduled_start
          ? ` · ${formatDayHeading(b.scheduled_start, tz)}, ${formatTime(b.scheduled_start, tz)} (${tzAbbreviation(b.scheduled_start, tz)})`
          : ""}
        {b.duration_minutes ? ` · ${b.duration_minutes} min` : ""}
      </p>
      {b.request_note ? <p className="mt-1 text-sm text-ink-600">Focus: {b.request_note}</p> : null}
    </div>
  );
}

export default async function TutorDashboardPage() {
  await requireRole("tutor", "/dashboard/tutor");
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase!.auth.getUser();
  const tutorId = user!.id;

  const [{ data: profile }, { data: bookingsRaw }, { data: avail }, { data: exc }, { data: subs }] =
    await Promise.all([
      supabase!.from("tutor_profiles").select("timezone").eq("profile_id", tutorId).maybeSingle(),
      supabase!
        .from("bookings")
        .select(
          "id, subject_name, other_subject_text, student_first_name, student_grade, request_note, scheduled_start, duration_minutes, status, is_free_trial",
        )
        .order("scheduled_start", { ascending: true, nullsFirst: false }),
      supabase!.from("tutor_availability").select("id, day_of_week, start_time, end_time"),
      supabase!.from("tutor_availability_exceptions").select("id, starts_at, ends_at, reason"),
      supabase!.from("tutor_subjects").select("subject_id, subjects(name)"),
    ]);

  const tz = profile?.timezone ?? "Africa/Lagos";
  const bookings = (bookingsRaw ?? []) as unknown as TutorBooking[];
  const { upcoming, past } = partitionBookings(bookings);
  const approvedSubjects = ((subs ?? []) as unknown as { subjects: { name: string } | null }[])
    .map((r) => r.subjects?.name)
    .filter(Boolean) as string[];

  return (
    <DashboardShell
      role="tutor"
      title="Welcome back"
      description="Manage your sessions and availability."
      navItems={[
        { label: "Sessions", available: true },
        { label: "Availability", available: true },
        { label: "Earnings", available: false },
        { label: "Messages", available: false },
      ]}
    >
      <section className="mb-8">
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Your approved subjects</h3>
        {approvedSubjects.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 px-4 py-4 text-sm text-ink-400">
            No subjects assigned yet. An administrator assigns the subjects you&apos;re approved to teach.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {approvedSubjects.map((s) => (
              <span key={s} className="rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-sm text-gold-700">
                {s}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Upcoming sessions</h3>
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-400">
            No upcoming sessions.
          </p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
              <SessionCard key={b.id} b={b} tz={tz} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 ? (
        <section className="mb-8">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Past sessions</h3>
          <div className="space-y-3">
            {past.map((b) => (
              <SessionCard key={b.id} b={b} tz={tz} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-500 uppercase">Availability</h3>
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
