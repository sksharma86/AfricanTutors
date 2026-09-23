/**
 * Isolated Study Hall room fixtures. Never imported by the live session page.
 * Used only when SESSION_VISUAL_REVIEW=1. Does not join Daily or write data.
 */

export const SESSION_ROOM_SCENES = Object.freeze([
  "door-early",
  "door-open",
  "door-open-guide",
  "room-waiting",
  "room-waiting-guide",
  "room-live",
  "room-live-guide",
  "left-early",
  "left-early-guide",
  "ended",
  "ended-guide",
]);

/**
 * @param {string} scene
 * @param {number} nowMs
 * @returns {{ info: object, preview: "waiting"|"live"|"left"|"left-early"|null, nowMs: number } | null}
 */
export function sessionRoomFixture(scene, nowMs = Date.now()) {
  if (!SESSION_ROOM_SCENES.includes(scene)) return null;
  const guide = scene.endsWith("-guide");
  const role = guide ? "tutor" : "student";

  // Minutes from "now" to scheduled_start for each doorway moment.
  const offset = scene.startsWith("door-early")
    ? 22
    : scene.startsWith("door-open")
      ? 3
      : scene.startsWith("room-")
        ? -18
        : scene.startsWith("left-early")
          ? -25
          : -90;
  const start = nowMs + offset * 60000;
  const end = start + 60 * 60000;
  const joinState = scene.startsWith("door-early") ? "too_early" : scene.startsWith("ended") ? "too_late" : "open";
  const preview = scene.startsWith("room-waiting")
    ? "waiting"
    : scene.startsWith("room-live")
      ? "live"
      : scene.startsWith("left-early")
        ? "left-early"
        : null;

  return {
    nowMs,
    preview,
    info: {
      authorized: true,
      role,
      status: "confirmed",
      subject: null,
      scheduled_start: new Date(start).toISOString(),
      scheduled_end: new Date(end).toISOString(),
      duration_minutes: 60,
      join_open_at: new Date(start - 5 * 60000).toISOString(),
      join_close_at: new Date(end + 15 * 60000).toISOString(),
      server_now: new Date(nowMs).toISOString(),
      join_state: joinState,
      room_name: "fixture-room",
      is_owner: false,
      safe_name: guide ? "Sarah" : "Jordan",
      counterpart: guide ? "Jordan" : "Sarah",
      child_names: ["Jordan"],
      videoConfigured: true,
    },
  };
}
