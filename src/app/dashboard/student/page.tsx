import type { Metadata } from "next";
import Link from "next/link";

import { CustomerBookingActions } from "@/components/dashboard/customer-booking-actions";
import { CustomerShell } from "@/components/dashboard/customer-shell";
import { BalanceCards } from "@/components/dashboard/balance-cards";
import { SessionCard } from "@/components/dashboard/session-card";
import { LinkButton } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { TrustSignals } from "@/components/ui/trust-signals";
import { requireRole } from "@/lib/auth";
import { type BookingStatus } from "@/lib/booking-config";
import { partitionBookings } from "@/lib/bookings";
import { formatDuration } from "@/lib/format.mjs";
import { customerBookingStatus, issueStatus } from "@/lib/status-labels.mjs";
import { customerJoinState } from "@/lib/session-window.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDayHeading, formatTime, tzAbbreviation } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Dashboard",
};

interface BookingRow {
  id: string;
  student_id: string;
  public_reference: string;
  subject_name: string | null;
  other_subject_text: string | null;
  request_note: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  duration_minutes: number | null;
  status: BookingStatus;
  is_free_trial: boolean;
  payment_status: string;
  tutor_display_name: string | null;
  students: { full_name: string; timezone: string } | null;
}

const DEFAULT_TZ = "America/Chicago";

function subjectOf(b: BookingRow): string {
  return b.subject_name ?? (b.other_subject_text ? `Other — ${b.other_subject_text}` : "Tutoring session");
}

function whenLabelOf(b: BookingRow): string | undefined {
  if (!b.scheduled_start) return undefined;
  const tz = b.students?.timezone || DEFAULT_TZ;
  return `${formatDayHeading(b.scheduled_start, tz)}, ${formatTime(b.scheduled_start, tz)} (${tzAbbreviation(b.scheduled_start, tz)})`;
}

// Date.now() kept out of the component render body (RSC purity).
function joinInfoOf(b: BookingRow) {
  return customerJoinState(b.status, b.scheduled_start, b.scheduled_end, Date.now());
}

function openAtLabel(openAtISO: string | null, tz: string): string {
  if (!openAtISO) return "soon";
  return `${formatTime(openAtISO, tz)} (${tzAbbreviation(openAtISO, tz)})`;
}

