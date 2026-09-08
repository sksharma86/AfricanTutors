/**
 * PR7E — retry / stale-delivery policy (pure).
 *
 * Automatic retry never creates a new idempotency key. `sent` is terminal.
 * Bounce/complaint is terminal. Skipped is terminal unless an operator uses
 * the existing failed-only admin path (skipped rows are not auto-retried).
 *
 * attempts: number of actual provider send attempts.
 *   - claim_email_delivery inserts attempts=1 for the first send
 *   - each later provider send increments immediately before sendEmail
 *   - cron inspection / revalidation skip does not increment
 *   - retry_email_delivery (admin) still increments on failed→pending lease
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
});

const CURRENT_STATE_TYPES = new Set([
  "reminder_1h",
  "reminder_24h",
  "session_reminder_1h",
  "guide_session_reminder",
  "payment_failure",
  "study_hall_365_cancellation_scheduled",
  "study_hall_365_resumed",
  "tutor_new_session",
  "guide_assignment",
  "guide_report_required",
  "guide_report_overdue",
  "guide_attendance_request",
  "guide_open_coverage",
  "package_balance_low",
  "package_balance_depleted",
  "booking_confirmed",
]);

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
  const type = String(notificationType || "");
  if (NON_EMAIL_TYPES.has(type) || /_sms$|_whatsapp|whatsapp/i.test(type)) return RETRY_CLASS.NON_EMAIL;
  if (CURRENT_STATE_TYPES.has(type)) return RETRY_CLASS.CURRENT_STATE;
  return RETRY_CLASS.HISTORICAL;
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
 * @param {{
 *   status?: string | null,
 *   attempts?: number | null,
 *   next_retry_at?: string | null,
 *   updated_at?: string | null,
 *   created_at?: string | null,
 *   to_email?: string | null,
 *   error?: string | null,
 *   notification_type?: string | null,
 *   provider_message_id?: string | null,
 * }} row
 */
export function isRetryEligible(row, nowMs = Date.now()) {
  if (!row) return false;
  if (row.status === "sent" || row.status === "skipped") return false;
  if (retryClassForType(row.notification_type) === RETRY_CLASS.NON_EMAIL) return false;
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
    if (/expired|stale_unconfirmed|no longer valid|recovered|no_longer/i.test(err)) return "skipped/expired";
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
 * @param {{ notification_type?: string | null, idempotency_key?: string | null, booking_id?: string | null, recipient_account_id?: string | null }} row
 */
export function parseDeliveryIdentity(row) {
  const type = String(row?.notification_type || "");
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
  };

  const reminderTutor = key.match(/^reminder-1h:([^:]+):tutor:([^:]+)$/);
  if (reminderTutor) {
    out.bookingId = out.bookingId || reminderTutor[1];
    out.tutorId = reminderTutor[2];
    return out;
  }
  const reminderParent = key.match(/^reminder-1h:([^:]+):customer$/);
  if (reminderParent) {
    out.bookingId = out.bookingId || reminderParent[1];
    return out;
  }
  const payFail = key.match(/^365-payment-failure:(.+)$/);
  if (payFail) {
    out.invoiceId = payFail[1];
    return out;
  }
  const subLife = key.match(/^365-(?:started|ended|renewed|cancel-scheduled|resumed):([^:]+)/);
  if (subLife) {
    out.stripeSubscriptionId = subLife[1];
    return out;
  }
  const noShow = key.match(/^customer-no-show-(?:parent|guide):(.+)$/);
  if (noShow) {
    out.bookingId = out.bookingId || noShow[1];
    return out;
  }
  const tutorNew = key.match(/^tutor-new-session:([^:]+):(.+)$/);
  if (tutorNew) {
    out.bookingId = out.bookingId || tutorNew[1];
    out.tutorId = tutorNew[2];
    return out;
  }
  const welcome = key.match(/^welcome:(.+)$/);
  if (welcome) {
    out.accountId = out.accountId || welcome[1];
    return out;
  }
  const report = key.match(/^session-report-ready:(.+)$/);
  if (report) {
    out.reportId = report[1];
    return out;
  }
  const openCov = key.match(/^open-coverage:([^:]+):([^:]+):([^:]+)(?::email)?$/);
  if (openCov) {
    out.tutorId = openCov[1];
    out.bookingId = out.bookingId || openCov[2];
    out.searchKey = openCov[3];
    return out;
  }
  const attendance = key.match(/^guide-attendance-block:([^:]+):([^:]+):([^:]+)$/);
  if (attendance) {
    out.tutorId = attendance[1];
    out.bookingId = out.bookingId || attendance[2];
    return out;
  }
  return out;
}
