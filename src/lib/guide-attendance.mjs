/**
 * Guide pre-session attendance confirmation — pure policy.
 *
 * Confirmation belongs to a Guide ASSIGNMENT, not the abstract booking.
 * T-30 opens a 10-minute window; T-20 without confirm is a Management exception.
 * Does not cancel, refund, reassign, or change join-window timing.
 */

export const CONFIRM_OPEN_LEAD_MIN = 30;
export const CONFIRM_DEADLINE_LEAD_MIN = 20;
export const CONFIRM_WINDOW_MIN = 10;
export const REPLACEMENT_CONFIRM_MIN = 10;

export const ASSIGNMENT_STATUSES = Object.freeze([
  "awaiting",
  "confirmed",
  "missed",
  "superseded",
  "voided",
]);

export const ASSIGNMENT_SOURCES = Object.freeze(["t30", "replacement", "short_notice"]);

export const COVERAGE_CANCEL_REASON = "study_hall_guide_coverage";

export function confirmationWindow(scheduledStart) {
  const start = Date.parse(scheduledStart);
  if (!Number.isFinite(start)) return null;
  return {
    startAt: start,
    openAt: start - CONFIRM_OPEN_LEAD_MIN * 60_000,
    deadlineAt: start - CONFIRM_DEADLINE_LEAD_MIN * 60_000,
  };
}

export function t30DeadlineIso(scheduledStart) {
  const w = confirmationWindow(scheduledStart);
  return w ? new Date(w.deadlineAt).toISOString() : null;
}

export function replacementDeadlineIso(requestedAt, nowMs = Date.now()) {
  const req = requestedAt ? Date.parse(requestedAt) : nowMs;
  const base = Number.isFinite(req) ? req : nowMs;
  return new Date(base + REPLACEMENT_CONFIRM_MIN * 60_000).toISOString();
}

export function chooseOpenSource({ scheduledStart, nowMs, isReplacement = false }) {
  if (isReplacement) return "replacement";
  const w = confirmationWindow(scheduledStart);
  if (!w) return "t30";
  if (nowMs >= w.deadlineAt) return "short_notice";
  return "t30";
}

export function openDeadlineIso({ scheduledStart, source, requestedAt, nowMs = Date.now() }) {
  if (source === "t30") return t30DeadlineIso(scheduledStart);
  return replacementDeadlineIso(requestedAt ?? new Date(nowMs).toISOString(), nowMs);
}

/**
 * Guide-facing confirmation state. `assignment` is the current row for the
 * currently assigned Guide (or null when cron has not persisted yet).
 */
export function guideAttendanceState({ status, scheduledStart, assignment = null, nowMs = Date.now() }) {
  if (status !== "confirmed" || !scheduledStart) return { kind: "none" };
  const w = confirmationWindow(scheduledStart);
  if (!w) return { kind: "none" };

  if (assignment?.status === "confirmed") {
    return { kind: "confirmed", confirmedAt: assignment.confirmed_at ?? null, assignment };
  }
  if (assignment?.status === "missed") {
    return { kind: "missed", missedAt: assignment.missed_at ?? assignment.deadline_at ?? null, assignment };
  }
  if (assignment?.status === "superseded" || assignment?.status === "voided") {
    return { kind: "none", assignment };
  }

  if (assignment?.status === "awaiting") {
    const deadline = Date.parse(assignment.deadline_at);
    if (Number.isFinite(deadline) && nowMs > deadline) {
      return { kind: "missed", missedAt: assignment.deadline_at, assignment };
    }
    return { kind: "awaiting", deadlineAt: assignment.deadline_at, assignment };
  }

  if (nowMs < w.openAt) return { kind: "not_yet" };
  if (nowMs <= w.deadlineAt) {
    return { kind: "awaiting", deadlineAt: new Date(w.deadlineAt).toISOString(), assignment: null };
  }
  if (nowMs > w.deadlineAt) {
    return { kind: "missed", missedAt: new Date(w.deadlineAt).toISOString(), assignment: null };
  }
  return { kind: "none" };
}

export function guideAttendanceRowLabel(state) {
  if (!state || state.kind === "none") return null;
  if (state.kind === "not_yet") return "Not yet required";
  if (state.kind === "awaiting") return "Confirmation required";
  if (state.kind === "confirmed") return "Confirmed";
  if (state.kind === "missed") return "Confirmation missed";
  return null;
}

/**
 * Server-side confirm eligibility. Exactly at the deadline is allowed;
 * after the deadline is not. Already-confirmed is idempotent success.
 */
