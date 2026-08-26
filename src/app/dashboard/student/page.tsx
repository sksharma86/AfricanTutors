import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CustomerBookingActions } from "@/components/dashboard/customer-booking-actions";
import { CustomerShell } from "@/components/dashboard/customer-shell";
import { BalanceCards } from "@/components/dashboard/balance-cards";
import { ParentPhoneForm } from "@/components/dashboard/parent-phone-form";
import { SessionCard } from "@/components/dashboard/session-card";
import {
  SessionReportsList,
  type ParentSessionReport,
} from "@/components/dashboard/session-reports-list";
import { LinkButton } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { requireRole } from "@/lib/auth";
import { type BookingStatus } from "@/lib/booking-config";
import { partitionBookings } from "@/lib/bookings";
import { accountFreeTrialUsed } from "@/lib/free-trial.mjs";
import { formatDuration } from "@/lib/format.mjs";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { isRecordingPlayable } from "@/lib/recording-retention.mjs";
import { customerBookingStatus, issueStatus } from "@/lib/status-labels.mjs";
import type { FocusRating, RedirectionLevel } from "@/lib/session-report.mjs";
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

function sessionTitle(_b: BookingRow): string {
  void _b;
  return "Study Hall";
}

function whenLabelOf(b: BookingRow): string | undefined {
  if (!b.scheduled_start) return undefined;
  const tz = b.students?.timezone || DEFAULT_TZ;
  return `${formatDayHeading(b.scheduled_start, tz)}, ${formatTime(b.scheduled_start, tz)} (${tzAbbreviation(b.scheduled_start, tz)})`;
}

function joinInfoOf(b: BookingRow) {
  return customerJoinState(b.status, b.scheduled_start, b.scheduled_end, Date.now());
}

