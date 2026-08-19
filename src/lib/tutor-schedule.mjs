/**
 * Pure helpers for the tutor schedule UI (unit-testable; no DB/secrets).
 *
 * The tutor dashboard must only offer a Join action for bookings the Phase 5
 * server will actually authorize. A paid booking that is still `pending`
 * (payment_status = awaiting_payment) is NOT financially confirmed, so we show a
 * neutral "awaiting confirmation" state instead of a misleading Join control.
 * Server-side authorization (authorize_session_join) remains authoritative.
 */

/**
 * @param {string} status  booking status
 * @param {boolean} hasSchedule  whether scheduled_start is set
 * @returns {"join"|"awaiting"|"closed"|"none"}
 */
export function tutorSessionAction(status, hasSchedule) {
  if (!hasSchedule) return "none";
  if (status === "confirmed") return "join"; // Phase 5 then enforces the join window
  if (status === "pending") return "awaiting"; // not financially confirmed → no join control
  return "closed"; // cancelled / expired / completed / no_show
}

/**
 * Neutral timezone fallback (no geolocation, no business-model inference):
 * a missing/blank timezone renders in UTC. Never mutates stored data.
 * @param {string|null|undefined} stored
 * @returns {string}
 */
export function tutorTimezone(stored) {
  return stored && String(stored).trim() ? stored : "UTC";
}
