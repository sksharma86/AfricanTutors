/**
 * Reminder policy for Study Hall PR8 (pure, unit-testable).
 * Parents: one 1-hour reminder only (no 24h, no T−5 “room open” ping).
 * Guides: one 1-hour operational reminder.
 */

/** Inclusive window (minutes before start) for the ~1h reminder cron sweep. */
export const REMINDER_1H_WINDOW_MIN = Object.freeze({ from: 50, to: 70 });

/**
 * @param {"customer"|"tutor"} role
 * @param {"24h"|"1h"} kind
 * @returns {boolean}
 */
export function shouldSendReminder(role, kind) {
  if (kind === "1h") return true;
  // Parent: never send day-before. Guide: 1h only (more thorough ops, not spam).
  return false;
}

/**
 * @param {number} nowMs
 * @returns {{ fromISO: string, toISO: string }}
 */
export function reminder1hWindow(nowMs = Date.now()) {
  const from = new Date(nowMs + REMINDER_1H_WINDOW_MIN.from * 60_000).toISOString();
  const to = new Date(nowMs + REMINDER_1H_WINDOW_MIN.to * 60_000).toISOString();
  return { fromISO: from, toISO: to };
}

/** Booking statuses that must never receive session reminders. */
export const REMINDER_EXCLUDED_STATUSES = Object.freeze([
  "cancelled",
  "expired",
  "completed",
  "no_show",
  "pending",
]);

/**
 * Email idempotency key for a 1h/24h reminder.
 * Parent keys stay per booking+role. Guide keys include the CURRENT Guide id
 * so a replacement Guide is not blocked by a prior Guide's claim.
 *
 * @param {{ kind: "24h"|"1h", bookingId: string, role: "customer"|"tutor", tutorId?: string | null }} input
 * @returns {string | null}
 */
export function reminderEmailIdempotencyKey(input) {
  const kind = input?.kind;
  const bookingId = input?.bookingId;
  const role = input?.role;
  if (!kind || !bookingId || !role) return null;
  if (role === "tutor") {
    const tutorId = typeof input.tutorId === "string" ? input.tutorId.trim() : "";
    if (!tutorId) return null;
    return `reminder-${kind}:${bookingId}:tutor:${tutorId}`;
  }
  return `reminder-${kind}:${bookingId}:${role}`;
}

/**
 * Revalidate live booking state before claiming a reminder send.
 *
 * @param {{
 *   status?: string | null,
 *   payment_status?: string | null,
 *   scheduled_start?: string | null,
 *   tutor_id?: string | null,
 * } | null | undefined} booking
 * @param {{ role: "customer"|"tutor", tutorId?: string | null }} opts
 */
export function reminderStillValid(booking, opts) {
  if (!booking) return false;
  if (booking.status !== "confirmed") return false;
  if (booking.payment_status === "awaiting_payment") return false;
  if (!booking.scheduled_start) return false;
  if (opts?.role === "tutor") {
    const current = typeof booking.tutor_id === "string" ? booking.tutor_id : "";
    const expected = typeof opts.tutorId === "string" ? opts.tutorId.trim() : "";
    if (!current || !expected || current !== expected) return false;
  }
  return true;
}
