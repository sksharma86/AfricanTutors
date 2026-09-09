/**
 * PR7E — retry / stale-delivery policy (pure).
 *
 * Automatic retry is EXPLICIT ALLOWLIST ONLY. Unknown/null/unhandled types
 * never default to sending stored content.
 *
 * attempts: number of actual provider send attempts.
 *   - claim_email_delivery inserts attempts=1 for the first send
 *   - each later provider send increments immediately before sendEmail
 *   - cron inspection / revalidation skip does not increment
 *   - retry_email_delivery (admin) still increments on failed→pending lease
 *
 * auto_retry_eligible: prospective marker. Pre-PR7E rows stay false.
 * New claims and PR7E-aware complete/admin retry set it true.
 */

export const EMAIL_RETRY_MAX_ATTEMPTS = 5;
/** Fresh pending rows younger than this are not stolen. */
export const EMAIL_STALE_PENDING_MINUTES = 15;
/** Cron cadence. First automatic retry waits at least one cycle. */
export const EMAIL_RETRY_CRON_PATH = "/api/cron/notification-retry";

/** Minutes to wait after a failed attempt N before the next lease. Index = attempts. */
export const EMAIL_RETRY_BACKOFF_MINUTES = Object.freeze({
  1: 15,
  2: 15,
  3: 60,
  4: 360,
});

export const RETRY_CLASS = Object.freeze({
  HISTORICAL: "historical",
  CURRENT_STATE: "current_state",
  NON_EMAIL: "non_email",
  UNSUPPORTED: "unsupported",
});

/**
 * Current-state types. Each MUST have a dedicated revalidation handler.
 * reminder_24h is intentionally absent (inactive; never auto-retried).
 */
export const CURRENT_STATE_RETRY_TYPES = Object.freeze([
  "reminder_1h",
  "session_reminder_1h",
  "guide_session_reminder",
  "payment_failure",
  "study_hall_365_cancellation_scheduled",
  "study_hall_365_resumed",
  "study_hall_365_ended",
  "tutor_new_session",
  "guide_assignment",
  "guide_report_required",
  "guide_report_overdue",
  "guide_attendance_request",
  "guide_open_coverage",
  "package_balance_low",
  "package_balance_depleted",
  "booking_confirmed",
  "guide_reassignment_failed",
  "coverage_cancellation",
  "tutor_removed",
]);

/**
 * Historical types. Delayed delivery remains a true statement of a past event,
 * with the extra checks in decideRetryAction where noted.
 */
export const HISTORICAL_RETRY_TYPES = Object.freeze([
  "welcome",
  "customer_no_show_parent",
  "customer_no_show_guide",
  "study_hall_365_started",
  "study_hall_365_renewed",
  "package_purchased",
  "account_credit_applied",
  "refund_issued",
  "dispute_received",
  "dispute_resolved",
  "cancellation",
  "tutor_cancellation",
  "tutor_approved",
  "admin_alert",
  "session_report_ready",
  "coverage_failure_protection",
]);

const CURRENT_STATE_SET = new Set(CURRENT_STATE_RETRY_TYPES);
const HISTORICAL_SET = new Set(HISTORICAL_RETRY_TYPES);

const NON_EMAIL_TYPES = new Set([
  "reminder_1h_sms",
  "cancellation_sms",
  "coverage_cancellation_sms",
  "coverage_failure_protection_sms",
  "guide_attendance_whatsapp",
  "sms",
]);

const PERMANENT_ERROR =
  /resend 400\b|resend 403\b|resend 409\b|resend 422\b|invalid recipient|no recipient|email\.bounced|email\.complained|bounced|complained|permanent/i;

export function retryClassForType(notificationType) {
  const type = String(notificationType ?? "").trim();
  if (!type) return RETRY_CLASS.UNSUPPORTED;
  if (NON_EMAIL_TYPES.has(type) || /_sms$|_whatsapp|whatsapp/i.test(type)) return RETRY_CLASS.NON_EMAIL;
  if (CURRENT_STATE_SET.has(type)) return RETRY_CLASS.CURRENT_STATE;
  if (HISTORICAL_SET.has(type)) return RETRY_CLASS.HISTORICAL;
  return RETRY_CLASS.UNSUPPORTED;
}

export function isEmailRecipient(toEmail) {
  const to = String(toEmail || "").trim();
  if (!to) return false;
  if (/^(sms:|whatsapp:)/i.test(to)) return false;
  return to.includes("@");
}

export function isPermanentFailure(error) {
  return PERMANENT_ERROR.test(String(error || ""));
}

export function backoffMinutesForAttempt(attempts) {
  const n = Number(attempts);
  if (!Number.isFinite(n) || n < 1) return EMAIL_RETRY_BACKOFF_MINUTES[1];
  return EMAIL_RETRY_BACKOFF_MINUTES[n] ?? EMAIL_RETRY_BACKOFF_MINUTES[4];
}

export function nextRetryAt(attempts, nowMs = Date.now()) {
  const mins = backoffMinutesForAttempt(attempts);
  return new Date(nowMs + mins * 60_000).toISOString();
}

export function isStalePending(row, nowMs = Date.now()) {
  if (!row || row.status !== "pending") return false;
  const updated = Date.parse(row.updated_at || row.created_at || "");
  if (!Number.isFinite(updated)) return false;
  return nowMs - updated >= EMAIL_STALE_PENDING_MINUTES * 60_000;
}

/**
 * Automatic-retry eligibility. Does not increment attempts.
 * Failed: requires next_retry_at (set only by PR7E-aware complete_email_delivery).
 * Pending: requires auto_retry_eligible (new claims / PR7E flow only).
 */
