/**
 * Transactional SMS copy for Study Hall (pure). Never include phone numbers,
 * Daily URLs, or secrets. Call Parent urgent SMS stays in call-parent.mjs.
 */

import { formatWhen } from "../email/templates.mjs";

/**
 * Parent ~1h session reminder (product-preferred direction).
 *
 * @param {{ studentName?: string|null, whenISO?: string|null, tz?: string|null }} ctx
 */
export function parentSessionReminderSms(ctx) {
  const name = (ctx.studentName || "your child").trim() || "your child";
  const when = formatWhen(ctx.whenISO, ctx.tz);
  // Prefer a short local time if formatWhen is long — keep full when for clarity.
  return `Study Hall (at home) reminder: ${name}'s Study Hall starts at ${when}. Please have her ready at her workspace. The room opens 5 minutes before.`;
}

/**
 * Parent cancellation SMS (immediate / important).
 * @param {{ studentName?: string|null, whenISO?: string|null, tz?: string|null }} ctx
 */
export function parentCancellationSms(ctx) {
  const name = (ctx.studentName || "your child").trim() || "your child";
  const when = formatWhen(ctx.whenISO, ctx.tz);
  return `Study Hall (at home): ${name}'s session (${when}) was cancelled. Check your email or dashboard for details.`;
}

/**
 * Parent reassignment SMS — reserved for material customer-facing changes only.
 * Successful internal Guide swaps must NOT use this (parents book a time, not a Guide).
 * Kept for future session-impact paths; PR8 successful reassignment never sends it.
 */
export function parentReassignmentSms(ctx) {
  const name = (ctx.studentName || "your child").trim() || "your child";
  const when = formatWhen(ctx.whenISO, ctx.tz);
  return `Study Hall (at home): ${name}'s session at ${when} was updated. Check your email or dashboard for details.`;
}
