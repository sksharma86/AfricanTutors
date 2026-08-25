import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import * as T from "@/lib/email/templates.mjs";
import { sendEmail } from "@/lib/email/transport";
import { packageHoursLabel } from "@/lib/notifications/package-labels.mjs";
import { reassignmentRecipients, reassignmentOutcome } from "@/lib/notifications/reassignment-policy.mjs";
import { shouldSendReminder } from "@/lib/notifications/reminder-policy.mjs";
import {
  parentCancellationSms,
  parentSessionReminderSms,
} from "@/lib/notifications/sms-copy.mjs";
import { getServiceSupabase } from "@/lib/supabase/service";
import { sendParentAttentionSms } from "@/lib/telephony/client";

/**
 * Central, idempotent transactional-notification service (Study Hall PR8).
 *
 * Email + parent SMS are claimed under STABLE keys via `claim_email_delivery`
 * (reused for SMS idempotency — no separate migration). Recipients are resolved
 * server-side. Nothing here ever throws or blocks the caller's business action.
 *
 * Channel policy (summary):
 *   Email — confirmations, purchases, reports, schedule changes, Guide ops
 *   SMS   — parent 1h reminder; cancel/reassign; Call Parent (elsewhere)
 *   Voice — Call Parent only (PR7; unchanged)
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || null;

const firstName = (name?: string | null) => (name ? name.split(" ")[0] : null);

async function emailForAccount(service: SupabaseClient, accountId: string | null): Promise<string | null> {
  if (!accountId) return null;
  try {
    const { data } = await service.auth.admin.getUserById(accountId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

/** Claim → resolve recipient → send → record. Returns the outcome; never throws. */
async function deliver(opts: {
  key: string;
  type: string;
  accountId?: string | null;
  bookingId?: string | null;
  toEmailOverride?: string | null;
  rendered: { subject: string; html: string; text: string };
}): Promise<{ status: string }> {
  const service = getServiceSupabase();
  try {
    const to = opts.toEmailOverride ?? (await emailForAccount(service, opts.accountId ?? null));
    const claim = await service.rpc("claim_email_delivery", {
      p_key: opts.key,
      p_type: opts.type,
      p_account: opts.accountId ?? null,
      p_to: to,
      p_booking: opts.bookingId ?? null,
      p_subject: opts.rendered.subject,
      p_html: opts.rendered.html,
      p_text: opts.rendered.text,
    });
    if (claim.error) return { status: "error" };
    if (claim.data !== true) return { status: "duplicate" };

    if (!to) {
      await service.rpc("complete_email_delivery", { p_key: opts.key, p_status: "skipped", p_error: "no recipient email" });
      return { status: "skipped" };
    }
    const result = await sendEmail({ to, subject: opts.rendered.subject, html: opts.rendered.html, text: opts.rendered.text });
    await service.rpc("complete_email_delivery", {
      p_key: opts.key,
      p_status: result.status,
      p_provider_message_id: result.id ?? null,
      p_error: result.error ?? null,
    });
    return { status: result.status };
  } catch {
    try {
      await getServiceSupabase().rpc("complete_email_delivery", { p_key: opts.key, p_status: "failed", p_error: "notify exception" });
    } catch {
      /* ignore */
    }
    return { status: "failed" };
  }
}

/**
 * Idempotent parent SMS via the same claim table. Never stores the raw phone in
 * `to_email` (uses channel marker). Missing phone → skipped, never throws.
 */
