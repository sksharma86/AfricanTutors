import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import * as T from "@/lib/email/templates.mjs";
import { sendEmail } from "@/lib/email/transport";
import { packageHoursLabel } from "@/lib/notifications/package-labels.mjs";
import { reassignmentRecipients, reassignmentOutcome } from "@/lib/notifications/reassignment-policy.mjs";
import { shouldSendReminder } from "@/lib/notifications/reminder-policy.mjs";
import { attendanceNotifyKey, coverageRestorationLine, missedNotifyKey, protectNotifyKey, t30DeadlineIso } from "@/lib/guide-attendance.mjs";
import { guideAttendanceWhatsApp, guideOpenCoverageWhatsApp } from "@/lib/notifications/whatsapp-copy.mjs";
import { openCoverageEmailNotifyKey, openCoverageNotifyKey, openCoveragePath, openCoverageUrl } from "@/lib/open-coverage.mjs";
import { getWhatsAppConfig } from "@/lib/telephony/config";
import {
  parentCancellationSms,
  parentCoverageCancellationSms,
  parentCoverageFailureProtectionSms,
  parentSessionReminderSms,
} from "@/lib/notifications/sms-copy.mjs";
import { formatChildNames, possessiveStudyHall } from "@/lib/household-children.mjs";
import { getServiceSupabase } from "@/lib/supabase/service";
import { sendGuideWhatsApp, sendParentAttentionSms } from "@/lib/telephony/client";

/**
 * Central, idempotent transactional-notification service (Study Hall PR8).
 *
 * Email + parent SMS are claimed under STABLE keys via `claim_email_delivery`
 * (reused for SMS idempotency — no separate migration). Recipients are resolved
 * server-side. Nothing here ever throws or blocks the caller's business action.
 *
 * Channel policy (summary):
 *   Email     — confirmations, purchases, reports, schedule changes, and V1
 *               Guide attendance / emergency coverage (Resend).
 *   SMS       — parent 1h reminder; cancel; Call Parent (elsewhere). No Guide SMS.
 *   WhatsApp  — optional / later Guide alerts. Missing config must not block V1.
 *   Voice     — Call Parent only (PR7; unchanged)
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
    const result = await sendEmail({
      to,
      subject: opts.rendered.subject,
      html: opts.rendered.html,
      text: opts.rendered.text,
      type: opts.type,
    });
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

/**
 * Idempotent Guide WhatsApp via the same claim table. Attendance state is
 * never changed here. Missing number or Twilio WhatsApp config → skipped.
 */
