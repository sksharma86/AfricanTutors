/**
 * Parent Home post-session next step. Presentation only.
 * Uses existing free-trial + booking history — no new tracking.
 */

import { accountFreeTrialUsed } from "./free-trial.mjs";
import { lastCompletedStudyHall, parentStudyHallLists } from "./parent-portal.mjs";

export const FREE_CONVERT_HEADLINE = "Keep the routine going.";
export const FREE_CONVERT_BODY = "Book your next Study Hall.";
export const BOOK_ANOTHER_LABEL = "Book another Study Hall";
export const BUY_HOURS_LABEL = "Buy hours & save";

function hasPaidBooking(bookings) {
  return (bookings ?? []).some((b) => b && !b.is_free_trial && b.status !== "cancelled");
}

/**
 * @param {{
 *   bookings?: { id?: string, is_free_trial?: boolean, status?: string, scheduled_start?: string|null, scheduled_end?: string|null }[],
 *   last?: { id?: string, is_free_trial?: boolean, status?: string } | null,
 *   report?: unknown,
 *   minutes?: number,
 *   nowMs?: number,
 * }} input
 */
export function parentPostSessionOffer({ bookings = [], last = null, report = null, minutes = 0, nowMs = Date.now() } = {}) {
  const freeUsed = accountFreeTrialUsed(bookings);
  const resolvedLast = last ?? lastCompletedStudyHall(bookings, nowMs);
  const { next } = parentStudyHallLists(bookings, nowMs);
  const lastIsCompletedFree =
    Boolean(resolvedLast?.is_free_trial) &&
    (resolvedLast?.status === "completed" || resolvedLast?.status === "no_show");
  const reportReady = Boolean(report);

  if (!freeUsed) {
    return { kind: "free_available" };
  }

  const paid = hasPaidBooking(bookings);

  if (lastIsCompletedFree && reportReady && !paid && !next) {
    return {
      kind: "free_convert",
      headline: FREE_CONVERT_HEADLINE,
      body: FREE_CONVERT_BODY,
      bookLabel: BOOK_ANOTHER_LABEL,
      bookHref: "/dashboard/student/book",
      showBuyHours: Number(minutes) === 0,
    };
  }

  if (!next && paid) {
    return {
      kind: "repeat",
      headline: null,
      body: null,
      bookLabel: BOOK_ANOTHER_LABEL,
      bookHref: "/dashboard/student/book",
      showBuyHours: Number(minutes) === 0,
    };
  }

  return { kind: "none" };
}

export function parentRecordingHomeLabel(recording) {
  if (!recording) return null;
  if (recording.status === "failed") return "Recording unavailable";
  if (recording.deleted_at) return "Recording expired";
  if (recording.status !== "completed") return "Recording processing";
  return "Recording ready";
}