async function deliverParentSms(opts: {
  key: string;
  type: string;
  accountId: string;
  bookingId?: string | null;
  body: string;
}): Promise<{ status: string }> {
  const service = getServiceSupabase();
  try {
    const { data: profile } = await service.from("profiles").select("phone_e164").eq("id", opts.accountId).maybeSingle();
    const phone = typeof profile?.phone_e164 === "string" ? profile.phone_e164.trim() : "";

    const claim = await service.rpc("claim_email_delivery", {
      p_key: opts.key,
      p_type: opts.type,
      p_account: opts.accountId,
      p_to: phone ? "sms:parent" : null,
      p_booking: opts.bookingId ?? null,
      p_subject: "sms",
      p_html: null,
      p_text: opts.body,
    });
    if (claim.error) return { status: "error" };
    if (claim.data !== true) return { status: "duplicate" };

    if (!phone) {
      await service.rpc("complete_email_delivery", {
        p_key: opts.key,
        p_status: "skipped",
        p_error: "no phone_e164",
      });
      return { status: "skipped" };
    }

    const result = await sendParentAttentionSms({ toE164: phone, body: opts.body });
    await service.rpc("complete_email_delivery", {
      p_key: opts.key,
      p_status: result.status === "sent" ? "sent" : result.status === "skipped" ? "skipped" : "failed",
      p_provider_message_id: result.sid ?? null,
      p_error: result.error ?? null,
    });
    return { status: result.status };
  } catch {
    try {
      await getServiceSupabase().rpc("complete_email_delivery", {
        p_key: opts.key,
        p_status: "failed",
        p_error: "sms notify exception",
      });
    } catch {
      /* ignore */
    }
    return { status: "failed" };
  }
}

// --- Context loaders --------------------------------------------------------

async function resolveFunding(
  service: SupabaseClient,
  bookingId: string,
  isFreeTrial: boolean | null | undefined,
): Promise<string | null> {
  if (isFreeTrial) return "free_trial";
  const { data: pay } = await service
    .from("payments")
    .select("stripe_paid_cents, credit_applied_cents, status, purpose")
    .eq("booking_id", bookingId)
    .eq("purpose", "booking")
    .in("status", ["succeeded", "completed"])
    .order("fulfilled_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pay) return null;
  const stripe = Number(pay.stripe_paid_cents) || 0;
  const credit = Number(pay.credit_applied_cents) || 0;
  if (stripe > 0) return "stripe";
  if (credit > 0) return "credit";
  return "package";
}

async function loadBooking(service: SupabaseClient, bookingId: string) {
  const { data: b } = await service
    .from("bookings")
    .select(
      "id, account_id, student_id, tutor_id, subject_name, other_subject_text, scheduled_start, scheduled_end, duration_minutes, is_free_trial, status, payment_status, tutor_display_name, student_first_name",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!b) return null;
  let studentTz = "UTC";
  if (b.student_id) {
    const { data: s } = await service.from("students").select("timezone").eq("id", b.student_id).maybeSingle();
    studentTz = s?.timezone || "UTC";
  }
  let tutorTz = "UTC";
  if (b.tutor_id) {
    const { data: tp } = await service.from("tutor_profiles").select("timezone").eq("profile_id", b.tutor_id).maybeSingle();
    tutorTz = tp?.timezone || "UTC";
  }
  return {
    ...b,
    subject: b.subject_name ?? (b.other_subject_text ? `Other — ${b.other_subject_text}` : "Study Hall"),
    studentTz,
    tutorTz,
    tutorFirst: firstName(b.tutor_display_name),
    studentFirst: b.student_first_name ?? null,
  };
}

// --- Business notifications -------------------------------------------------

export async function notifyBookingConfirmed(bookingId: string) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  if (!b) return { status: "skipped" };
  // Only genuinely confirmed (or already completed) bookings — never unpaid holds.
  if (b.status !== "confirmed" && b.status !== "completed") {
    return { status: "skipped" };
  }
  if (b.payment_status === "awaiting_payment") {
    return { status: "skipped" };
  }

  const funding = await resolveFunding(service, bookingId, b.is_free_trial);

  await deliver({
    key: `booking-confirmed:${bookingId}`,
    type: "booking_confirmed",
    accountId: b.account_id,
    bookingId,
    rendered: T.bookingConfirmed({
      isFreeTrial: b.is_free_trial,
      subject: b.subject,
      whenISO: b.scheduled_start,
      tz: b.studentTz,
      durationMinutes: b.duration_minutes,
      tutorName: b.tutorFirst,
      studentName: b.studentFirst,
      funding,
      appUrl: APP_URL,
      bookingId,
    }),
  });

  // Guide assignment email (idempotent per booking+tutor).
  if (b.tutor_id && b.scheduled_start) {
    await deliver({
      key: `tutor-new-session:${bookingId}:${b.tutor_id}`,
      type: "tutor_new_session",
      accountId: b.tutor_id,
      bookingId,
      rendered: T.tutorNewSession({
        subject: b.subject,
        whenISO: b.scheduled_start,
        tz: b.tutorTz,
        durationMinutes: b.duration_minutes,
        studentName: b.studentFirst,
        appUrl: APP_URL,
        bookingId,
      }),
    });
  }
  return { status: "ok" };
}

