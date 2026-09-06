/**
 * Customer-facing booking funding labels and prepaid Study Hall counts.
 * Presentation only — book_session remains the funding authority.
 */

export const CUSTOMER_STUDY_HALL_MINUTES = 60;
export const CUSTOMER_PAYG_CENTS = 1200;

/**
 * @param {string | null | undefined} funding
 */
export function customerFundingLabel(funding) {
  switch (funding) {
    case "free_trial":
      return "First Study Hall free";
    case "study_hall_365":
      return "Included with Study Hall 365";
    case "prepaid":
    case "package":
      return "Uses 1 prepaid Study Hall";
    case "credit":
      return "Covered by account credit";
    case "payg":
    case "stripe":
      return "$12";
    default:
      return "Study Hall";
  }
}

/**
 * Prepaid inventory as Study Halls. Non-multiples of 60 stay honest.
 *
 * @param {number | null | undefined} minutes
 */
export function formatPrepaidStudyHallBalance(minutes) {
  const raw = Math.max(0, Math.round(Number(minutes) || 0));
  const halls = Math.floor(raw / CUSTOMER_STUDY_HALL_MINUTES);
  const leftover = raw % CUSTOMER_STUDY_HALL_MINUTES;
  if (raw === 0) return "0 Study Halls remaining";
  if (leftover === 0) {
    return halls === 1 ? "1 Study Hall remaining" : `${halls} Study Halls remaining`;
  }
  if (halls === 0) return `${leftover} leftover minutes`;
  const hallLabel = halls === 1 ? "1 Study Hall" : `${halls} Study Halls`;
  return `${hallLabel} + ${leftover} leftover minutes`;
}