async function deliverGuideWhatsApp(opts: {
  key: string;
  type: string;
  accountId: string;
  bookingId?: string | null;
  body: string;
  contentSid?: string | null;
  variables?: Record<string, string> | null;
}): Promise<{ status: string }> {
  const service = getServiceSupabase();
  try {
    const { data: profile } = await service.from("profiles").select("phone_e164").eq("id", opts.accountId).maybeSingle();
    const phone = typeof profile?.phone_e164 === "string" ? profile.phone_e164.trim() : "";

    const claim = await service.rpc("claim_email_delivery", {
      p_key: opts.key,
      p_type: opts.type,
      p_account: opts.accountId,
      p_to: phone ? "whatsapp:guide" : null,
      p_booking: opts.bookingId ?? null,
      p_subject: "whatsapp",
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

    const result = await sendGuideWhatsApp({
      toE164: phone,
      body: opts.body,
      contentSid: opts.contentSid ?? null,
      variables: opts.variables ?? null,
    });
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
        p_error: "whatsapp notify exception",
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
  const householdSelect =
    "id, account_id, student_id, tutor_id, subject_name, other_subject_text, scheduled_start, scheduled_end, duration_minutes, is_free_trial, status, payment_status, tutor_display_name, student_first_name, student_first_names";
  const legacySelect =
    "id, account_id, student_id, tutor_id, subject_name, other_subject_text, scheduled_start, scheduled_end, duration_minutes, is_free_trial, status, payment_status, tutor_display_name, student_first_name";
  const first = await service.from("bookings").select(householdSelect).eq("id", bookingId).maybeSingle();
  const retry = first.data
    ? null
    : await service.from("bookings").select(legacySelect).eq("id", bookingId).maybeSingle();
  const b = (first.data ?? retry?.data ?? null) as {
    id: string;
    account_id: string | null;
    student_id: string | null;
    tutor_id: string | null;
    subject_name: string | null;
    other_subject_text: string | null;
    scheduled_start: string | null;
    scheduled_end: string | null;
    duration_minutes: number | null;
    is_free_trial: boolean | null;
    status: string | null;
    payment_status: string | null;
    tutor_display_name: string | null;
    student_first_name: string | null;
    student_first_names?: string[] | null;
  } | null;
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
  const studentNames =
    Array.isArray(b.student_first_names) && b.student_first_names.length
      ? b.student_first_names
      : b.student_first_name
        ? [b.student_first_name]
        : [];
  return {
    ...b,
    subject: b.subject_name ?? (b.other_subject_text ? `Other — ${b.other_subject_text}` : "Study Hall"),
    studentTz,
    tutorTz,
    tutorFirst: firstName(b.tutor_display_name),
    studentNames,
    studentFirst: formatChildNames(studentNames, b.student_first_name ?? "your child"),
    studyHallPossessive: possessiveStudyHall(studentNames),
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
      studentNames: b.studentNames,
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
        studentNames: b.studentNames,
        appUrl: APP_URL,
        bookingId,
      }),
    });
  }

  // Prepaid balance alerts — only after package-funded bookings, once per booking.
  if (funding === "package" && b.account_id) {
    await maybeNotifyPackageBalanceAfterBooking(service, b.account_id, bookingId);
  }

  return { status: "ok" };
}