export async function notifyPackagePurchased(paymentId: string) {
  const service = getServiceSupabase();
  const { data: pay } = await service
    .from("payments")
    .select("account_id, package_product_id, gross_cents, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (!pay) return { status: "skipped" };
  // Only after authoritative fulfillment.
  if (pay.status && pay.status !== "succeeded" && pay.status !== "completed") {
    return { status: "skipped" };
  }
  const { data: prod } = await service.from("package_products").select("minutes").eq("id", pay.package_product_id).maybeSingle();
  const { data: bal } = await service.rpc("get_package_minutes", { p_account: pay.account_id });
  const minutes = prod?.minutes ?? 0;
  return deliver({
    key: `package-purchased:${paymentId}`,
    type: "package_purchased",
    accountId: pay.account_id,
    rendered: T.packagePurchased({
      minutes,
      amountCents: pay.gross_cents,
      balanceMinutes: typeof bal === "number" ? bal : null,
      packageName: packageHoursLabel(minutes),
      appUrl: APP_URL,
    }),
  });
}

export async function notifyCancellation(
  bookingId: string,
  info: { early: boolean; restoredMinutes?: number | null; restoredCreditCents?: number | null },
) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  if (!b) return;
  await deliver({
    key: `cancellation:${bookingId}`,
    type: "cancellation",
    accountId: b.account_id,
    bookingId,
    rendered: T.cancellation({
      early: info.early,
      restoredMinutes: info.restoredMinutes ?? null,
      restoredCreditCents: info.restoredCreditCents ?? null,
    }),
  });
  // Parent SMS for immediate awareness (idempotent; skipped if no phone).
  if (b.account_id) {
    void deliverParentSms({
      key: `cancellation-sms:${bookingId}`,
      type: "cancellation_sms",
      accountId: b.account_id,
      bookingId,
      body: parentCancellationSms({
        studentName: b.studentFirst,
        whenISO: b.scheduled_start,
        tz: b.studentTz,
      }),
    });
  }
  if (b.tutor_id) {
    await deliver({
      key: `cancellation-tutor:${bookingId}`,
      type: "tutor_cancellation",
      accountId: b.tutor_id,
      bookingId,
      rendered: T.tutorCancelled({
        early: info.early,
        subject: b.subject,
        whenISO: b.scheduled_start,
        tz: b.tutorTz,
      }),
    });
  }
}

/**
 * Guide reassignment / release notifications.
 *
 * Successful internal reassignment (`reassigned: true`): parent is silent —
 * customers book a time, not a Guide. New Guide gets assignment; removed Guide
 * gets removal notice. No routine manager alert.
 *
 * Session impacted (`reassigned: false` / release): parent email + manager
 * exception alert. Cancellation path remains separate for full cancels.
 */
