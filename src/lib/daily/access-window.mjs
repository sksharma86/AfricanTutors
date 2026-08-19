/**
 * Compute the Daily room `nbf`/`exp` and meeting-token `exp` for a participant.
 *
 * Normal students/tutors: bounded to the African Tutors join window — room opens
 * 10 min before start (nbf = join_open - 60s buffer) and the token expires at the
 * session close (join_close = scheduled_end + 15 min). Unchanged.
 *
 * Admin support: mirrors the African Tutors admin outside-window override. Access
 * begins immediately (server current time) and the token is short-lived
 * (ADMIN_SUPPORT_SECONDS ≈ 45 min). The room's nbf/exp are widened as needed so a
 * reused room created for the normal window cannot lock an admin out before it
 * opens or after it expires. (Student/tutor tokens still expire at the normal
 * close, so a widened room never extends their access.)
 *
 * Plain ESM (+ sibling .d.ts) so the exact values sent to Daily are unit-testable
 * without Daily credentials.
 */

export const ADMIN_SUPPORT_SECONDS = 45 * 60;

/**
 * @param {{ role?: string, joinOpenAt?: string|null, joinCloseAt?: string|null }} info
 * @param {number} [nowMs]
 * @returns {{ roomNbf: number, roomExp: number, tokenExp: number }}
 */
export function computeSessionAccessWindow(info, nowMs = Date.now()) {
  const now = Math.floor(nowMs / 1000);
  const open = info.joinOpenAt ? Math.floor(new Date(info.joinOpenAt).getTime() / 1000) : now - 60;
  const close = info.joinCloseAt ? Math.floor(new Date(info.joinCloseAt).getTime() / 1000) : now + 2 * 3600;

  if (info.role === "admin") {
    const tokenExp = now + ADMIN_SUPPORT_SECONDS;
    return { roomNbf: now - 60, roomExp: Math.max(close, tokenExp), tokenExp };
  }
  return { roomNbf: open - 60, roomExp: close, tokenExp: close };
}
