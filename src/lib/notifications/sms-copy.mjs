/**
 * Transactional SMS copy for Study Hall (pure). Never include phone numbers,
 * Daily URLs, or secrets. Call Parent urgent SMS stays in call-parent.mjs.
 */

import { formatWhen } from "../email/templates.mjs";
import { possessiveStudyHall } from "../household-children.mjs";

function namesOf(ctx) {
  if (Array.isArray(ctx.studentNames) && ctx.studentNames.length) return ctx.studentNames;
  const name = (ctx.studentName || "your child").trim() || "your child";
  return [name];
}

/**
 * Parent ~1h session reminder (product-preferred direction).
 *
 * @param {{ studentName?: string|null, studentNames?: string[]|null, whenISO?: string|null, tz?: string|null }} ctx
 */
export function parentSessionReminderSms(ctx) {
  const names = namesOf(ctx);
  const when = formatWhen(ctx.whenISO, ctx.tz);
  if (names.length === 1) {
    const name = names[0];
    return `Study Hall: ${name}'s Study Hall starts at ${when}. Please have her ready at her workspace. The room opens 5 minutes before.`;
  }
  return `Study Hall: ${possessiveStudyHall(names)} starts at ${when}. Please have them ready at their workspace. The room opens 5 minutes before.`;
}

/**
 * Parent cancellation SMS (immediate / important).
 * @param {{ studentName?: string|null, studentNames?: string[]|null, whenISO?: string|null, tz?: string|null }} ctx
 */
export function parentCancellationSms(ctx) {
  const names = namesOf(ctx);
  const when = formatWhen(ctx.whenISO, ctx.tz);
  if (names.length === 1) {
    return `Study Hall: ${names[0]}'s session (${when}) was cancelled. Check your email or dashboard for details.`;
  }
  return `Study Hall: ${possessiveStudyHall(names)} (${when}) was cancelled. Check your email or dashboard for details.`;
}

/**
 * Parent reassignment SMS — reserved for material customer-facing changes only.
 * Successful internal Guide swaps must NOT use this (parents book a time, not a Guide).
 * Kept for future session-impact paths; PR8 successful reassignment never sends it.
 */
/**
 * Parent SMS when Study Hall cancels because it cannot provide a Guide.
 * Do not name or blame the Guide.
 */
export function parentCoverageCancellationSms(ctx = {}) {
  void ctx;
  return "Study Hall: we're unable to provide a Guide for today's Study Hall. Your session value has been restored. We apologize for the disruption.";
}

export function parentCoverageFailureProtectionSms(ctx = {}) {
  void ctx;
  return "Study Hall: we weren't able to confirm Guide coverage for your upcoming Study Hall, so we cancelled it. Your booking is restored and we've added a complimentary hour. You can book again anytime.";
}

export function parentReassignmentSms(ctx) {
  const names = namesOf(ctx);
  const when = formatWhen(ctx.whenISO, ctx.tz);
  if (names.length === 1) {
    return `Study Hall: ${names[0]}'s session at ${when} was updated. Check your email or dashboard for details.`;
  }
  return `Study Hall: ${possessiveStudyHall(names)} at ${when} was updated. Check your email or dashboard for details.`;
}

export function parentPaymentFailureSms(ctx = {}) {
  const appUrl = typeof ctx.appUrl === "string" ? ctx.appUrl.replace(/\/+$/, "") : "";
  const hours = appUrl ? `${appUrl}/dashboard/student/packages` : "";
  if (hours) {
    return `Study Hall: We couldn't process your Study Hall 365 payment. Review billing: ${hours}`;
  }
  return "Study Hall: We couldn't process your Study Hall 365 payment. Please review your billing in your account.";
}

export function parentNoShowSms(ctx = {}) {
  void ctx;
  return "Study Hall: Today's scheduled Study Hall was marked missed. Details are available in your Parent account.";
}
