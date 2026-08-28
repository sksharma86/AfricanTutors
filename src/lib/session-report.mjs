/**
 * Study Hall PR6 — post-session report constants & display labels.
 * Pure ESM (+ .d.ts) for shared Guide/parent UI and unit tests.
 *
 * Reports are short accountability summaries ("How did Study Hall go?"),
 * not academic grades or tutoring assessments.
 */

/** @typedef {'great_focus'|'good_focus'|'needed_redirection'|'difficult_session'} FocusRating */
/** @typedef {'none'|'a_little'|'several_times'} RedirectionLevel */

/** @type {readonly FocusRating[]} */
export const FOCUS_RATINGS = Object.freeze([
  "great_focus",
  "good_focus",
  "needed_redirection",
  "difficult_session",
]);

/** @type {Readonly<Record<FocusRating, string>>} */
export const FOCUS_LABELS = Object.freeze({
  great_focus: "Great focus",
  good_focus: "Good focus",
  needed_redirection: "Needed some redirection",
  difficult_session: "Difficult session",
});

/** @type {readonly RedirectionLevel[]} */
export const REDIRECTION_LEVELS = Object.freeze(["none", "a_little", "several_times"]);

/** @type {Readonly<Record<RedirectionLevel, string>>} */
export const REDIRECTION_LABELS = Object.freeze({
  none: "None",
  a_little: "A little",
  several_times: "Several times",
});

/** Parent recap uses short natural words, not the stored enum or Guide radio text. */
export const PARENT_FOCUS_LABELS = Object.freeze({
  great_focus: "Great",
  good_focus: "Good",
  needed_redirection: "Needed some redirection",
  difficult_session: "Had difficulty staying focused",
});

export const WORK_SUMMARY_MAX = 280;
export const GUIDE_NOTE_MAX = 280;
export const WORK_COMPLETED_PLACEHOLDER = "e.g. Math worksheet and 20 minutes of reading";
export const WORK_COMPLETED_HINT = "Name the work if you can — not just “homework.”";

export function parentFocusLabel(value) {
  if (value && PARENT_FOCUS_LABELS[value]) return PARENT_FOCUS_LABELS[value];
  if (value && FOCUS_LABELS[value]) return FOCUS_LABELS[value];
  return value || "";
}

/**
 * @param {string | null | undefined} value
 * @returns {value is FocusRating}
 */
export function isFocusRating(value) {
  return FOCUS_RATINGS.includes(/** @type {FocusRating} */ (value));
}

/**
 * @param {string | null | undefined} value
 * @returns {value is RedirectionLevel}
 */
export function isRedirectionLevel(value) {
  return REDIRECTION_LEVELS.includes(/** @type {RedirectionLevel} */ (value));
}
