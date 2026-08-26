/**
 * Dashboard list split. Join-window math is delegated to customerJoinState
 * (T−5 / end+15). authorize_session_join remains the authority for actually
 * entering the room.
 */

import { customerJoinState } from "./session-window.mjs";

function confirmedStillActive(booking, nowMs) {
  const { state } = customerJoinState(
    booking.status,
    booking.scheduled_start ?? null,
    booking.scheduled_end ?? null,
    nowMs,
  );
  return state === "join" || state === "opens_at" || state === "not_scheduled";
}

function pendingUpcoming(booking, nowMs) {
  if (booking.status !== "pending") return false;
  return !booking.scheduled_start || new Date(booking.scheduled_start).getTime() >= nowMs;
}

/**
 * @param {{ scheduled_start?: string|null, scheduled_end?: string|null, status: string }[]} bookings
 * @param {number} [nowMs]
 * @returns {{ upcoming: typeof bookings, past: typeof bookings, next: (typeof bookings)[number]|null }}
 */
export function partitionBookings(bookings, nowMs = Date.now()) {
  const upcoming = bookings.filter(
    (b) => pendingUpcoming(b, nowMs) || (b.status === "confirmed" && confirmedStillActive(b, nowMs)),
  );
  const past = bookings.filter((b) => {
    if (b.status === "completed" || b.status === "cancelled" || b.status === "no_show" || b.status === "expired") {
      return true;
    }
    if (b.status === "confirmed" && !confirmedStillActive(b, nowMs)) return true;
    if (b.status === "pending" && b.scheduled_start && new Date(b.scheduled_start).getTime() < nowMs) {
      return true;
    }
    return false;
  });
  const next = upcoming.find((b) => b.scheduled_start) ?? null;
  return { upcoming, past, next };
}
