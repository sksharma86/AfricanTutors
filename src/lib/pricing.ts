/**
 * Customer-facing pricing for Study Hall (at home).
 *
 * IMPORTANT: This module holds ONLY customer-facing pricing. Never place Guide
 * compensation or internal unit economics here (or anywhere shipped to the
 * browser). Those live in the internal `BUSINESS_MODEL.md` document.
 *
 * Study Hall customer booking is exactly 60 minutes / $12 PAYG.
 * Historical 120- and 180-minute bookings remain readable; they are not
 * offered to new customer bookings.
 *   - 1 Study Hall (60 min) = $12
 *   - A new account's first 60-minute Study Hall session is FREE (no card)
 *
 * Server SQL (`session_list_price_cents` / booking_quote / book_session /
 * create_booking) is the financial authority — keep these numbers in sync.
 * Free-trial bookings must NEVER inherit the paid list price.
 */

export interface SessionOption {
  minutes: number;
  priceUsd: number;
  label: string;
}

/** New customer Study Halls are exactly one hour. */
export const SESSION_OPTIONS: SessionOption[] = [
  { minutes: 60, priceUsd: 12, label: "60 minutes" },
];

export type StudyHallDuration = 60;

export const STUDY_HALL_DURATIONS: StudyHallDuration[] = [60];

export function isStudyHallDuration(n: unknown): n is StudyHallDuration {
  return n === 60;
}

/** Historical customer durations that may still exist on old bookings. */
export function isHistoricalStudyHallDuration(n: unknown): n is 60 | 120 | 180 {
  return n === 60 || n === 120 || n === 180;
}

/** Primary retail pay-as-you-go rate (per hour). */
export const PAYG_MINUTES = 60;
export const PAYG_PRICE_USD = 12;

/** Lowest prepaid effective hourly rate (28 Hour Routine). Marketing only. */
export const PREPAID_FROM_HOURLY_USD = 9;

/** Length of the free introductory Study Hall session (one per account). */
export const FREE_TRIAL_MINUTES = 60;

/** Primary acquisition call-to-action label (kept consistent site-wide). */
export const FREE_TRIAL_CTA = "Try your first Study Hall free";

/** Preferred marketing floor — prepaid 28h effective rate, not PAYG. */
export const PLANS_AS_LOW_AS_LABEL = `Plans as low as $${PREPAID_FROM_HOURLY_USD}/hour`;

/** Friction-reducing microcopy. Use sparingly — do not repeat site-wide. */
export const NO_CARD_REQUIRED = "No credit card required.";

/** Accurate marketing price framing — prepaid floor, not PAYG. */
export const PLANS_FROM_LABEL = `Plans from $${PREPAID_FROM_HOURLY_USD}/hour`;
export const AS_LOW_AS_LABEL = `As low as $${PREPAID_FROM_HOURLY_USD}/hour`;

export function formatUsd(amount: number): string {
  return `$${amount}`;
}

/** Format integer cents as a USD string (e.g. 1300 -> "$13.00", 2000 -> "$20"). */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}
