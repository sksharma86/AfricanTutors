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
export const CRITICAL_LEAD_MIN = 10;
export const PROTECT_LEAD_MIN = 2;
export const COMPLIMENTARY_RECOVERY_MINUTES = 60;
export const COMP_HOUR_REFERENCE_PREFIX = "comp-hour:";

export const ASSIGNMENT_STATUSES = Object.freeze([
  "awaiting",
  "confirmed",
  "missed",
  "superseded",
  "voided",
]);

export const ASSIGNMENT_SOURCES = Object.freeze(["t30", "replacement", "short_notice", "emergency"]);

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
  offerCount = 0,
} = {}) {
  if (booking?.status === "cancelled" && isCustomerProtectedAssignment(assignment)) {
    return {
      kind: "guide_customer_protected",
      title: "Customer protected",
      summary: "Study Hall cancelled before start. Booking restored. +1 complimentary hour issued.",
      detail: booking.tutor_display_name ?? null,
      action: "View",
      severity: "resolved",
    };
  }

  if (!booking || (booking.status !== "confirmed" && booking.status !== "pending")) return null;
  if (booking.status === "pending") return null;
  if (!booking.tutor_id && !booking.tutor_display_name) return null;
  if (!booking.scheduled_start) return null;

  if (hasCurrentConfirmedCoverage(booking, assignment)) return null;

  const persistBacked = Boolean(assignment);
  if (persistBacked && isAtCriticalWindow(booking.scheduled_start, nowMs)) {
    return {
      kind: "guide_confirm_critical",
      title: "Critical coverage failure",
      summary: "No confirmed Guide.",
      detail: booking.tutor_display_name ?? null,
      action: "Reassign now",
      severity: "critical",
    };
  }

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
    const notified = Number(offerCount) || 0;
    if (notified > 0) {
      return {
        kind: "guide_confirm_missed",
        title: "Guide coverage unconfirmed",
        summary: "Replacement search active.",
        detail: notified === 1 ? "1 eligible Guide notified" : `${notified} eligible Guides notified`,
        action: "Review coverage",
        severity: "high",
      };
    }
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

export function complimentaryHourReference(bookingId) {
  return `${COMP_HOUR_REFERENCE_PREFIX}${bookingId}`;
}

/** CURRENT Guide has a valid confirmation. Historical confirms do not count. */
export function hasCurrentConfirmedCoverage(booking, assignment = null) {
  if (!booking || booking.status !== "confirmed") return false;
  if (!booking.tutor_id) return false;
  return assignment?.status === "confirmed" && assignment.tutor_id === booking.tutor_id;
}

export function isCustomerProtectedAssignment(assignment) {
  return Boolean(
    assignment &&
      (assignment.resolution === "customer_protected" || assignment.customer_protected_at),
  );
}

export function criticalAtMs(scheduledStart) {
  const start = Date.parse(scheduledStart);
  return Number.isFinite(start) ? start - CRITICAL_LEAD_MIN * 60_000 : NaN;
}

export function protectAtMs(scheduledStart) {
  const start = Date.parse(scheduledStart);
  return Number.isFinite(start) ? start - PROTECT_LEAD_MIN * 60_000 : NaN;
}

export function isAtCriticalWindow(scheduledStart, nowMs = Date.now()) {
  const at = criticalAtMs(scheduledStart);
  return Number.isFinite(at) && nowMs >= at;
}

export function isAtProtectWindow(scheduledStart, nowMs = Date.now()) {
  const at = protectAtMs(scheduledStart);
  return Number.isFinite(at) && nowMs >= at;
}

/**
 * Final T-2 gate. Server must re-check CURRENT coverage immediately before cancel.
 */
export function shouldProtectCustomer({ booking, assignment = null, nowMs = Date.now() } = {}) {
  if (!booking) return { ok: false, reason: "ineligible" };
  if (booking.status === "cancelled" || booking.status === "expired") {
    return { ok: false, reason: "already_cancelled", idempotent: true };
  }
  if (booking.status !== "confirmed") return { ok: false, reason: "ineligible" };
  if (hasCurrentConfirmedCoverage(booking, assignment)) return { ok: false, reason: "covered" };
  if (!isAtProtectWindow(booking.scheduled_start, nowMs)) return { ok: false, reason: "too_early" };
  return { ok: true };
}

export function criticalNotifyKey(bookingId) {
  return `guide-critical-coverage:${bookingId}`;
}

export function protectNotifyKey(bookingId) {
  return `coverage-protect:${bookingId}`;
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

/** International E.164 — same constraint as profiles.phone_e164. */
export const E164_RE = /^\+[1-9][0-9]{7,14}$/;

export function isE164(value) {
  return typeof value === "string" && E164_RE.test(value.trim());
}

export function sessionEndMs(booking) {
  if (booking?.scheduled_end) {
    const end = Date.parse(booking.scheduled_end);
    if (Number.isFinite(end)) return end;
  }
  const start = Date.parse(booking?.scheduled_start);
  const mins = Number(booking?.duration_minutes);
  if (!Number.isFinite(start)) return NaN;
  return start + (Number.isFinite(mins) && mins > 0 ? mins : 60) * 60_000;
}

/** Exact timestamp equality. Any positive gap is a new block. */
export function isContiguous(prev, next) {
  if (!prev || !next) return false;
  const end = sessionEndMs(prev);
  const start = Date.parse(next.scheduled_start);
  return Number.isFinite(end) && Number.isFinite(start) && end === start;
}

export function sortBookingsByStart(bookings = []) {
  return [...bookings].sort((a, b) => Date.parse(a.scheduled_start) - Date.parse(b.scheduled_start));
}

export function confirmationEligibleBookings(bookings = [], tutorId = null) {
  return sortBookingsByStart(
    bookings.filter((b) => {
      if (!b?.id || !b.scheduled_start || b.status !== "confirmed") return false;
      if (tutorId && b.tutor_id && b.tutor_id !== tutorId) return false;
      return true;
    }),
  );
}

export function contiguousBlockContaining(bookings, seedId, { tutorId = null } = {}) {
  const pool = confirmationEligibleBookings(bookings, tutorId);
  const idx = pool.findIndex((b) => b.id === seedId);
  if (idx < 0) return [];
  let start = idx;
  while (start > 0 && isContiguous(pool[start - 1], pool[start])) start -= 1;
  let end = idx;
  while (end < pool.length - 1 && isContiguous(pool[end], pool[end + 1])) end += 1;
  return pool.slice(start, end + 1);
}

export function confirmationBlocks(bookings, { tutorId = null } = {}) {
  const pool = confirmationEligibleBookings(bookings, tutorId);
  const blocks = [];
  let current = [];
  for (const b of pool) {
    if (!current.length) {
      current = [b];
      continue;
    }
    if (isContiguous(current[current.length - 1], b)) current.push(b);
    else {
      blocks.push(current);
      current = [b];
    }
  }
  if (current.length) blocks.push(current);
  return blocks;
}

export function blockWindow(block) {
  if (!block?.length) return null;
  return confirmationWindow(block[0].scheduled_start);
}

/**
 * Open this booking on its own T-30 only when it is a true block leader
 * or a newly appended assignment after the previous obligation ended.
 * Already-opened followers (awaiting/missed/confirmed) are not reopened.
 */
export function shouldOpenIndependently(booking, previous, prevAssignment = null, ownAssignment = null) {
  if (ownAssignment?.status === "confirmed" || ownAssignment?.status === "awaiting" || ownAssignment?.status === "missed") {
    return false;
  }
  if (!previous || !isContiguous(previous, booking)) return true;
  if (prevAssignment?.status === "confirmed") return true;
  if (prevAssignment?.status === "missed") return true;
  if (prevAssignment?.status === "awaiting") return false;
  if (!prevAssignment) return false;
  return true;
}

function assignmentOf(booking, assignmentsByBooking = {}) {
  return assignmentsByBooking[booking?.id] ?? booking?.attendance ?? null;
}

function isConfirmedAssignment(assignment) {
  return assignment?.status === "confirmed";
}

/**
 * Split a time-contiguous chain at confirmed → unconfirmed boundaries.
 * A newly appended hall after a confirmed block is its own obligation.
 */
export function splitObligationRuns(block, assignmentsByBooking = {}) {
  const runs = [];
  let current = [];
  for (const b of block ?? []) {
    const prev = current[current.length - 1];
    if (
      prev &&
      isConfirmedAssignment(assignmentOf(prev, assignmentsByBooking)) &&
      !isConfirmedAssignment(assignmentOf(b, assignmentsByBooking))
    ) {
      runs.push(current);
      current = [b];
    } else {
      current.push(b);
    }
  }
  if (current.length) runs.push(current);
  return runs;
}

/** Confirmation obligation containing seed — not the full time-contiguous chain. */
export function obligationBlockContaining(bookings, seedId, { tutorId = null, assignmentsByBooking = {} } = {}) {
  const timeBlock = contiguousBlockContaining(bookings, seedId, { tutorId });
  const runs = splitObligationRuns(timeBlock, assignmentsByBooking);
  return runs.find((run) => run.some((b) => b.id === seedId)) ?? [];
}

/** Followers to open with a leader. Already confirmed/awaiting/missed members stay as-is. */
export function expandOpenMembers(leader, bookings, assignmentsByBooking = {}) {
  const block = contiguousBlockContaining(bookings, leader.id, { tutorId: leader.tutor_id });
  return block.filter((b) => {
    if (b.id === leader.id) return true;
    const a = assignmentsByBooking[b.id] ?? b.attendance ?? null;
    if (a?.status === "confirmed" || a?.status === "awaiting" || a?.status === "missed") return false;
    return true;
  });
}

export function attendanceNotifyKey({ tutorId, firstBookingId, source = "t30" }) {
  return `guide-attendance-block:${tutorId}:${firstBookingId}:${source}`;
}

export function missedNotifyKey({ tutorId, firstBookingId }) {
  return `guide-confirm-missed-block:${tutorId}:${firstBookingId}`;
}

export function canConfirmAttendanceInBlock({
  booking,
  actorId,
  assignment = null,
  firstScheduledStart = null,
  nowMs = Date.now(),
}) {
  const windowStart = firstScheduledStart || booking?.scheduled_start;
  return canConfirmAttendance({
    bookingStatus: booking?.status,
    assignedTutorId: booking?.tutor_id,
    actorId,
    scheduledStart: windowStart,
    assignment,
    nowMs,
  });
}

export function confirmBlockResult({ bookings, actorId, assignmentsByBooking = {}, nowMs = Date.now(), seedId = null }) {
  if (!bookings?.length) return { confirmed: [], skipped: [] };
  const obligation = seedId
    ? obligationBlockContaining(bookings, seedId, { tutorId: actorId, assignmentsByBooking })
    : bookings;
  const members = obligation.length ? obligation : bookings;
  const firstStart = members[0].scheduled_start;
  const confirmed = [];
  const skipped = [];
  for (const booking of members) {
    const assignment = assignmentsByBooking[booking.id] ?? booking.attendance ?? null;
    const eligibility = canConfirmAttendanceInBlock({
      booking,
      actorId,
      assignment,
      firstScheduledStart: firstStart,
      nowMs,
    });
    if (!eligibility.ok) skipped.push({ id: booking.id, reason: eligibility.reason });
    else confirmed.push({ id: booking.id, idempotent: Boolean(eligibility.idempotent) });
  }
  return { confirmed, skipped };
}

export function guideConfirmBlockState({ bookings, nowMs = Date.now() }) {
  if (!bookings?.length) return { kind: "none", block: [] };
  const states = bookings.map((b) =>
    guideAttendanceState({
      status: b.status,
      scheduledStart: bookings[0].scheduled_start,
      assignment: b.attendance ?? null,
      nowMs,
    }),
  );
  if (states.every((s) => s.kind === "confirmed")) return { kind: "confirmed", block: bookings };
  if (states.some((s) => s.kind === "awaiting")) return { kind: "awaiting", block: bookings };
  if (states.some((s) => s.kind === "missed")) return { kind: "missed", block: bookings };
  if (states.every((s) => s.kind === "not_yet")) return { kind: "not_yet", block: bookings };
  return { kind: states[0]?.kind ?? "none", block: bookings };
}

export function activeConfirmationBlock(bookings, { nowMs = Date.now(), tutorId = null } = {}) {
  const blocks = confirmationBlocks(bookings, { tutorId });
  for (const timeBlock of blocks) {
    for (const run of splitObligationRuns(timeBlock)) {
      const state = guideConfirmBlockState({ bookings: run, nowMs });
      if (state.kind === "awaiting" || state.kind === "missed") return { ...state, block: run };
    }
  }
  const firstUpcoming = confirmationEligibleBookings(bookings, tutorId)[0];
  if (!firstUpcoming) return { kind: "none", block: [] };
  const block = obligationBlockContaining(bookings, firstUpcoming.id, { tutorId });
  return { ...guideConfirmBlockState({ bookings: block, nowMs }), block };
}

export function groupManagementCoverageIssues(items = [], bookings = []) {
  const coverage = items.filter((i) => i.kind === "guide_confirm_missed" || i.kind === "guide_confirm_awaiting");
  const other = items.filter((i) => i.kind !== "guide_confirm_missed" && i.kind !== "guide_confirm_awaiting");
  if (coverage.length <= 1) return items;

  const byId = new Map(bookings.map((b) => [b.id, b]));
  const used = new Set();
  const grouped = [];

  const sorted = [...coverage].sort((a, b) => {
    return Date.parse(byId.get(a.bookingId)?.scheduled_start ?? 0) - Date.parse(byId.get(b.bookingId)?.scheduled_start ?? 0);
  });

  for (const item of sorted) {
    if (used.has(item.bookingId)) continue;
    const seed = byId.get(item.bookingId);
    if (!seed) {
      grouped.push(item);
      used.add(item.bookingId);
      continue;
    }
    const candidates = bookings.filter(
      (b) =>
        b.tutor_id === seed.tutor_id &&
        coverage.some((c) => c.bookingId === b.id && c.kind === item.kind),
    );
    const block = contiguousBlockContaining(candidates, seed.id, { tutorId: seed.tutor_id });
    const memberItems = block
      .map((b) => coverage.find((c) => c.bookingId === b.id && c.kind === item.kind))
      .filter(Boolean);
    for (const m of memberItems) used.add(m.bookingId);
    if (memberItems.length <= 1) {
      grouped.push(item);
      continue;
    }
    const first = block[0];
    const last = block[block.length - 1];
    const missed = item.kind === "guide_confirm_missed";
    grouped.push({
      ...item,
      id: `${item.kind}-block:${first.id}`,
      title: missed ? "Guide coverage unconfirmed" : "Replacement Guide awaiting confirmation",
      summary: missed
        ? `${memberItems.length} Study Halls affected. Confirmation deadline missed.`
        : `${memberItems.length} consecutive Study Halls awaiting confirmation.`,
      detail: [seed.tutor_display_name, `${memberItems.length} Study Halls`].filter(Boolean).join(" · "),
      action: "Review coverage",
      bookingIds: block.map((b) => b.id),
      blockStart: first.scheduled_start,
      blockEnd: last.scheduled_end ?? last.scheduled_start,
      issueCount: memberItems.length,
    });
  }

  return [...grouped, ...other];
}