export default async function StudentDashboardPage() {
  await requireRole("student", "/dashboard/student");
  const supabase = await createSupabaseServerClient();

  const { data: userData } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const uid = userData?.user?.id ?? null;

  const [{ data: bookingsRaw }, { data: myStudents }, balancesRes, disputeRes] = await Promise.all([
    supabase
      ? supabase
          .from("bookings")
          .select(
            "id, student_id, public_reference, subject_name, other_subject_text, request_note, scheduled_start, scheduled_end, duration_minutes, status, is_free_trial, payment_status, tutor_display_name, students(full_name, timezone)",
          )
          .order("scheduled_start", { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: null }),
    supabase
      ? supabase.from("students").select("id, full_name, grade_level").order("created_at").limit(50)
      : Promise.resolve({ data: null }),
    uid && supabase ? supabase.rpc("get_customer_balances", { p_account: uid }) : Promise.resolve({ data: null }),
    supabase ? supabase.rpc("list_my_dispute_statuses") : Promise.resolve({ data: null }),
  ]);

  const bookings = (bookingsRaw ?? []) as unknown as BookingRow[];
  const students = (myStudents ?? []) as { id: string; full_name: string; grade_level: string | null }[];
  const balances = (balancesRes?.data ?? {}) as { package_minutes?: number; dollar_credit_cents?: number };
  const minutes = balances.package_minutes ?? 0;
  const creditCents = balances.dollar_credit_cents ?? 0;

  const issueByBooking = new Map<string, string>();
  for (const d of (disputeRes?.data ?? []) as { booking_id: string; status: string }[]) {
    issueByBooking.set(d.booking_id, d.status);
  }

  // Per-student free-trial state (the trial belongs to the student, not the login).
  type TrialState = "Available" | "Booked" | "Used";
  const trialByStudent = new Map<string, TrialState>();
  for (const s of students) {
    const trial = bookings.find((b) => b.student_id === s.id && b.is_free_trial && b.status !== "cancelled");
    trialByStudent.set(
      s.id,
      !trial ? "Available" : trial.status === "completed" || trial.status === "no_show" ? "Used" : "Booked",
    );
  }
  const freeTrialAvailable =
    students.length === 0 || Array.from(trialByStudent.values()).some((v) => v === "Available");

  const { upcoming, past, next } = partitionBookings(bookings);
  const laterUpcoming = upcoming.filter((b) => b.id !== next?.id);

  const firstName = (userData?.user?.user_metadata?.display_name as string | undefined)?.split(" ")[0];

  function primaryAction(b: BookingRow) {
    const tz = b.students?.timezone || DEFAULT_TZ;
    const { state, openAtISO } = joinInfoOf(b);
    if (state === "join") {
      return (
        <LinkButton href={`/dashboard/session/${b.id}`} variant="secondary" size="sm">
          Join session
        </LinkButton>
      );
    }
    if (state === "opens_at") {
      return (
        <span className="text-xs font-medium text-ink-500">Opens at {openAtLabel(openAtISO, tz)}</span>
      );
    }
    if (state === "not_scheduled") {
      return <span className="text-xs font-medium text-ink-500">Time to be arranged</span>;
    }
    return null;
  }

  function cardFor(b: BookingRow, opts: { featured?: boolean; history?: boolean } = {}) {
    const status = customerBookingStatus(b.status, b.payment_status);
    const issue = issueByBooking.get(b.id);
    const issueView = issue ? issueStatus(issue) : null;
    return (
      <SessionCard
        key={b.id}
        subject={subjectOf(b)}
        isFreeTrial={b.is_free_trial}
        whenLabel={whenLabelOf(b)}
        durationLabel={b.duration_minutes ? formatDuration(b.duration_minutes) : undefined}
        personLabel={b.students?.full_name}
        tutorLabel={b.tutor_display_name ? `Tutor: ${b.tutor_display_name}` : undefined}
        focus={!opts.history && b.request_note ? b.request_note : undefined}
        statusLabel={status.label}
        statusTone={status.tone as StatusTone}
        featured={opts.featured}
        primaryAction={opts.history ? undefined : primaryAction(b)}
        secondaryActions={
          <div className="flex flex-wrap items-center justify-between gap-3">
            {issueView ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
                Reported issue: <StatusBadge tone={issueView.tone as StatusTone}>{issueView.label}</StatusBadge>
              </span>
            ) : (
              <span className="text-xs text-ink-400">Ref {b.public_reference}</span>
            )}
            <CustomerBookingActions
              bookingId={b.id}
              canCancel={b.status === "pending" || b.status === "confirmed"}
              canDispute={(b.status === "completed" || b.status === "no_show") && !issue}
              scheduledStartISO={b.scheduled_start}
            />
          </div>
        }
      />
    );
  }

  return (
    <CustomerShell>
      <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
        {/* Welcome / free-trial hero */}
        {freeTrialAvailable ? (
          <section className="at-fade-in overflow-hidden rounded-3xl bg-ink-900 p-7 sm:p-9">
            <p className="text-xs font-semibold tracking-[0.14em] text-gold-300 uppercase">
              New student offer
            </p>
            <h1 className="mt-2 max-w-xl font-display text-3xl font-semibold text-white sm:text-4xl">
              Your first 30-minute session is free.
            </h1>
            <p className="mt-2 max-w-lg text-base leading-7 text-ink-200">
              A real one-on-one session with an approved African Tutors tutor. No credit card required.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <LinkButton href="/dashboard/student/book" variant="secondary" size="lg">
                Book my free session
              </LinkButton>
              <Link
                href="/dashboard/student/packages"
                className="text-sm font-medium text-gold-200 hover:text-gold-100"
              >
                See tutoring packages →
              </Link>
            </div>
          </section>
        ) : (
          <section className="at-fade-in flex flex-col gap-4 rounded-3xl border border-ink-100 bg-white p-7 shadow-[0_8px_24px_-18px_rgba(19,19,17,0.25)] sm:flex-row sm:items-center sm:justify-between sm:p-9">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-gold-700 uppercase">Welcome back</p>
              <h1 className="mt-1.5 font-display text-3xl font-semibold text-ink-900">
                {firstName ? `Hi ${firstName}` : "Ready for the next session?"}
              </h1>
              <p className="mt-1.5 text-sm text-ink-500">Book a session or manage your upcoming tutoring below.</p>
            </div>
            <LinkButton href="/dashboard/student/book" variant="primary" size="lg">
              Book a session
            </LinkButton>
          </section>
        )}

        <TrustSignals className="mt-5" />

        {/* Balances */}
        <div className="mt-8">
          <SectionHeader title="Your account" />
          <BalanceCards minutes={minutes} creditCents={creditCents} />
        </div>

        {/* Next session */}
        <div className="mt-8">
          <SectionHeader title="Next session" />
          {next ? (
            cardFor(next, { featured: true })
          ) : (
            <EmptyState
              title="You're all caught up"
              description="Book your next tutoring session whenever you're ready."
              actionHref="/dashboard/student/book"
              actionLabel="Book a session"
              icon={
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
                  <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
                </svg>
              }
            />
          )}
        </div>

        {/* Upcoming */}
        {laterUpcoming.length > 0 ? (
          <div className="mt-8">
            <SectionHeader title="Upcoming sessions" />
            <div className="space-y-3">{laterUpcoming.map((b) => cardFor(b))}</div>
          </div>
        ) : null}

        {/* Sessions history */}
        <div id="sessions" className="mt-8 scroll-mt-20">
          <SectionHeader
            title="Session history"
            action={
              minutes <= 0 ? (
                <Link href="/dashboard/student/packages" className="text-sm font-medium text-gold-700 hover:underline">
                  View packages →
                </Link>
              ) : undefined
            }
          />
          {past.length > 0 ? (
            <div className="space-y-3">{past.map((b) => cardFor(b, { history: true }))}</div>
          ) : (
            <EmptyState
              title="No sessions yet"
              description="Your completed tutoring sessions will appear here."
              icon={
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              }
            />
          )}
        </div>

        {/* Account / students */}
        <div id="account" className="mt-8 scroll-mt-20">
          <SectionHeader
            title="Students"
            action={
              <span className="text-xs text-ink-400">One account can book for multiple students</span>
            }
          />
          {students.length > 0 ? (
            <div className="space-y-2">
              {students.map((s) => {
                const state = trialByStudent.get(s.id) ?? "Available";
                const tone = state === "Available" ? "info" : state === "Booked" ? "neutral" : "neutral";
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-ink-100 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink-900">{s.full_name}</p>
                      {s.grade_level ? <p className="text-xs text-ink-400">Grade {s.grade_level}</p> : null}
                    </div>
                    <StatusBadge tone={tone}>Free trial: {state}</StatusBadge>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No students added yet"
              description="Add a student when you book your first session."
              actionHref="/dashboard/student/book"
              actionLabel="Book a session"
            />
          )}
        </div>
      </div>
    </CustomerShell>
  );
}
