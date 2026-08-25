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
