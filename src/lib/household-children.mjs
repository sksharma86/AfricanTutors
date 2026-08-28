/**
 * Household Study Hall helpers — 1–3 children, one booking.
 * Presentation and validation only. Price remains duration-based.
 */

export const MAX_CHILDREN_PER_STUDY_HALL = 3;

export function firstNameOf(fullName, fallback = "") {
  const n = String(fullName ?? "").trim();
  if (!n) return fallback;
  return n.split(/\s+/)[0];
}

/** Compact portal list: Jordan / Jordan & Maya / Jordan, Maya & Noah */
export function formatChildNames(names, fallback = "Your child") {
  const list = (names ?? []).map((n) => firstNameOf(n)).filter(Boolean);
  if (list.length === 0) return fallback;
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} & ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}`;
}

/**
 * Notification possessive: Jordan's Study Hall /
 * Jordan and Maya's Study Hall /
 * Jordan, Maya, and Noah's Study Hall
 */
export function possessiveStudyHall(names) {
  const list = (names ?? []).map((n) => firstNameOf(n)).filter(Boolean);
  if (list.length === 0) return "Study Hall";
  if (list.length === 1) return `${list[0]}'s Study Hall`;
  if (list.length === 2) return `${list[0]} and ${list[1]}'s Study Hall`;
  const last = list[list.length - 1];
  return `${list.slice(0, -1).join(", ")}, and ${last}'s Study Hall`;
}

export function childCountLabel(count) {
  const n = Math.max(0, Number(count) || 0);
  return n === 1 ? "1 child" : `${n} children`;
}

export function uniqueStudentIds(ids) {
  const out = [];
  const seen = new Set();
  for (const id of ids ?? []) {
    const s = String(id ?? "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function normalizeStudentIds(ids, max = MAX_CHILDREN_PER_STUDY_HALL) {
  return uniqueStudentIds(ids).slice(0, max);
}

export function wouldExceedChildLimit(selectedIds, nextId, max = MAX_CHILDREN_PER_STUDY_HALL) {
  const current = uniqueStudentIds(selectedIds);
  if (current.includes(String(nextId))) return false;
  return current.length >= max;
}

export function bookingChildNames(booking, fallback = "Your child") {
  if (Array.isArray(booking?.student_first_names) && booking.student_first_names.length) {
    return formatChildNames(booking.student_first_names, fallback);
  }
  // student_first_name is already the stored first name — do not re-split it.
  const stored = String(booking?.student_first_name ?? "").trim();
  if (stored) return stored;
  if (booking?.students?.full_name) return firstNameOf(booking.students.full_name, fallback);
  return fallback;
}

export function bookingChildCount(booking) {
  if (Array.isArray(booking?.student_first_names) && booking.student_first_names.length) {
    return booking.student_first_names.length;
  }
  if (Number.isFinite(booking?.child_count) && booking.child_count > 0) return booking.child_count;
  return 1;
}

/** True when the live DB has not yet received migration 0031 household columns. */
export function missingHouseholdColumns(error) {
  return /student_first_names|child_count/i.test(String(error?.message ?? ""));
}

/** True when book_session / create_booking do not yet accept p_student_ids. */
export function missingStudentIdsRpc(error) {
  return /p_student_ids|could not find the function/i.test(String(error?.message ?? ""));
}