/** Warn once per booking when prepaid minutes hit zero or fall below one hour. */
async function maybeNotifyPackageBalanceAfterBooking(
  service: SupabaseClient,
  accountId: string,
  bookingId: string,
): Promise<void> {
  try {
    const { data: bal } = await service.rpc("get_package_minutes", { p_account: accountId });
    const minutes = typeof bal === "number" ? bal : 0;
    if (minutes <= 0) {
      await deliver({
        key: `package-depleted-after:${bookingId}`,
        type: "package_balance_depleted",
        accountId,
        bookingId,
        rendered: T.packageBalanceDepleted({ appUrl: APP_URL }),
      });
      return;
    }
    if (minutes < 60) {
      await deliver({
        key: `package-low-after:${bookingId}`,
        type: "package_balance_low",
        accountId,
        bookingId,
        rendered: T.packageBalanceLow({ balanceMinutes: minutes, appUrl: APP_URL }),
      });
    }
  } catch {
    /* best-effort */
  }
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
    await deliverParentSms({
      key: `cancellation-sms:${bookingId}`,
      type: "cancellation_sms",
      accountId: b.account_id,
      bookingId,
      body: parentCancellationSms({
        studentName: b.studentFirst,
        studentNames: b.studentNames,
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
          studentNames: b.studentNames,
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
    await notifyAdminAlert(`guide-reassignment-failed:${bookingId}`, {
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
      studentNames: b.studentNames,
      whenISO: b.scheduled_start,
      tz: b.studentTz,
      appUrl: APP_URL,
      bookingId,
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

/** Positive account-credit grant (admin adjustment). Idempotent per ledger reference. */
export async function notifyAccountCreditApplied(
  accountId: string,
  amountCents: number,
  opts: { reason?: string | null; reference: string },
) {
  if (!accountId || !(amountCents > 0) || !opts.reference) return { status: "skipped" };
  return deliver({
    key: `credit-applied:${opts.reference}`,
    type: "account_credit_applied",
    accountId,
    rendered: T.accountCreditApplied({
      amountCents,
      reason: opts.reason ?? null,
      appUrl: `${APP_URL}/dashboard/student`,
    }),
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
      studentNames: b.studentNames,
      appUrl: APP_URL,
      bookingId,
    }),
  });

  // Parent 1h SMS (separate idempotency key). Missing phone → skipped, never fails booking.
  if (role === "customer" && kind === "1h" && b.account_id) {
    await deliverParentSms({
      key: `reminder-1h-sms:${bookingId}`,
      type: "reminder_1h_sms",
      accountId: b.account_id,
      bookingId,
      body: parentSessionReminderSms({
        studentName: b.studentFirst,
        studentNames: b.studentNames,
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
      studentNames: b.studentNames,
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
      studentNames: b.studentNames,
      whenISO: b.scheduled_start,
      tz: b.tutorTz,
      appUrl: APP_URL,
    }),
  });
  await notifyAdminAlert(`guide-report-overdue:${bookingId}`, {
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

/** Notify the current awaiting assignment, if any. Used after replacement. */
export async function notifyCurrentAttendanceRequest(bookingId: string) {
  const service = getServiceSupabase();
  const { data } = await service
    .from("guide_attendance_assignments")
    .select("id, status, source, tutor_id")
    .eq("booking_id", bookingId)
    .eq("status", "awaiting")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.id) return { status: "skipped" };
  const { obligationBlockContaining } = await import("@/lib/guide-attendance.mjs");
  const { data: halls } = await service
    .from("bookings")
    .select("id, tutor_id, scheduled_start, scheduled_end, status")
    .eq("tutor_id", data.tutor_id)
    .eq("status", "confirmed");
  const { data: atts } = await service
    .from("guide_attendance_assignments")
    .select("booking_id, status, tutor_id")
    .eq("tutor_id", data.tutor_id)
    .in("status", ["awaiting", "confirmed", "missed"]);
  const byBooking: Record<string, { status?: string }> = {};
  for (const a of atts ?? []) {
    if (a?.booking_id) byBooking[a.booking_id] = a;
  }
  const hallsWithAtt = (halls ?? []).map((h) => ({ ...h, attendance: byBooking[h.id] ?? null }));
  const block = obligationBlockContaining(hallsWithAtt, bookingId, {
    tutorId: data.tutor_id,
    assignmentsByBooking: byBooking,
  });
  const first = block[0] ?? { id: bookingId, scheduled_start: null, scheduled_end: null };
  return notifyGuideAttendanceRequest(first.id, data.id as string, {
    replacement: data.source === "replacement" || data.source === "short_notice",
    count: Math.max(block.length, 1),
    endISO: block[block.length - 1]?.scheduled_end ?? null,
    firstBookingId: first.id,
  });
}

type AttendanceNotifyOpts = {
  replacement?: boolean;
  count?: number;
  endISO?: string | null;
  memberBookingIds?: string[];
  firstBookingId?: string;
};

/** Guide attendance request. Failed delivery does not confirm or cancel. */
export async function notifyGuideAttendanceRequest(
  bookingId: string,
  assignmentId: string,
  opts: AttendanceNotifyOpts = {},
) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  if (!b?.tutor_id || !b.scheduled_start) return { status: "skipped" };
  const count = Number(opts.count) > 0 ? Number(opts.count) : 1;
  const firstBookingId = opts.firstBookingId || bookingId;
  const source = opts.replacement ? "replacement" : "t30";
  const emailKey = attendanceNotifyKey({ tutorId: b.tutor_id, firstBookingId, source });
  const waKey = `${emailKey}:wa`;

  const { data: assignment } = await service
    .from("guide_attendance_assignments")
    .select("deadline_at")
    .eq("id", assignmentId)
    .maybeSingle();
  const deadlineISO =
    (typeof assignment?.deadline_at === "string" && assignment.deadline_at) || t30DeadlineIso(b.scheduled_start);

  const email = await deliver({
    key: emailKey,
    type: "guide_attendance_request",
    accountId: b.tutor_id,
    bookingId: firstBookingId,
    rendered: T.guideAttendanceRequest({
      whenISO: b.scheduled_start,
      endISO: opts.endISO ?? null,
      deadlineISO,
      tz: b.tutorTz,
      durationMinutes: b.duration_minutes,
      studentName: b.studentFirst,
      studentNames: b.studentNames,
      appUrl: APP_URL,
      count,
      replacement: Boolean(opts.replacement),
    }),
  });

  const wa = guideAttendanceWhatsApp({
    count,
    startISO: b.scheduled_start,
    endISO: opts.endISO ?? b.scheduled_start,
    tz: b.tutorTz,
    durationMinutes: b.duration_minutes,
    studentName: b.studentFirst,
    appUrl: APP_URL,
    replacement: Boolean(opts.replacement),
  });
  const waCfg = getWhatsAppConfig();
  const contentSid = opts.replacement ? waCfg.replacementContentSid : waCfg.attendanceContentSid;
  await deliverGuideWhatsApp({
    key: waKey,
    type: "guide_attendance_whatsapp",
    accountId: b.tutor_id,
    bookingId: firstBookingId,
    body: wa.body,
    contentSid: contentSid || null,
    variables: wa.variables,
  });

  return email;
}

/**
 * Private emergency offer for one eligible replacement Guide.
 * V1 primary channel is email. WhatsApp is optional / later and never blocks.
 * No parent notify. Delivery failure does not change attendance or claim state.
 */
export async function notifyOpenCoverageOffer(
  bookingId: string,
  opts: { tutorId: string; searchKey: string },
) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  if (!b?.scheduled_start || !opts.tutorId || !opts.searchKey) return { status: "skipped" };
  const { data: guide } = await service.from("profiles").select("timezone").eq("id", opts.tutorId).maybeSingle();
  const { data: tutor } = await service
    .from("tutor_profiles")
    .select("timezone")
    .eq("profile_id", opts.tutorId)
    .maybeSingle();
  const tz = (tutor?.timezone as string | null) || (guide?.timezone as string | null) || b.tutorTz;
  const identity = { bookingId, tutorId: opts.tutorId, searchKey: opts.searchKey };
  const acceptUrl = openCoverageUrl(APP_URL, bookingId);

  const email = await deliver({
    key: openCoverageEmailNotifyKey(identity),
    type: "guide_open_coverage",
    accountId: opts.tutorId,
    bookingId,
    rendered: T.guideOpenCoverageOffer({
      whenISO: b.scheduled_start,
      endISO: b.scheduled_end ?? b.scheduled_start,
      tz,
      durationMinutes: b.duration_minutes,
      appUrl: APP_URL,
      bookingId,
      acceptUrl,
    }),
  });

  const wa = guideOpenCoverageWhatsApp({
    startISO: b.scheduled_start,
    endISO: b.scheduled_end ?? b.scheduled_start,
    tz,
    durationMinutes: b.duration_minutes,
    appUrl: APP_URL,
    acceptPath: openCoveragePath(bookingId),
  });
  const waCfg = getWhatsAppConfig();
  await deliverGuideWhatsApp({
    key: `${openCoverageNotifyKey(identity)}:wa`,
    type: "guide_open_coverage",
    accountId: opts.tutorId,
    bookingId,
    body: wa.body,
    contentSid: waCfg.openCoverageContentSid || null,
    variables: wa.variables,
  });

  return email;
}

/** Management exception when a confirmation deadline is missed. One alert per block. */
export async function notifyGuideConfirmationMissed(
  bookingId: string,
  assignmentId: string,
  opts: { count?: number; firstBookingId?: string; tutorId?: string | null } = {},
) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  const firstBookingId = opts.firstBookingId || bookingId;
  const tutorId = opts.tutorId || b?.tutor_id || "unknown";
  const count = Number(opts.count) > 0 ? Number(opts.count) : 1;
  return notifyAdminAlert(missedNotifyKey({ tutorId, firstBookingId }), {
    title: count > 1 ? "Guide coverage unconfirmed" : "Guide confirmation missed",
    summary:
      count > 1
        ? `A Guide did not confirm ${count} consecutive Study Halls before the deadline. Coverage needs a decision.`
        : "A Guide did not confirm attendance before the deadline. Coverage needs a decision.",
    lines: [
      `Booking: ${firstBookingId}`,
      count > 1 ? `Study Halls affected: ${count}` : null,
      b?.studentFirst ? `Child: ${b.studentFirst}` : null,
      b?.scheduled_start ? `When: ${b.scheduled_start}` : null,
      b?.tutorFirst ? `Assigned Guide: ${b.tutorFirst}` : null,
      `Assignment: ${assignmentId}`,
    ].filter(Boolean) as string[],
  });
}

/** Parent notice when Study Hall cancels for Guide coverage. Does not name the Guide. */
export async function notifyCoverageCancellation(
  bookingId: string,
  info: {
    isFreeTrial?: boolean | null;
    restoredMinutes?: number | null;
    restoredCreditCents?: number | null;
    compCreditCents?: number | null;
  } = {},
) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  if (!b?.account_id) return { status: "skipped" };
  const restorationLine = coverageRestorationLine({
    isFreeTrial: info.isFreeTrial ?? b.is_free_trial,
    restoredMinutes: info.restoredMinutes ?? null,
    restoredCreditCents: info.restoredCreditCents ?? null,
  });
  await deliver({
    key: `coverage-cancel:${bookingId}`,
    type: "coverage_cancellation",
    accountId: b.account_id,
    bookingId,
    rendered: T.coverageCancellation({
      restorationLine,
      compCreditCents: info.compCreditCents ?? null,
      appUrl: APP_URL,
    }),
  });
  await deliverParentSms({
    key: `coverage-cancel-sms:${bookingId}`,
    type: "coverage_cancellation_sms",
    accountId: b.account_id,
    bookingId,
    body: parentCoverageCancellationSms({
      studentName: b.studentFirst,
      studentNames: b.studentNames,
      whenISO: b.scheduled_start,
      tz: b.studentTz,
    }),
  });
  return { status: "ok", parentNotified: true };
}

/** T-2 automatic protection. Idempotent. Does not name or blame the Guide. */
export async function notifyCoverageFailureProtection(
  bookingId: string,
  info: {
    isFreeTrial?: boolean | null;
    restoredMinutes?: number | null;
    restoredCreditCents?: number | null;
  } = {},
) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  if (!b?.account_id) return { status: "skipped" };
  const restorationLine = coverageRestorationLine({
    isFreeTrial: info.isFreeTrial ?? b.is_free_trial,
    restoredMinutes: info.restoredMinutes ?? null,
    restoredCreditCents: info.restoredCreditCents ?? null,
  });
  await deliver({
    key: protectNotifyKey(bookingId),
    type: "coverage_failure_protection",
    accountId: b.account_id,
    bookingId,
    rendered: T.coverageFailureProtection({
      restorationLine,
      appUrl: APP_URL,
    }),
  });
  await deliverParentSms({
    key: `${protectNotifyKey(bookingId)}:sms`,
    type: "coverage_failure_protection_sms",
    accountId: b.account_id,
    bookingId,
    body: parentCoverageFailureProtectionSms({
      studentName: b.studentFirst,
      studentNames: b.studentNames,
      whenISO: b.scheduled_start,
      tz: b.studentTz,
    }),
  });
  return { status: "ok", parentNotified: true };
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

/** Manager exception: 60-day retention deletion failed (idempotent per recording). */
export async function notifyRecordingDeletionFailure(recordingId: string, detail?: string | null) {
  return notifyAdminAlert(`recording-deletion-failed:${recordingId}`, {
    title: "Recording deletion failed",
    summary: `Could not delete expired Study Hall recording ${recordingId} from Daily. Will retry on the next retention cron.`,
    lines: detail ? [detail] : [],
  });
}