export function canConfirmAttendance({
  bookingStatus,
  assignedTutorId,
  actorId,
  scheduledStart,
  assignment = null,
  nowMs = Date.now(),
}) {
  if (bookingStatus === "cancelled" || bookingStatus === "expired" || bookingStatus === "completed" || bookingStatus === "no_show") {
    return { ok: false, reason: "ineligible" };
  }
  if (bookingStatus !== "confirmed") return { ok: false, reason: "ineligible" };
  if (!assignedTutorId || actorId !== assignedTutorId) return { ok: false, reason: "not_assigned" };

  if (assignment?.status === "confirmed" && assignment.tutor_id === actorId) {
    return { ok: true, idempotent: true };
  }
  if (assignment?.status === "missed") return { ok: false, reason: "deadline" };
  if (assignment?.status === "superseded" || assignment?.status === "voided") {
    return { ok: false, reason: "stale" };
  }
  if (assignment?.status === "awaiting") {
    if (assignment.tutor_id && assignment.tutor_id !== actorId) return { ok: false, reason: "stale" };
    const deadline = Date.parse(assignment.deadline_at);
    if (Number.isFinite(deadline) && nowMs > deadline) return { ok: false, reason: "deadline" };
    return { ok: true, idempotent: false };
  }

  const w = confirmationWindow(scheduledStart);
  if (!w) return { ok: false, reason: "ineligible" };
  if (nowMs < w.openAt) return { ok: false, reason: "too_early" };
  if (nowMs > w.deadlineAt) return { ok: false, reason: "deadline" };
  return { ok: true, idempotent: false };
}

/**
 * Management exception for a booking. Normal T-30 awaiting is NOT an exception.
 * Missed (persisted or derived) and replacement/short-notice awaiting are.
 */
export function managementAttendanceIssue({
  booking,
  assignment = null,
  nowMs = Date.now(),
  assignmentsLoaded = true,
} = {}) {
  if (!booking || (booking.status !== "confirmed" && booking.status !== "pending")) return null;
  if (booking.status === "pending") return null;
  if (!booking.tutor_id && !booking.tutor_display_name) return null;
  if (!booking.scheduled_start) return null;

  const state = guideAttendanceState({
    status: booking.status,
    scheduledStart: booking.scheduled_start,
    assignment,
    nowMs,
  });

  if (state.kind === "awaiting" && (assignment?.source === "replacement" || assignment?.source === "short_notice")) {
    return {
      kind: "guide_confirm_awaiting",
      title: "Replacement Guide awaiting confirmation",
      summary: "A replacement Guide has been assigned and has not confirmed attendance yet.",
      detail: booking.tutor_display_name ?? null,
      action: "View",
      severity: "high",
    };
  }

  if (state.kind === "missed") {
    // Only persist-backed misses become Management exceptions. Clock-only
    // derivation would false-flag every live/historical confirmed session
    // that never had a confirmation row (including the day this ships).
    if (!assignment) return null;
    return {
      kind: "guide_confirm_missed",
      title: "Guide confirmation missed",
      summary: "Confirmation deadline missed.",
      detail: booking.tutor_display_name ?? null,
      action: "Reassign",
      severity: "high",
    };
  }

  return null;
}

export function currentAssignmentForBooking(assignments, booking) {
  const rows = (assignments ?? []).filter((a) => a && a.booking_id === booking?.id);
  if (!rows.length) return null;
  const currentTutor = booking?.tutor_id;
  const forTutor = currentTutor ? rows.filter((a) => a.tutor_id === currentTutor) : rows;
  const pool = forTutor.length ? forTutor : rows;
  const rank = { awaiting: 3, missed: 2, confirmed: 1, superseded: 0, voided: 0 };
  return [...pool].sort((a, b) => {
    const rd = (rank[b.status] ?? 0) - (rank[a.status] ?? 0);
    if (rd !== 0) return rd;
    return Date.parse(b.created_at ?? 0) - Date.parse(a.created_at ?? 0);
  })[0] ?? null;
}

export function isCoverageCancellationReason(reason) {
  return String(reason ?? "").includes(COVERAGE_CANCEL_REASON);
}

export function coverageRestorationLine({ isFreeTrial, restoredMinutes, restoredCreditCents }) {
  if (isFreeTrial) return "Your free Study Hall has been restored automatically.";
  if (Number(restoredMinutes) > 0) {
    const hours = Number(restoredMinutes) / 60;
    const label = hours === 1 ? "hour" : "hours";
    return `Your ${hours} prepaid ${label} ${hours === 1 ? "has" : "have"} been restored automatically.`;
  }
  if (Number(restoredCreditCents) > 0) {
    return "Your payment has been restored to your account automatically.";
  }
  return "Your session value has been restored automatically.";
}
