/**
 * Study Hall PR7 — Call Parent reason constants & display labels.
 * Pure ESM for Guide UI + tests. Never includes phone numbers.
 */

/** @typedef {'child_unwell'|'refusing_to_work'|'needs_parent_assistance'|'behavior_issue'|'other'} EscalationReason */

/** @type {readonly EscalationReason[]} */
export const ESCALATION_REASONS = Object.freeze([
  "child_unwell",
  "refusing_to_work",
  "needs_parent_assistance",
  "behavior_issue",
  "other",
]);

/** @type {Readonly<Record<EscalationReason, string>>} */
export const ESCALATION_REASON_LABELS = Object.freeze({
  child_unwell: "Child feels unwell",
  refusing_to_work: "Repeatedly refusing to work",
  needs_parent_assistance: "Needs parent assistance",
  behavior_issue: "Behavior issue",
  other: "Other parent attention needed",
});

export const ESCALATION_NOTE_MAX = 200;
export const ESCALATION_COOLDOWN_MS = 5 * 60 * 1000;

/** Automated voice / SMS copy — no child or session details. */
export const CALL_PARENT_VOICE_MESSAGE =
  "Study Hall (at home) needs your attention. Please check on your child now.";

export const CALL_PARENT_SMS_MESSAGE =
  "Study Hall (at home) needs your attention. Please check on your child.";

/**
 * @param {string | null | undefined} value
 * @returns {value is EscalationReason}
 */
export function isEscalationReason(value) {
  return ESCALATION_REASONS.includes(/** @type {EscalationReason} */ (value));
}
