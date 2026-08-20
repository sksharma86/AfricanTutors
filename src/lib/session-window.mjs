/**
 * Display-only customer join state for the dashboard/session-card. This mirrors
 * the Phase 5 access window (open 10 min before start, close 15 min after end)
 * purely for UI hints. The server (authorize_session_join) remains the sole
 * authority for actually joining — a pending/unpaid booking never offers Join.
 */

export const JOIN_OPEN_LEAD_MIN = 10;
export const JOIN_CLOSE_GRACE_MIN = 15;

/**
 * @param {string} status booking status
 * @param {string|null} startISO scheduled_start
 * @param {string|null} endISO scheduled_end
 * @param {number} nowMs current time (ms)
 * @returns {{ state: "join"|"opens_at"|"ended"|"not_scheduled"|"not_joinable", openAtISO: string|null }}
 */
export function customerJoinState(status, startISO, endISO, nowMs) {
  if (status !== "confirmed") return { state: "not_joinable", openAtISO: null };
  if (!startISO) return { state: "not_scheduled", openAtISO: null };
  const start = new Date(startISO).getTime();
  const end = endISO ? new Date(endISO).getTime() : start + 60 * 60000;
  const openAt = start - JOIN_OPEN_LEAD_MIN * 60000;
  const closeAt = end + JOIN_CLOSE_GRACE_MIN * 60000;
  const openAtISO = new Date(openAt).toISOString();
  if (nowMs < openAt) return { state: "opens_at", openAtISO };
  if (nowMs > closeAt) return { state: "ended", openAtISO };
  return { state: "join", openAtISO };
}
