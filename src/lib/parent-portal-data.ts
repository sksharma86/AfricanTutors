import "server-only";

import { isRecordingPlayable } from "@/lib/recording-retention.mjs";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ParentBooking,
  ParentChildReport,
  ParentRecording,
  ParentReport,
  ParentStudent,
} from "@/lib/parent-portal-types";

export type { ParentBooking, ParentRecording, ParentReport, ParentStudent };

type SB = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export async function loadParentWorkspace(supabase: SB, uid: string) {
  const [
    bookingsRes,
    studentsRes,
    balancesRes,
    disputeRes,
    reportsRes,
    phoneRes,
    escalationsRes,
    paymentsRes,
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, student_id, public_reference, subject_name, other_subject_text, request_note, scheduled_start, scheduled_end, duration_minutes, status, is_free_trial, payment_status, tutor_display_name, student_first_name, student_first_names, child_count, students(full_name, timezone)",
      )
      .order("scheduled_start", { ascending: true, nullsFirst: false }),
    supabase.from("students").select("id, full_name, grade_level").order("created_at").limit(50),
    supabase.rpc("get_customer_balances", { p_account: uid }),
    supabase.rpc("list_my_dispute_statuses").then((r) => r, () => ({ data: null, error: null })),
    supabase
      .from("session_reports")
      .select("id, submitted_at, focus_rating, work_summary, redirection_level, guide_note, booking_id")
      .order("submitted_at", { ascending: false })
      .then((r) => r, () => ({ data: null, error: null })),
    supabase.from("profiles").select("phone_e164, display_name").eq("id", uid).maybeSingle(),
    supabase
      .from("parent_escalation_requests")
      .select("booking_id")
      .then((r) => r, () => ({ data: null, error: null })),
    supabase
      .from("payments")
      .select("id, purpose, status, stripe_paid_cents, created_at")
      .eq("account_id", uid)
      .order("created_at", { ascending: false })
      .limit(20)
      .then((r) => r, () => ({ data: null, error: null })),
  ]);

  const bookings = (bookingsRes.data ?? []) as unknown as ParentBooking[];
  const bookingIds = bookings.map((b) => b.id);
  const recordingsRes = bookingIds.length
    ? await supabase
        .from("session_recordings")
        .select("id, booking_id, status, retention_until, deleted_at, daily_recording_id, completed_at")
        .in("booking_id", bookingIds)
        .then((r) => r, () => ({ data: null, error: null }))
    : { data: null, error: null };

  const recordingByBooking = new Map<string, ParentRecording>();
  for (const rec of (recordingsRes.data ?? []) as ParentRecording[]) {
    const prev = recordingByBooking.get(rec.booking_id);
    if (!prev || (rec.status === "completed" && prev.status !== "completed")) {
      recordingByBooking.set(rec.booking_id, rec);
    }
  }

  const reportIds = ((reportsRes.data ?? []) as ParentReport[]).map((r) => r.id);
  const childReportsRes = reportIds.length
    ? await supabase
        .from("session_report_children")
        .select("report_id, student_id, student_first_name, focus_rating, work_summary, redirection_level, guide_note")
        .in("report_id", reportIds)
        .then((r) => r, () => ({ data: null, error: null }))
    : { data: null, error: null };
  const childrenByReport = new Map<string, ParentChildReport[]>();
  for (const row of (childReportsRes.data ?? []) as (ParentChildReport & { report_id: string })[]) {
    const list = childrenByReport.get(row.report_id) ?? [];
    list.push(row);
    childrenByReport.set(row.report_id, list);
  }

  const reportByBooking = new Map<string, ParentReport>();
  for (const r of (reportsRes.data ?? []) as ParentReport[]) {
    if (!reportByBooking.has(r.booking_id)) {
      reportByBooking.set(r.booking_id, { ...r, children: childrenByReport.get(r.id) ?? [] });
    }
  }

  const issueByBooking = new Map<string, string>();
  for (const d of (disputeRes.data ?? []) as { booking_id: string; status: string }[]) {
    issueByBooking.set(d.booking_id, d.status);
  }

  const escalatedBookings = new Set(
    ((escalationsRes.data ?? []) as { booking_id: string }[]).map((e) => e.booking_id),
  );

  const balances = (balancesRes.data ?? {}) as { package_minutes?: number; dollar_credit_cents?: number };
  const phone = (phoneRes.data as { phone_e164?: string | null; display_name?: string | null } | null) ?? null;

  return {
    bookings,
    students: (studentsRes.data ?? []) as ParentStudent[],
    minutes: balances.package_minutes ?? 0,
    creditCents: balances.dollar_credit_cents ?? 0,
    parentPhone: phone?.phone_e164 ?? null,
    parentName: phone?.display_name ?? null,
    recordingByBooking,
    reportByBooking,
    issueByBooking,
    escalatedBookings,
    payments: (paymentsRes.data ?? []) as {
      id: string;
      purpose: string;
      status: string;
      stripe_paid_cents: number;
      created_at: string;
    }[],
  };
}

export function recordingSummary(rec: ParentRecording | undefined | null) {
  if (!rec) return null;
  return {
    id: rec.id,
    status: rec.status,
    retention_until: rec.retention_until,
    deleted_at: rec.deleted_at,
    playable: isRecordingPlayable(rec),
  };
}
