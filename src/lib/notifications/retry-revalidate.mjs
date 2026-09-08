/**
 * PR7E — revalidate current-state notifications before retrying stored HTML.
 * Inputs are already-loaded authoritative rows. Never parses email HTML.
 */

import { STUDY_HALL_365_PAYMENT_PROBLEM_STATUSES } from "./study-hall-365-payment-failure.mjs";
import { snapshotEntitled } from "./study-hall-365-lifecycle.mjs";
import { reminderStillValid } from "./reminder-policy.mjs";
import { parseDeliveryIdentity, RETRY_CLASS, retryClassForType, isEmailRecipient } from "./retry-policy.mjs";

export function reminderStillTimely(booking, nowMs = Date.now()) {
  if (!booking?.scheduled_start) return false;
  const start = Date.parse(booking.scheduled_start);
  return Number.isFinite(start) && start > nowMs;
}

function skip(reason) {
  return { ok: false, reason };
}

/**
 * @param {{
 *   delivery: object,
 *   booking?: object | null,
 *   membership?: object | null,
 *   profileExists?: boolean,
 *   reportExists?: boolean | null,
 *   packageMinutes?: number | null,
 *   attendanceAwaiting?: boolean | null,
 *   coverageOfferOpen?: boolean | null,
 *   nowMs?: number,
 * }} input
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function decideRetryAction({
  delivery,
  booking = null,
  membership = null,
  profileExists = true,
  reportExists = null,
  packageMinutes = null,
  attendanceAwaiting = null,
  coverageOfferOpen = null,
  nowMs = Date.now(),
} = {}) {
  if (!delivery) return skip("missing_delivery");
  if (!isEmailRecipient(delivery.to_email)) return skip("non_email_channel");
  if (!delivery.subject || !(delivery.body_html || delivery.body_text)) {
    return skip("missing_content");
  }

  const klass = retryClassForType(delivery.notification_type);
  if (klass === RETRY_CLASS.NON_EMAIL) return skip("non_email_channel");

  const identity = parseDeliveryIdentity(delivery);
  const type = identity.type || String(delivery.notification_type || "");

  if (type === "reminder_1h" || type === "session_reminder_1h" || type === "guide_session_reminder") {
    const role = identity.tutorId ? "tutor" : "customer";
    const tutorId = identity.tutorId || booking?.tutor_id || null;
    if (role === "tutor" && identity.tutorId && booking?.tutor_id !== identity.tutorId) {
      return skip("guide_reassigned");
    }
    if (!reminderStillValid(booking, { role, tutorId })) {
      return skip("reminder_no_longer_valid");
    }
    if (!reminderStillTimely(booking, nowMs)) return skip("reminder_expired");
    return { ok: true };
  }

  if (type === "payment_failure") {
    if (!membership) return skip("payment_failure_recovered");
    if (membership.ended_at) return skip("payment_failure_recovered");
    const status = typeof membership.status === "string" ? membership.status : "";
    if (!STUDY_HALL_365_PAYMENT_PROBLEM_STATUSES.includes(status)) {
      return skip("payment_failure_recovered");
    }
    return { ok: true };
  }

  if (type === "study_hall_365_cancellation_scheduled") {
    if (!membership) return skip("cancellation_no_longer_scheduled");
    if (membership.ended_at) return skip("cancellation_no_longer_scheduled");
    if (membership.cancel_at_period_end !== true && membership.cancel_at_period_end !== "true") {
      return skip("cancellation_no_longer_scheduled");
    }
    return { ok: true };
  }

  if (type === "study_hall_365_resumed") {
    if (!membership) return skip("resume_no_longer_valid");
    if (membership.cancel_at_period_end === true || membership.cancel_at_period_end === "true") {
      return skip("resume_no_longer_valid");
    }
    if (!snapshotEntitled(membership, nowMs)) return skip("resume_no_longer_valid");
    return { ok: true };
  }

  if (type === "tutor_new_session" || type === "guide_assignment") {
    if (!booking) return skip("assignment_no_longer_valid");
    if (!["confirmed", "pending"].includes(booking.status)) return skip("assignment_no_longer_valid");
    if (identity.tutorId && booking.tutor_id !== identity.tutorId) return skip("guide_reassigned");
    return { ok: true };
  }

  if (type === "guide_report_required" || type === "guide_report_overdue") {
    if (!booking || booking.status !== "completed") return skip("report_nudge_no_longer_valid");
    if (reportExists !== false) return skip("report_nudge_no_longer_valid");
    return { ok: true };
  }

  if (type === "booking_confirmed") {
    if (!booking) return skip("booking_missing");
    if (booking.status === "cancelled" || booking.status === "expired") return skip("booking_cancelled");
    return { ok: true };
  }

  if (type === "customer_no_show_parent" || type === "customer_no_show_guide") {
    if (!booking || booking.status !== "no_show") return skip("no_show_no_longer_valid");
    return { ok: true };
  }

  if (type === "welcome") {
    if (!profileExists) return skip("welcome_account_missing");
    return { ok: true };
  }

  if (type === "session_report_ready") {
    if (reportExists === false) return skip("report_missing");
    return { ok: true };
  }

  if (type === "package_balance_depleted") {
    if (packageMinutes == null || Number(packageMinutes) > 0) return skip("package_balance_recovered");
    return { ok: true };
  }

  if (type === "package_balance_low") {
    const minutes = Number(packageMinutes);
    if (!Number.isFinite(minutes) || minutes >= 60 || minutes <= 0) return skip("package_balance_recovered");
    return { ok: true };
  }

  if (type === "guide_attendance_request") {
    if (!booking || booking.status !== "confirmed") return skip("attendance_no_longer_valid");
    if (!reminderStillTimely(booking, nowMs)) return skip("attendance_expired");
    if (identity.tutorId && booking.tutor_id && booking.tutor_id !== identity.tutorId) {
      return skip("guide_reassigned");
    }
    if (attendanceAwaiting !== true) return skip("attendance_no_longer_valid");
    return { ok: true };
  }

  if (type === "guide_open_coverage") {
    if (!booking || booking.status !== "confirmed") return skip("coverage_no_longer_valid");
    if (!reminderStillTimely(booking, nowMs)) return skip("coverage_expired");
    if (coverageOfferOpen !== true) return skip("coverage_no_longer_valid");
    return { ok: true };
  }

  if (klass === RETRY_CLASS.HISTORICAL) return { ok: true };
  return { ok: true };
}
