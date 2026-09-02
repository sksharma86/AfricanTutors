/**
 * Emergency open-coverage offers after a T-20 missed confirmation.
 * Policy only — eligibility is tutor_is_available / approved Guide,
 * same as list_reassignment_candidates. First valid claim wins.
 */

export const OPEN_COVERAGE_SOURCE = "emergency";
export const OFFER_STATUSES = Object.freeze(["open", "claimed", "closed"]);
export const CLAIM_REASONS = Object.freeze({
  won: "won",
  already_covered: "already_covered",
  expired: "expired",
  ineligible: "ineligible",
  overlap: "overlap",
  cancelled: "cancelled",
  unauthorized: "unauthorized",
});

export function openCoveragePath(bookingId) {
  return `/dashboard/tutor/open-coverage/${bookingId}`;
}

/** Deep-link after login for emergency open-coverage offers only. */
export function isSafeOpenCoveragePath(path) {
  return /^\/dashboard\/tutor\/open-coverage\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(path ?? ""),
  );
}

export function openCoverageUrl(appUrl, bookingId) {
  return `${String(appUrl || "").replace(/\/+$/, "")}${openCoveragePath(bookingId)}`;
}

export function openCoverageNotifyKey({ bookingId, tutorId, searchKey }) {
  return `open-coverage:${tutorId}:${bookingId}:${searchKey}`;
}

/** V1 email claim key. Distinct from any prior WhatsApp claim on the base key. */
export function openCoverageEmailNotifyKey(opts) {
  return `${openCoverageNotifyKey(opts)}:email`;
}

export function canStartCoverageSearch({ booking, assignment = null } = {}) {
  if (!booking || booking.status !== "confirmed") return { ok: false, reason: "ineligible" };
  if (!booking.tutor_id || !booking.scheduled_start) return { ok: false, reason: "ineligible" };
  if (assignment?.status === "confirmed" && assignment.tutor_id === booking.tutor_id) {
    return { ok: false, reason: "covered" };
  }
  if (assignment?.status !== "missed") return { ok: false, reason: "not_missed" };
  return { ok: true, searchKey: assignment.id };
}

export function offerIsClaimable(offer, { booking, nowMs = Date.now() } = {}) {
  if (!offer || offer.status !== "open") return { ok: false, reason: "already_covered" };
  if (!booking || booking.status !== "confirmed") return { ok: false, reason: "cancelled" };
  const start = Date.parse(booking.scheduled_start);
  if (Number.isFinite(start) && nowMs >= start) return { ok: false, reason: "expired" };
  return { ok: true };
}

export function claimResultMessage(reason) {
  if (reason === "won") return "You've accepted this Study Hall.";
  if (reason === "already_covered") return "This Study Hall has already been covered.";
  if (reason === "expired" || reason === "cancelled") return "This Study Hall is no longer available.";
  if (reason === "overlap" || reason === "ineligible") {
    return "This Study Hall is no longer available for you.";
  }
  return "This Study Hall is no longer available.";
}

export function coverageSearchIssue({ offerCount = 0 } = {}) {
  const n = Number(offerCount) || 0;
  return {
    kind: "guide_confirm_missed",
    title: "Guide coverage unconfirmed",
    summary: "Replacement search active.",
    detail: n === 1 ? "1 eligible Guide offered" : `${n} eligible Guides offered`,
    action: "Review coverage",
    severity: "high",
  };
}

export function coverageRestoredIssue({ guideName = null } = {}) {
  return {
    kind: "guide_coverage_restored",
    title: "Coverage restored",
    summary: guideName ? `${guideName}. Confirmed.` : "Confirmed replacement coverage.",
    detail: "Automatic replacement accepted.",
    action: "View",
    severity: "resolved",
  };
}

export function mapClaimRpcReason(reason) {
  if (reason === "already_claimed" || reason === "won") return CLAIM_REASONS.won;
  if (reason === "overlap") return CLAIM_REASONS.overlap;
  if (reason === "not_eligible" || reason === "current_guide" || reason === "ineligible") {
    return CLAIM_REASONS.ineligible;
  }
  if (reason === "expired") return CLAIM_REASONS.expired;
  if (reason === "cancelled") return CLAIM_REASONS.cancelled;
  return CLAIM_REASONS.already_covered;
}

export function attendanceHistoryTitle(assignment) {
  if (!assignment) return null;
  if (assignment.source === "emergency" && assignment.status === "confirmed") {
    return "Emergency replacement accepted";
  }
  if (assignment.status === "missed") return "Confirmation missed";
  if (assignment.status === "confirmed") return "Attendance confirmed";
  if (assignment.status === "awaiting") return "Confirmation requested";
  if (assignment.status === "superseded") return "Assignment superseded";
  return assignment.status ?? null;
}

export function isEligibleEmergencyCandidate({
  candidateId,
  currentTutorId,
  approved = false,
  role = "tutor",
  timezone = "",
  available = false,
} = {}) {
  if (!candidateId) return false;
  if (candidateId === currentTutorId) return false;
  if (!approved) return false;
  if (role !== "tutor") return false;
  if (!String(timezone || "").trim()) return false;
  if (!available) return false;
  return true;
}