export default async function StudentDashboardPage() {
  const user = await requireRole("student", "/dashboard/student");
  const applicant = await getGuideApplicantInfo(user.id);
  if (applicant) {
    redirect("/dashboard/applicant");
  }
  const supabase = await createSupabaseServerClient();

  // One-time parent welcome (idempotent key welcome:<accountId>). Not sent to Guides/applicants.
  try {
    const { notifyWelcome } = await import("@/lib/notify");
    await notifyWelcome(user.id, user.displayName ?? user.email ?? null);
  } catch {
    /* best-effort — never block dashboard */
  }

  const { data: userData } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const uid = userData?.user?.id ?? null;

  const [{ data: bookingsRaw }, { data: myStudents }, balancesRes, disputeRes, reportsRes, phoneRes, escalationsRes] =
    await Promise.all([
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
      supabase
        ? supabase
            .from("session_reports")
            .select(
              "id, submitted_at, focus_rating, work_summary, redirection_level, guide_note, booking_id, bookings(scheduled_start, duration_minutes, student_first_name, tutor_display_name, students(full_name, timezone))",
            )
            .order("submitted_at", { ascending: false })
            .then(
              (r) => r,
              () => ({ data: null, error: null }),
            )
        : Promise.resolve({ data: null, error: null }),
      uid && supabase
        ? supabase.from("profiles").select("phone_e164").eq("id", uid).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        ? supabase
            .from("parent_escalation_requests")
            .select("booking_id")
            .then(
              (r) => r,
              () => ({ data: null, error: null }),
            )
        : Promise.resolve({ data: null, error: null }),
    ]);

  const reportBookingIds = (
    reportsRes && "error" in reportsRes && reportsRes.error
      ? []
      : ((reportsRes?.data ?? []) as { booking_id: string }[])
  ).map((r) => r.booking_id);
  const uniqueReportBookings = Array.from(new Set(reportBookingIds.filter(Boolean)));
  const recordingsRes =
    supabase && uniqueReportBookings.length
      ? await supabase
          .from("session_recordings")
          .select("id, booking_id, status, retention_until, deleted_at, daily_recording_id, completed_at")
          .in("booking_id", uniqueReportBookings)
          .then(
            (r) => r,
            () => ({ data: null, error: null }),
          )
      : { data: null, error: null };
  const bookings = (bookingsRaw ?? []) as unknown as BookingRow[];
  const students = (myStudents ?? []) as { id: string; full_name: string; grade_level: string | null }[];
  const balances = (balancesRes?.data ?? {}) as { package_minutes?: number; dollar_credit_cents?: number };
  const minutes = balances.package_minutes ?? 0;
  const creditCents = balances.dollar_credit_cents ?? 0;
  const parentPhone =
    phoneRes && "data" in phoneRes && phoneRes.data && typeof (phoneRes.data as { phone_e164?: string }).phone_e164 === "string"
      ? (phoneRes.data as { phone_e164: string }).phone_e164
      : null;

  const issueByBooking = new Map<string, string>();
  for (const d of (disputeRes?.data ?? []) as { booking_id: string; status: string }[]) {
    issueByBooking.set(d.booking_id, d.status);
  }

  const escalatedBookings = new Set(
    escalationsRes && "error" in escalationsRes && escalationsRes.error
      ? []
      : ((escalationsRes?.data ?? []) as { booking_id: string }[]).map((e) => e.booking_id),
  );

  type ReportJoin = {
    id: string;
    booking_id: string;
    submitted_at: string;
    focus_rating: FocusRating;
    work_summary: string;
    redirection_level: RedirectionLevel;
    guide_note: string | null;
    bookings: {
      scheduled_start: string | null;
      duration_minutes: number | null;
      student_first_name: string | null;
      tutor_display_name: string | null;
      students: { full_name: string; timezone: string } | null;
    } | null;
  };

  type RecRow = {
    id: string;
    booking_id: string;
    status: string;
    retention_until: string | null;
    deleted_at: string | null;
    daily_recording_id: string | null;
    completed_at: string | null;
  };

  const recordingByBooking = new Map<string, RecRow>();
  for (const rec of (
    recordingsRes && "error" in recordingsRes && recordingsRes.error
      ? []
      : ((recordingsRes?.data ?? []) as RecRow[])
  )) {
    const prev = recordingByBooking.get(rec.booking_id);
    if (!prev || (rec.status === "completed" && prev.status !== "completed")) {
      recordingByBooking.set(rec.booking_id, rec);
    }
  }

  const parentReports: ParentSessionReport[] = (
    reportsRes && "error" in reportsRes && reportsRes.error
      ? []
      : ((reportsRes?.data ?? []) as unknown as ReportJoin[])
  ).map((r) => {
    const full = r.bookings?.students?.full_name?.trim() || "";
    const first = full ? full.split(/\s+/)[0]! : r.bookings?.student_first_name || "Your child";
    const rec = recordingByBooking.get(r.booking_id) ?? null;
    return {
      id: r.id,
      booking_id: r.booking_id,
      submitted_at: r.submitted_at,
      focus_rating: r.focus_rating,
      work_summary: r.work_summary,
      redirection_level: r.redirection_level,
      guide_note: r.guide_note,
      child_first_name: first,
      guide_name: r.bookings?.tutor_display_name ?? null,
      scheduled_start: r.bookings?.scheduled_start ?? null,
      duration_minutes: r.bookings?.duration_minutes ?? null,
      timezone: r.bookings?.students?.timezone || DEFAULT_TZ,
      had_parent_escalation: escalatedBookings.has(r.booking_id),
      recording: rec
        ? {
            id: rec.id,
            status: rec.status,
            retention_until: rec.retention_until,
            deleted_at: rec.deleted_at,
            playable: isRecordingPlayable(rec),
          }
        : null,
    };
  });

  const freeTrialAvailable = !accountFreeTrialUsed(bookings);
  const { upcoming, past, next } = partitionBookings(bookings);
  const laterUpcoming = upcoming.filter((b) => b.id !== next?.id);
  const firstName = (userData?.user?.user_metadata?.display_name as string | undefined)?.split(" ")[0];

  function primaryAction(b: BookingRow) {
    const { state } = joinInfoOf(b);
    if (state === "join") {
      return (
        <LinkButton href={`/dashboard/session/${b.id}`} variant="secondary" size="sm">
          Join Study Hall
        </LinkButton>
      );
    }
    if (state === "opens_at") {
      return (
        <span className="text-xs font-medium text-ink-500">Ready to join 5 minutes before start</span>
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
        subject={sessionTitle(b)}
        isFreeTrial={b.is_free_trial}
        whenLabel={whenLabelOf(b)}
        durationLabel={b.duration_minutes ? formatDuration(b.duration_minutes) : undefined}
        personLabel={b.students?.full_name}
        tutorLabel={
          b.tutor_display_name
            ? `Guide: ${b.tutor_display_name}`
            : b.status === "confirmed" || b.status === "pending"
              ? "Guide: Matching an available Guide"
              : undefined
        }
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
      <div className="mx-auto w-full max-w-5xl px-5 py-7 sm:px-6 sm:py-8 lg:px-8">
        {/* Welcome */}
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-ink-500">Study Hall (at home)</p>
            <h1 className="mt-1 font-display text-3xl font-medium text-ink-900 sm:text-4xl">
              {firstName ? `Hi ${firstName}` : "Welcome"}
            </h1>
          </div>
          <LinkButton href="/dashboard/student/book" variant="primary" size="lg" className="w-full sm:w-auto">
            Book a Study Hall
          </LinkButton>
        </section>

        {/* Free session — only when eligible */}
        {freeTrialAvailable ? (
          <section className="mt-6 rounded-[22px] border border-forest-200 bg-forest-50/70 p-5 sm:p-6">
            <p className="text-sm font-semibold text-forest-800">Your first Study Hall is on us</p>
            <p className="mt-1 text-sm text-ink-600">60 minutes free · No credit card required</p>
            <div className="mt-4">
              <LinkButton href="/dashboard/student/book" variant="primary" size="sm">
                Book free session
              </LinkButton>
            </div>
          </section>
        ) : null}

        {!parentPhone ? (
          <section className="mt-4 rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-600 sm:px-5">
            Add a phone number in{" "}
            <a href="#account" className="font-medium text-ink-800 underline-offset-4 hover:underline">
              Account
            </a>{" "}
            so Study Hall (at home) can reach you if a Guide uses Call Parent during a session. Your number is never
            shown to Guides and is not sold or shared with third parties.
          </section>
        ) : null}

        {/* Next Study Hall — primary focus */}
        <div className="mt-8">
          <SectionHeader title="Next Study Hall" />
          {next ? (
            cardFor(next, { featured: true })
          ) : (
            <EmptyState
              title="No upcoming Study Hall"
              description="Book a Study Hall whenever you’re ready — homework gets done, you get your evening back."
              actionHref="/dashboard/student/book"
              actionLabel="Book a Study Hall"
              icon={
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
                  <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
                </svg>
              }
            />
          )}
        </div>

        {/* Prepaid Hours (unused package balance) */}
        <div className="mt-8">
          <SectionHeader title="Prepaid Hours" />
          <BalanceCards minutes={minutes} creditCents={creditCents} preferFreeSession={freeTrialAvailable} />
        </div>

        {/* Upcoming */}
        {laterUpcoming.length > 0 ? (
          <div className="mt-8">
            <SectionHeader title="Upcoming Study Halls" />
            <div className="space-y-3">{laterUpcoming.map((b) => cardFor(b))}</div>
          </div>
        ) : null}

        {/* Past sessions */}
        <div id="sessions" className="mt-8 scroll-mt-20">
          <SectionHeader title="Past Study Halls" />
          {past.length > 0 ? (
            <div className="space-y-3">{past.map((b) => cardFor(b, { history: true }))}</div>
          ) : (
            <EmptyState
              title="No past Study Halls yet"
              description="Completed sessions will show up here."
              icon={
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              }
            />
          )}
        </div>

        {/* Reports + recordings */}
        <div id="reports" className="mt-8 scroll-mt-20">
          <SectionHeader title="What happened in Study Hall" />
          <p className="mb-3 text-sm text-ink-500">
            Short notes from your Guide after each session — and session recordings available for 60 days.
            These are not grades or academic assessments.
          </p>
          <SessionReportsList reports={parentReports} />
        </div>

        {/* Account */}
        <div id="account" className="mt-8 scroll-mt-20 pb-4">
          <SectionHeader title="Account" />
          <div className="mb-6">
            <ParentPhoneForm initialPhone={parentPhone} />
          </div>
          <SectionHeader
            title="Your children"
            action={
              freeTrialAvailable ? (
                <StatusBadge tone="info">Free session available</StatusBadge>
              ) : (
                <span className="text-xs text-ink-400">One account can book for multiple children</span>
              )
            }
          />
          {students.length > 0 ? (
            <div className="space-y-2">
              {students.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-ink-100 bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-ink-900">{s.full_name}</p>
                    {s.grade_level ? <p className="text-xs text-ink-400">Grade {s.grade_level}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No children added yet"
              description="Add a child when you book your first Study Hall."
              actionHref="/dashboard/student/book"
              actionLabel="Book a Study Hall"
            />
          )}
          {!freeTrialAvailable ? (
            <p className="mt-6 text-sm text-ink-500">
              Looking for prepaid hours?{" "}
              <Link href="/dashboard/student/packages#prepaid" className="font-medium text-ink-800 underline-offset-4 hover:underline">
                Buy hours &amp; save
              </Link>
            </p>
          ) : (
            <p className="mt-6 text-sm text-ink-500">
              After your free session, you can book pay-as-you-go or save with prepaid hours.
            </p>
          )}
        </div>
      </div>
    </CustomerShell>
  );
}
