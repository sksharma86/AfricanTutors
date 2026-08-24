/**
 * Study Hall duration labels for Guide/customer UI (whole-hour blocks).
 * Pure helpers — no DB.
 */

/**
 * @param {number|null|undefined} minutes
 * @returns {string}
 */
export function formatStudyHallDuration(minutes) {
  const m = Number(minutes) || 0;
  if (m === 60) return "1 hour";
  if (m === 120) return "2 hours";
  if (m === 180) return "3 hours";
  if (m <= 0) return "—";
  // Legacy / historical rows (e.g. 30) — keep readable without offering as Study Hall.
  if (m % 60 === 0) return `${m / 60} hours`;
  return `${m} min`;
}

/**
 * Expected earning cents for a Guide at a given hourly rate and session length.
 * Mirrors record_tutor_earning: round(rate * duration / 60).
 * @param {number} rateCentsPerHour
 * @param {number} durationMinutes
 * @returns {number}
 */
export function guideEarningCents(rateCentsPerHour, durationMinutes) {
  const rate = Number(rateCentsPerHour) || 0;
  const mins = Number(durationMinutes) || 0;
  return Math.round((rate * mins) / 60);
}