export function isRetryEligible(row, nowMs = Date.now()) {
  if (!row) return false;
  if (row.status === "sent" || row.status === "skipped") return false;
  const klass = retryClassForType(row.notification_type);
  if (klass === RETRY_CLASS.NON_EMAIL || klass === RETRY_CLASS.UNSUPPORTED) return false;
  if (!isEmailRecipient(row.to_email)) return false;
  if (isPermanentFailure(row.error)) return false;
  const attempts = Number(row.attempts ?? 0);
  if (attempts >= EMAIL_RETRY_MAX_ATTEMPTS) return false;

  if (row.status === "failed") {
    if (row.next_retry_at) {
      const next = Date.parse(row.next_retry_at);
      if (Number.isFinite(next) && next > nowMs) return false;
    } else {
      return false;
    }
    return true;
  }
  if (row.status === "pending") {
    if (row.auto_retry_eligible !== true) return false;
    if (row.provider_message_id) return false;
    return isStalePending(row, nowMs);
  }
  return false;
}

export function deliveryOpsLabel(row) {
  const status = row?.status;
  if (status === "sent") return "sent";
  if (status === "skipped") {
    const err = String(row.error || "");
    if (/expired|stale_unconfirmed|no longer valid|recovered|no_longer|unsupported|unknown_notification/i.test(err)) {
      return "skipped/expired";
    }
    return "skipped";
  }
  if (status === "pending") {
    if (row.next_retry_at || Number(row.attempts) > 1) return "failed/retrying";
    return "pending";
  }
  if (status === "failed") {
    if (isPermanentFailure(row.error) || Number(row.attempts) >= EMAIL_RETRY_MAX_ATTEMPTS) {
      return "terminal failure";
    }
    if (!row.next_retry_at) return "failed";
    return "failed/retrying";
  }
  return String(status || "unknown");
}

/**
 * Normalize jsonb returned by claim_email_delivery_retry_batch.
 * @param {unknown} data
 * @returns {object[]}
 */
export function leasedRetryRows(data) {
  if (Array.isArray(data)) return data.filter((row) => row && typeof row === "object");
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed.filter((row) => row && typeof row === "object") : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Structured identity from our own idempotency keys — not HTML.
 */
export function parseDeliveryIdentity(row) {
  const type = String(row?.notification_type || "").trim();
  const key = String(row?.idempotency_key || "");
  const bookingId = row?.booking_id || null;
  const accountId = row?.recipient_account_id || null;
  const out = {
    type,
    key,
    bookingId,
    accountId,
    tutorId: null,
    invoiceId: null,
    stripeSubscriptionId: null,
    reportId: null,
    searchKey: null,
    keyKind: null,
  };

  const reminderTutor = key.match(/^reminder-1h:([^:]+):tutor:([^:]+)$/);
  if (reminderTutor) {
    out.bookingId = out.bookingId || reminderTutor[1];
    out.tutorId = reminderTutor[2];
    out.keyKind = "reminder_tutor";
    return out;
  }
  const reminderParent = key.match(/^reminder-1h:([^:]+):customer$/);
  if (reminderParent) {
    out.bookingId = out.bookingId || reminderParent[1];
    out.keyKind = "reminder_parent";
    return out;
  }
  const payFail = key.match(/^365-payment-failure:(.+)$/);
  if (payFail) {
    out.invoiceId = payFail[1];
    out.keyKind = "payment_failure";
    return out;
  }
  const subLife = key.match(/^365-(?:started|ended|renewed|cancel-scheduled|resumed):([^:]+)/);
  if (subLife) {
    out.stripeSubscriptionId = subLife[1];
    out.keyKind = "365_lifecycle";
    return out;
  }
  const noShow = key.match(/^customer-no-show-(?:parent|guide):(.+)$/);
  if (noShow) {
    out.bookingId = out.bookingId || noShow[1];
    out.keyKind = "no_show";
    return out;
  }
  const tutorNew = key.match(/^tutor-new-session:([^:]+):(.+)$/);
  if (tutorNew) {
    out.bookingId = out.bookingId || tutorNew[1];
    out.tutorId = tutorNew[2];
    out.keyKind = "tutor_new_session";
    return out;
  }
  const tutorRemoved = key.match(/^tutor-removed:([^:]+):(.+)$/);
  if (tutorRemoved) {
    out.bookingId = out.bookingId || tutorRemoved[1];
    out.tutorId = tutorRemoved[2];
    out.keyKind = "tutor_removed";
    return out;
  }
  const welcome = key.match(/^welcome:(.+)$/);
  if (welcome) {
    out.accountId = out.accountId || welcome[1];
    out.keyKind = "welcome";
    return out;
  }
  const report = key.match(/^session-report-ready:(.+)$/);
  if (report) {
    out.reportId = report[1];
    out.keyKind = "session_report";
    return out;
  }
  const openCov = key.match(/^open-coverage:([^:]+):([^:]+):([^:]+)(?::email)?$/);
  if (openCov) {
    out.tutorId = openCov[1];
    out.bookingId = out.bookingId || openCov[2];
    out.searchKey = openCov[3];
    out.keyKind = "open_coverage";
    return out;
  }
  const attendance = key.match(/^guide-attendance-block:([^:]+):([^:]+):([^:]+)$/);
  if (attendance) {
    out.tutorId = attendance[1];
    out.bookingId = out.bookingId || attendance[2];
    out.keyKind = "attendance";
    return out;
  }
  return out;
}