export async function notifyReassignment(
  bookingId: string,
  info: { reassigned: boolean; compCreditCents?: number | null; removedTutorId?: string | null },
) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  if (!b) return { status: "skipped" };

  const recipients = reassignmentRecipients(reassignmentOutcome(info.reassigned));

  // --- Successful internal Guide swap: Guides only -------------------------
  if (info.reassigned) {
    // New Guide assignment (idempotent per booking+tutor — duplicate reassign
    // to the same Guide does not resend). Never routes through booking-confirmed
    // so the parent is never touched.
    if (recipients.newGuideAssignment && b.tutor_id && b.scheduled_start) {
      await deliver({
        key: `tutor-new-session:${bookingId}:${b.tutor_id}`,
        type: "tutor_new_session",
        accountId: b.tutor_id,
        bookingId,
        rendered: T.tutorNewSession({
          subject: b.subject,
          whenISO: b.scheduled_start,
          tz: b.tutorTz,
          durationMinutes: b.duration_minutes,
          studentName: b.studentFirst,
          appUrl: APP_URL,
          bookingId,
        }),
      });
    }

    if (recipients.removedGuide && info.removedTutorId) {
      let tz = "UTC";
      const { data: tp } = await service
        .from("tutor_profiles")
        .select("timezone")
        .eq("profile_id", info.removedTutorId)
        .maybeSingle();
      tz = tp?.timezone || "UTC";
      await deliver({
        key: `tutor-removed:${bookingId}:${info.removedTutorId}`,
        type: "tutor_removed",
        accountId: info.removedTutorId,
        bookingId,
        rendered: T.tutorRemoved({ subject: b.subject, whenISO: b.scheduled_start, tz }),
      });
    }

    // Explicit: never parent email / never parent SMS on successful reassignment.
    return { status: "ok", parentNotified: false };
  }

  // --- Session impacted (release / failed replacement) ---------------------
  if (recipients.parentEmail) {
    await deliver({
      key: `release:${bookingId}`,
      type: "guide_reassignment_failed",
      accountId: b.account_id,
      bookingId,
      rendered: T.tutorReassignment({
        reassigned: false,
        compCreditCents: info.compCreditCents ?? null,
        subject: b.subject,
        bookingId,
        appUrl: APP_URL,
      }),
    });
  }

  if (recipients.managerExceptionAlert) {
    void notifyAdminAlert(`guide-reassignment-failed:${bookingId}`, {
      title: "Guide reassignment failed — session impacted",
      summary: `Booking ${bookingId} could not keep an assigned Guide; customer was notified.`,
      lines: [
        b.studentFirst ? `Child: ${b.studentFirst}` : null,
        b.scheduled_start ? `When: ${b.scheduled_start}` : null,
      ].filter(Boolean) as string[],
    });
  }

  return { status: "ok", parentNotified: true };
}

export async function notifyRefund(paymentId: string, refundRef: string, amountCents: number, reason?: string | null) {
  const service = getServiceSupabase();
  const { data: pay } = await service.from("payments").select("account_id").eq("id", paymentId).maybeSingle();
  if (!pay) return;
  await deliver({
    key: `refund-issued:${refundRef}`,
    type: "refund_issued",
    accountId: pay.account_id,
    rendered: T.refundIssued({ amountCents, reason: reason ?? null }),
  });
}

export async function notifyDisputeReceived(disputeId: string, bookingId: string) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  await deliver({
    key: `dispute-received:${disputeId}`,
    type: "dispute_received",
    accountId: b?.account_id ?? null,
    bookingId,
    rendered: T.disputeReceived({ subject: b?.subject ?? null }),
  });
}

/** Fired after a Guide successfully submits a post-session report (PR6). */
export async function notifySessionReportReady(bookingId: string, reportId: string) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  if (!b?.account_id) return { status: "skipped" };
  return deliver({
    key: `session-report-ready:${reportId}`,
    type: "session_report_ready",
    accountId: b.account_id,
    bookingId,
    rendered: T.sessionReportReady({
      studentName: b.studentFirst,
      whenISO: b.scheduled_start,
      tz: b.studentTz,
      appUrl: APP_URL,
    }),
  });
}

export async function notifyDisputeResolved(
  disputeId: string,
  accountId: string,
  info: { resolution: string; creditCents?: number | null; restoredMinutes?: number | null; refundCents?: number | null },
) {
  await deliver({
    key: `dispute-resolved:${disputeId}`,
    type: "dispute_resolved",
    accountId,
    rendered: T.disputeResolved({
      resolution: info.resolution,
      creditCents: info.creditCents ?? null,
      restoredMinutes: info.restoredMinutes ?? null,
      refundCents: info.refundCents ?? null,
    }),
  });
}

export async function notifyTutorApproved(tutorId: string, name?: string | null) {
  await deliver({
    key: `tutor-approved:${tutorId}`,
    type: "tutor_approved",
    accountId: tutorId,
    rendered: T.tutorApproved({ name: firstName(name), appUrl: `${APP_URL}/dashboard/tutor` }),
  });
}

export async function notifyWelcome(accountId: string, name?: string | null) {
  await deliver({
    key: `welcome:${accountId}`,
    type: "welcome",
    accountId,
    rendered: T.welcome({ name: firstName(name), appUrl: `${APP_URL}/dashboard` }),
  });
}

/**
 * Session reminders. PR8: only 1h for parent + Guide. Parent also gets SMS.
 * 24h is rejected by policy (no email, no SMS).
 */
