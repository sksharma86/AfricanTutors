/**
 * Booking confirmation funding presentation (pure).
 * Authoritative source is bookings.funding_source. Economics are unchanged.
 */

export const NOTIFICATION_FUNDING_SOURCES = Object.freeze([
  "free_trial",
  "study_hall_365",
  "prepaid",
  "credit",
  "payg",
  "request",
]);

/**
 * Resolve the funding token used in booking-confirmation copy.
 *
 * @param {{
 *   isFreeTrial?: boolean | null,
 *   fundingSource?: string | null,
 *   stripePaidCents?: number | null,
 *   creditAppliedCents?: number | null,
 *   hasPaymentRow?: boolean,
 * }} input
 * @returns {string | null}
 */
export function resolveNotificationFunding(input = {}) {
  const source = typeof input.fundingSource === "string" ? input.fundingSource.trim() : "";
  if (source && NOTIFICATION_FUNDING_SOURCES.includes(source)) {
    return source;
  }

  if (input.isFreeTrial) return "free_trial";

  // Historical rows: never infer Study Hall 365 from zero Stripe/credit.
  const stripe = Number(input.stripePaidCents) || 0;
  const credit = Number(input.creditAppliedCents) || 0;
  if (stripe > 0) return "payg";
  if (credit > 0) return "credit";
  if (input.hasPaymentRow) return "prepaid";
  return null;
}

export function isPrepaidFunding(funding) {
  return funding === "prepaid" || funding === "package";
}

/**
 * Parent-facing confirmation line. `package` / `stripe` are historical aliases.
 *
 * @param {string | null | undefined} funding
 * @returns {string | null}
 */
export function bookingFundingLine(funding) {
  switch (funding) {
    case "free_trial":
      return "This Study Hall used the family's free Study Hall.";
    case "study_hall_365":
      return "This Study Hall is included with Study Hall 365.";
    case "prepaid":
    case "package":
      return "This Study Hall used a prepaid Study Hall.";
    case "credit":
      return "This Study Hall used account credit.";
    case "payg":
    case "stripe":
      return "This Study Hall was booked at the applicable pay-as-you-go price.";
    default:
      return null;
  }
}
