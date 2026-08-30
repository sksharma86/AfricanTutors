import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminWhen } from "@/components/dashboard/admin-when";
import { ManagementNotifyRetry } from "@/components/dashboard/management-notify-retry";
import { ManagementRecordingAccess } from "@/components/dashboard/management-recording-access";
import { ManagementStatusLabel } from "@/components/dashboard/management-status-pill";
import { ManagementStudyHallActions } from "@/components/dashboard/management-study-hall-actions";
import { ADMIN_PORTAL_NAV } from "@/components/dashboard/dashboard-shell";
import { ManagementPage } from "@/components/dashboard/management-page";
import { requireRole } from "@/lib/auth";
import { BOOKING_STATUS_LABEL, type BookingStatus } from "@/lib/booking-config";
import { bookingChildCount, bookingChildNames, firstNameOf } from "@/lib/household-children.mjs";
import { formatCents } from "@/lib/pricing";
import { currentAssignmentForBooking } from "@/lib/guide-attendance.mjs";
import { currentStudyHallIssues, managementOperationalStatus } from "@/lib/management-ops.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Study Hall · Management" };
export const dynamic = "force-dynamic";

export default async function AdminStudyHallDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  await requireRole("admin", `/dashboard/admin/study-halls/${bookingId}`);
  const supabase = await createSupabaseServerClient();

  const householdSelect =
    "id, public_reference, account_id, student_id, tutor_id, student_first_name, student_first_names, child_count, student_grade, tutor_display_name, scheduled_start, scheduled_end, duration_minutes, status, is_free_trial, price_cents, payment_status, request_note, created_at, students!student_id(full_name, timezone)";
  const legacySelect =
    "id, public_reference, account_id, student_id, tutor_id, student_first_name, student_grade, tutor_display_name, scheduled_start, scheduled_end, duration_minutes, status, is_free_trial, price_cents, payment_status, request_note, created_at, students!student_id(full_name, timezone)";
  const first = await supabase!.from("bookings").select(householdSelect).eq("id", bookingId).maybeSingle();
  const raw =
    first.data ??
    (first.error && /student_first_names|child_count/i.test(first.error.message)
      ? (await supabase!.from("bookings").select(legacySelect).eq("id", bookingId).maybeSingle()).data
      : null);
  if (!raw) notFound();

  const [
    parentRes,
    presenceRes,
    cancelRes,
    escRes,
    notifyRes,
    recRes,
    reportRes,
    attRes,
    payRes,
  ] = await Promise.all([
    supabase!.from("profiles").select("id, display_name, phone_e164").eq("id", raw.account_id).maybeSingle(),
    supabase!
      .from("session_presence")
      .select("student_first_joined_at, tutor_first_joined_at, student_last_seen_at, tutor_last_seen_at, student_last_left_at, tutor_last_left_at")
      .eq("booking_id", bookingId)
      .maybeSingle(),
    supabase!
      .from("tutor_cancellation_requests")
      .select("id, reason, status, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false }),
    supabase!
      .from("parent_escalation_requests")
      .select("id, reason, status, outcome, call_status, sms_status, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false })
      .then((r) => r, () => ({ data: null, error: null })),
    supabase!
      .from("email_deliveries")
      .select("id, notification_type, to_email, status, error, updated_at")
      .eq("booking_id", bookingId)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase!
      .from("session_recordings")
      .select("id, status, duration_seconds, completed_at, retention_until, deleted_at")
      .eq("booking_id", bookingId)
      .then((r) => r, () => ({ data: null, error: null })),
    supabase!
      .from("session_reports")
      .select("id, created_at")
      .eq("booking_id", bookingId)
      .then((r) => r, () => ({ data: null, error: null })),
    supabase!
      .from("guide_attendance_assignments")
      .select("id, booking_id, tutor_id, source, status, requested_at, deadline_at, confirmed_at, missed_at, resolved_at, resolution, created_at")
      .eq("booking_id", bookingId)
      .then((r) => r, () => ({ data: null, error: { message: "unavailable" } })),
    supabase!
      .from("payments")
      .select("id, purpose, status, gross_cents, stripe_paid_cents, credit_applied_cents, refunded_cents")
      .eq("booking_id", bookingId),
  ]);

  const students = raw.students as { full_name?: string | null; timezone?: string | null } | null;
  const openCancel = ((cancelRes.data ?? []) as { status: string }[]).some((r) => r.status === "open");
  const failedEmails = ((notifyRes.data ?? []) as { id: string; status: string }[]).filter((n) => n.status === "failed");
  const failedRecs = ((recRes.data ?? []) as { status: string }[]).filter((r) => r.status === "failed");
  const assignmentsLoaded = !attRes.error;
  const attendance = assignmentsLoaded
    ? currentAssignmentForBooking((attRes.data ?? []) as never, raw as never)
    : null;
  const issues = currentStudyHallIssues(raw as never, {
    presence: presenceRes.data ?? null,
    cancelOpen: openCancel,
    escalations: (escRes.data ?? []) as object[],
    emailFailures: failedEmails,
    recordingFailures: failedRecs,
    missingReport: ((reportRes.data ?? []) as unknown[]).length === 0 && raw.status === "completed",
    attendance,
    assignmentsLoaded,
  });
  const layer = managementOperationalStatus(raw as never, {
    presence: (presenceRes.data ?? null) as never,
    issues,
  });
  const canAct = raw.status === "confirmed" || raw.status === "pending";
  const recordings = (recRes.data ?? []) as {
    id: string;
    status: string;
    duration_seconds: number | null;
    completed_at: string | null;
    retention_until: string | null;
    deleted_at: string | null;
  }[];

  return (
    <ManagementPage navItems={ADMIN_PORTAL_NAV} wide>
      <h1 className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">Study Hall</h1>
      <p className="mb-5">
        <Link href="/dashboard/admin/study-halls" className="text-sm font-medium text-ink-500 hover:text-ink-800">
          ← Study Halls
        </Link>
      </p>

      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 pb-5">
        <div>
          <p className="font-display text-2xl font-semibold text-ink-900">
            {bookingChildNames(raw as { student_first_names?: string[] | null; student_first_name?: string | null }, students?.full_name ?? "Child")}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {raw.tutor_display_name ? `Guide: ${raw.tutor_display_name}` : "No Guide assigned"}
          </p>
        </div>
        <ManagementStatusLabel status={layer} />
      </header>

      {issues.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">
            {issues.length === 1 ? "Current issue" : "Current issues"}
          </h2>
          <ul className="mt-3 divide-y divide-ink-100">
            {issues.map((issue) => (
              <li key={issue.kind} className="py-3">
                <p className="text-sm font-semibold text-ink-900">{issue.title}</p>
                <p className="mt-0.5 text-sm text-ink-600">{issue.summary}</p>
                {issue.detail ? <p className="mt-0.5 text-sm text-ink-500">{issue.detail}</p> : null}
                {issue.kind === "notify" && failedEmails[0] ? (
                  <div className="mt-2">
                    <ManagementNotifyRetry deliveryId={failedEmails[0].id} />
                  </div>
                ) : null}
                {(issue.kind === "needs_guide" ||
                  issue.kind === "coverage" ||
                  issue.kind === "guide_confirm_missed" ||
                  issue.kind === "guide_confirm_awaiting" ||
                  issue.kind === "guide_confirm_critical") &&
                canAct ? (
                  <div className="mt-3">
                    <ManagementStudyHallActions
                      bookingId={bookingId}
                      canAct={canAct}
                      needsGuide={!raw.tutor_id || issue.kind === "coverage" || issue.kind === "guide_confirm_missed" || issue.kind === "guide_confirm_critical"}
                      coverageCancel={issue.kind === "guide_confirm_missed" || issue.kind === "guide_confirm_awaiting" || issue.kind === "guide_confirm_critical"}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <Row label="When">
          <AdminWhen iso={raw.scheduled_start} familyTz={students?.timezone} />
        </Row>
        <Row label="Length">{raw.duration_minutes ? `${raw.duration_minutes / 60} hour${raw.duration_minutes === 60 ? "" : "s"}` : "—"}</Row>
        <Row label="Parent">{parentRes.data?.display_name ?? "—"}</Row>
        <Row label={bookingChildCount(raw as { student_first_names?: string[] | null; child_count?: number | null }) > 1 ? "Children" : "Child"}>
          {Array.isArray((raw as { student_first_names?: string[] }).student_first_names) &&
          ((raw as { student_first_names?: string[] }).student_first_names?.length ?? 0) > 1
            ? (((raw as { student_first_names?: string[] }).student_first_names ?? []).map((n) => firstNameOf(n)).join(", "))
            : `${students?.full_name ?? raw.student_first_name ?? "—"}${raw.student_grade ? ` · Grade ${raw.student_grade}` : ""}`}
        </Row>
        <Row label="Booking reference">{raw.public_reference}</Row>
        <Row label="Internal status">{BOOKING_STATUS_LABEL[raw.status as BookingStatus] ?? raw.status}</Row>
        <Row label="Payment">
          {raw.is_free_trial
            ? "Free session"
            : `${raw.payment_status.replace(/_/g, " ")} · ${formatCents(raw.price_cents ?? 0)}`}
        </Row>
        <Row label="Joined">
          {presenceRes.data?.student_first_joined_at || presenceRes.data?.tutor_first_joined_at
            ? "Someone joined"
            : "No one has joined yet"}
        </Row>
      </dl>

      {raw.request_note ? (
        <p className="mt-5 text-sm text-ink-600">
          Parent note: {raw.request_note}
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">Actions</h2>
        <p className="mt-2 text-sm text-ink-500">
          Automatic reassignment runs when a Guide becomes unavailable. Open requests mean coverage could not be
          restored — Assign Guide (eligible Guides only) or cancel. Successful reassignment stays invisible to the parent.
        </p>
        <div className="mt-3">
          <ManagementStudyHallActions
            bookingId={bookingId}
            canAct={canAct}
            needsGuide={!raw.tutor_id}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">Guide report</h2>
        <p className="mt-2 text-sm text-ink-600">
          {(reportRes.data ?? []).length > 0 ? "Report submitted." : "No report yet."}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">Recording</h2>
        <div className="mt-2 space-y-2 text-sm text-ink-600">
          {recordings.length === 0 ? <p>No recording yet.</p> : recordings.map((r) => (
            <RecordingLine key={r.id} rec={r} />
          ))}
        </div>
      </section>

      <details className="mt-10 group">
        <summary className="cursor-pointer text-sm font-semibold tracking-wide text-ink-400 uppercase">
          History and diagnostics
        </summary>
        <p className="mt-2 text-sm text-ink-500">
          Past notification attempts, recording events, and coverage requests. These do not change operational status
          unless a current issue is still open above.
        </p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">Call Parent</h2>
        <HistoryList
          empty="No Call Parent events."
          rows={((escRes.data ?? []) as { id: string; reason: string; status: string; outcome: string | null; created_at: string }[]).map((e) => ({
            id: e.id,
            title: e.outcome === "failed" || e.status === "failed" ? "Did not reach the parent" : e.reason.replace(/_/g, " "),
            meta: `${e.status}${e.outcome ? ` · ${e.outcome}` : ""}`,
            at: e.created_at,
          }))}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">Notifications</h2>
        <HistoryList
          empty="No messages recorded for this Study Hall."
          rows={((notifyRes.data ?? []) as { id: string; notification_type: string; status: string; error: string | null; updated_at: string }[]).map((n) => ({
            id: n.id,
            title: deliveryHistoryTitle(n.notification_type, n.status),
            meta: n.error ?? n.status,
            at: n.updated_at,
            retryId: n.status === "failed" ? n.id : null,
          }))}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">Payments</h2>
        <HistoryList
          empty="No payment rows."
          rows={((payRes.data ?? []) as { id: string; purpose: string; status: string; stripe_paid_cents: number }[]).map((p) => ({
            id: p.id,
            title: p.purpose,
            meta: `${p.status} · ${formatCents(p.stripe_paid_cents)}`,
            at: null,
          }))}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">Coverage requests</h2>
        <HistoryList
          empty="No Guide cancellation requests."
          rows={((cancelRes.data ?? []) as { id: string; status: string; reason: string | null; created_at: string }[]).map((r) => ({
            id: r.id,
            title: r.status === "open" ? "Could not find a replacement Guide" : "Coverage request resolved",
            meta: r.reason ?? r.status,
            at: r.created_at,
          }))}
        />
      </section>

      <p className="mt-10 text-xs text-ink-400">
        Created <AdminWhen iso={raw.created_at} />
        {parentRes.data?.phone_e164 ? " · Parent phone on file" : null}
      </p>
      </details>
    </ManagementPage>
  );
}

function deliveryHistoryTitle(type: string, status: string) {
  if (type === "guide_attendance_whatsapp") {
    return status === "failed" ? "Guide WhatsApp alert failed" : "Guide WhatsApp alert";
  }
  if (type === "guide_attendance_request") {
    return status === "failed" ? "Guide attendance email failed" : "Guide attendance email";
  }
  if (status === "failed") return "Parent wasn't notified";
  return type.replace(/_/g, " ");
}

function Row({ label, children }: { label: string; children: import("react").ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">{label}</dt>
      <dd className="mt-1 text-ink-800">{children}</dd>
    </div>
  );
}

function HistoryList({
  empty,
  rows,
}: {
  empty: string;
  rows: { id: string; title: string; meta: string; at: string | null; retryId?: string | null }[];
}) {
  if (rows.length === 0) return <p className="mt-2 text-sm text-ink-500">{empty}</p>;
  return (
    <ul className="mt-2 divide-y divide-ink-100 text-sm">
      {rows.map((r) => (
        <li key={r.id} className="py-2">
          <p className="text-ink-800">
            {r.title}
            {r.retryId ? <ManagementNotifyRetry deliveryId={r.retryId} /> : null}
          </p>
          <p className="text-xs text-ink-400">
            {r.meta}
            {r.at ? (
              <>
                {" · "}
                <AdminWhen iso={r.at} className="inline-block align-baseline" />
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
}

function RecordingLine({
  rec,
}: {
  rec: {
    id: string;
    status: string;
    duration_seconds: number | null;
    retention_until: string | null;
    deleted_at: string | null;
  };
}) {
  if (rec.deleted_at) return <p>Recording deleted after retention.</p>;
  if (rec.status === "failed") return <p>Recording unavailable.</p>;
  if (rec.status === "completed") {
    return <ManagementRecordingAccess id={rec.id} minutes={rec.duration_seconds ? Math.round(rec.duration_seconds / 60) : null} />;
  }
  return <p>Recording processing{rec.duration_seconds ? ` · ${Math.round(rec.duration_seconds / 60)} min` : ""}.</p>;
}