export async function notifyReminder(bookingId: string, role: "customer" | "tutor", kind: "24h" | "1h") {
  if (!shouldSendReminder(role, kind)) {
    return { status: "skipped" };
  }
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  if (!b || !b.scheduled_start) return { status: "skipped" };
  if (b.status !== "confirmed") return { status: "skipped" };

  const accountId = role === "customer" ? b.account_id : b.tutor_id;
  if (!accountId) return { status: "skipped" };

  const emailResult = await deliver({
    key: `reminder-${kind}:${bookingId}:${role}`,
    type: `reminder_${kind}`,
    accountId,
    bookingId,
    rendered: T.reminder({
      role,
      kind,
      subject: b.subject,
      whenISO: b.scheduled_start,
      tz: role === "customer" ? b.studentTz : b.tutorTz,
      durationMinutes: b.duration_minutes,
      tutorName: b.tutorFirst,
      studentName: b.studentFirst,
      appUrl: APP_URL,
      bookingId,
    }),
  });

  // Parent 1h SMS (separate idempotency key). Missing phone → skipped, never fails booking.
  if (role === "customer" && kind === "1h" && b.account_id) {
    void deliverParentSms({
      key: `reminder-1h-sms:${bookingId}`,
      type: "reminder_1h_sms",
      accountId: b.account_id,
      bookingId,
      body: parentSessionReminderSms({
        studentName: b.studentFirst,
        whenISO: b.scheduled_start,
        tz: b.studentTz,
      }),
    });
  }

  return emailResult;
}

/** Guide: soft nudge after session completed with no report yet. */
export async function notifyGuideReportRequired(bookingId: string) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  if (!b?.tutor_id || b.status !== "completed") return { status: "skipped" };
  return deliver({
    key: `guide-report-required:${bookingId}`,
    type: "guide_report_required",
    accountId: b.tutor_id,
    bookingId,
    rendered: T.guideReportRequired({
      studentName: b.studentFirst,
      whenISO: b.scheduled_start,
      tz: b.tutorTz,
      appUrl: APP_URL,
    }),
  });
}

/** Guide + manager: overdue report. */
export async function notifyGuideReportOverdue(bookingId: string) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  if (!b?.tutor_id || b.status !== "completed") return { status: "skipped" };
  const guide = await deliver({
    key: `guide-report-overdue:${bookingId}`,
    type: "guide_report_overdue",
    accountId: b.tutor_id,
    bookingId,
    rendered: T.guideReportOverdue({
      studentName: b.studentFirst,
      whenISO: b.scheduled_start,
      tz: b.tutorTz,
      appUrl: APP_URL,
    }),
  });
  void notifyAdminAlert(`guide-report-overdue:${bookingId}`, {
    title: "Guide report overdue",
    summary: `Booking ${bookingId} has no post-session report after the overdue window.`,
    lines: [
      b.studentFirst ? `Child: ${b.studentFirst}` : null,
      b.scheduled_start ? `When: ${b.scheduled_start}` : null,
      b.tutor_id ? `Guide id: ${b.tutor_id}` : null,
    ].filter(Boolean) as string[],
  });
  return guide;
}

export async function notifyAdminAlert(dedupeKey: string, ctx: { title: string; summary: string; lines?: string[] }) {
  if (!ADMIN_ALERT_EMAIL) return { status: "skipped" };
  return deliver({
    key: `admin:${dedupeKey}`,
    type: "admin_alert",
    accountId: null,
    toEmailOverride: ADMIN_ALERT_EMAIL,
    rendered: T.adminAlert(ctx),
  });
}

/** Manager exception: Call Parent hard failure (PR7 path). */
export async function notifyCallParentFailure(escalationId: string, detail?: string | null) {
  return notifyAdminAlert(`call-parent-failure:${escalationId}`, {
    title: "Call Parent failed",
    summary: "A Guide Call Parent escalation could not reach the parent (voice + SMS).",
    lines: [`Escalation: ${escalationId}`, detail ? `Detail: ${detail}` : null].filter(Boolean) as string[],
  });
}

/** Manager exception: recording failure (Daily webhook). */
export async function notifyRecordingFailure(bookingId: string, detail?: string | null) {
  return notifyAdminAlert(`recording-failure:${bookingId}`, {
    title: "Recording failure",
    summary: `Cloud recording failed for booking ${bookingId}.`,
    lines: detail ? [detail] : [],
  });
}
