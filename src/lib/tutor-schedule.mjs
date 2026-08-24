/**
 * Pure helpers for the Guide schedule UI (unit-testable; no DB/secrets).
 *
 * The Guide dashboard must only offer a Join action for bookings the Phase 5
 * server will actually authorize. A paid booking that is still `pending`
 * (payment_status = awaiting_payment) is NOT financially confirmed, so we show a
 * neutral "awaiting confirmation" state instead of a misleading Join control.
 * Server-side authorization (authorize_session_join) remains authoritative —
 * including the Study Hall T−5 join window (JOIN_OPEN_LEAD_MIN).
 */

import { JOIN_CLOSE_GRACE_MIN, JOIN_OPEN_LEAD_MIN } from "./session-window.mjs";

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
 * Guide-facing join control state. Mirrors the server window for UI only.
 *
 * @param {string} status
 * @param {string|null|undefined} startISO
 * @param {string|null|undefined} endISO
 * @param {number} [nowMs]
 * @returns {{ kind: "join"|"opens_at"|"ended"|"awaiting"|"closed"|"none", openAtISO?: string|null }}
 */
export function guideJoinUiState(status, startISO, endISO, nowMs = Date.now()) {
  const base = tutorSessionAction(status, Boolean(startISO));
  if (base !== "join") return { kind: base };
  const start = new Date(/** @type {string} */ (startISO)).getTime();
  const end = endISO ? new Date(endISO).getTime() : start + 60 * 60000;
  const openAt = start - JOIN_OPEN_LEAD_MIN * 60000;
  const closeAt = end + JOIN_CLOSE_GRACE_MIN * 60000;
  const openAtISO = new Date(openAt).toISOString();
  if (nowMs < openAt) return { kind: "opens_at", openAtISO };
  if (nowMs > closeAt) return { kind: "ended" };
  return { kind: "join", openAtISO };
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
