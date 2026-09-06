/**
 * Central Study Hall 365 entitlement rules (pure).
 *
 * Stripe statuses that GRANT booking entitlement:
 *   - active
 *   - canceled + cancel_at_period_end + now < current_period_end
 *     (already-paid window; no prorated refund)
 *
 * Stripe statuses that DO NOT grant entitlement:
 *   - trialing          (we do not use Stripe subscription trials)
 *   - past_due          (renewal payment failed; Stripe is retrying — no free access)
 *   - unpaid            (collection stopped)
 *   - incomplete        (first invoice not paid)
 *   - incomplete_expired
 *   - paused            (not offered; if Stripe ever sets it, no access)
 *   - ended             (internal terminal after Stripe deleted/ended)
 *
 * past_due is an explicit denial: a failed renewal must not leave indefinite
 * daily Study Halls. Transient Stripe retries stay past_due until paid
 * (active) or collection stops (unpaid/canceled).
 */

import {
  instantInPaidWindow,
  localDateForInstant,
  localDateOverlapsPaidPeriod,
  safeTimeZone,
} from "./calendar.mjs";

/** @typedef {"active"|"trialing"|"past_due"|"unpaid"|"incomplete"|"incomplete_expired"|"paused"|"canceled"|"ended"} StudyHall365Status */

export const STUDY_HALL_365_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
  "canceled",
  "ended",
];

export const STUDY_HALL_365_ENTITLED_STATUSES = Object.freeze(["active"]);

/**
 * @param {string|null|undefined} status
 * @param {{ cancelAtPeriodEnd?: boolean, periodEnd?: Date|string|number|null, endedAt?: Date|string|number|null, now?: Date|string|number }} [opts]
 */
export function isSubscriptionEntitled(status, opts = {}) {
  const now = opts.now != null ? new Date(opts.now) : new Date();
  if (opts.endedAt) {
    const ended = new Date(opts.endedAt);
    if (Number.isFinite(ended.getTime()) && ended.getTime() <= now.getTime()) return false;
  }
  if (!opts.periodEnd) return false;
  const periodEnd = new Date(opts.periodEnd);
  if (!Number.isFinite(periodEnd.getTime()) || now.getTime() >= periodEnd.getTime()) return false;

  if (status === "active") return true;
  if (status === "canceled" && opts.cancelAtPeriodEnd) return true;
  return false;
}

/**
 * @param {{
 *   status?: string|null,
 *   cancelAtPeriodEnd?: boolean,
 *   periodStart?: Date|string|number|null,
 *   periodEnd?: Date|string|number|null,
 *   endedAt?: Date|string|number|null,
 *   consumed?: boolean,
 *   timeZone?: string,
 *   localDate?: string,
 *   now?: Date|string|number,
 *   bookingStart?: Date|string|number|null,
 * }} input
 */
export function evaluateStudyHall365Day(input) {
  const now = input.now != null ? new Date(input.now) : new Date();
  const timeZone = safeTimeZone(input.timeZone);
  const localDate = input.localDate || localDateForInstant(now, timeZone);
  const periodStart = input.periodStart ?? null;
  const periodEnd = input.periodEnd ?? null;

  const statusOk = isSubscriptionEntitled(input.status, {
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    periodEnd,
    endedAt: input.endedAt,
    now,
  });

  if (!statusOk) {
    return {
      entitled: false,
      source: "none",
      date: localDate,
      timeZone,
      reason: input.status ? "status_not_entitled" : "no_membership",
      consumed: Boolean(input.consumed),
    };
  }

  if (!localDateOverlapsPaidPeriod(localDate, timeZone, periodStart, periodEnd)) {
    return {
      entitled: false,
      source: "none",
      date: localDate,
      timeZone,
      reason: "outside_paid_period",
      consumed: Boolean(input.consumed),
    };
  }

  if (input.bookingStart != null && !instantInPaidWindow(input.bookingStart, periodStart, periodEnd)) {
    return {
      entitled: false,
      source: "none",
      date: localDate,
      timeZone,
      reason: "booking_outside_paid_window",
      consumed: Boolean(input.consumed),
    };
  }

  if (input.consumed) {
    return {
      entitled: false,
      source: "none",
      date: localDate,
      timeZone,
      reason: "already_consumed",
      consumed: true,
    };
  }

  return {
    entitled: true,
    source: "study_hall_365",
    date: localDate,
    timeZone,
    reason: "available",
    consumed: false,
  };
}

/**
 * Combined future-booking hint. Unused free first Study Hall wins, then an
 * unused entitled 365 day, then prepaid minutes, then PAYG. A consumed 365
 * day does not block prepaid/PAYG. PAYG is always a fallback.
 *
 * @param {{
 *   studyHall365?: ReturnType<typeof evaluateStudyHall365Day> | null,
 *   prepaidMinutes?: number,
 *   freeTrialEligible?: boolean,
 * }} input
 */
export function chooseBookingSource(input) {
  if (input.freeTrialEligible) {
    return { source: "free_trial", entitled: true, reason: "free_first_study_hall" };
  }
  if (input.studyHall365?.entitled) {
    return { source: "study_hall_365", entitled: true, reason: input.studyHall365.reason };
  }
  if ((Number(input.prepaidMinutes) || 0) >= 60) {
    return { source: "prepaid", entitled: true, reason: "prepaid_minutes" };
  }
  return { source: "payg", entitled: true, reason: "pay_as_you_go" };
}
