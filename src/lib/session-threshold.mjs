/**
 * Study Hall threshold — display-only helpers for the join → in-room → exit
 * experience. authorize_session_join (server) remains the only authority for
 * entering the room; these helpers only decide what the doorway *says*.
 *
 * Pure ESM (+ sibling .d.ts) so the copy and state machine are unit-testable.
 */

/** Role → the person the participant is waiting for. */
export function counterpartLabel(role, counterpart, childNames) {
  if (role === "tutor") {
    if (Array.isArray(childNames) && childNames.length > 1) return "the children";
    return counterpart || "the child";
  }
  return counterpart ? `Guide ${counterpart}` : "your Guide";
}

/**
 * Client-side mirror of the door state using the server-issued window.
 * Used only to advance "too_early" → "open" without a page reload; the join
 * POST still re-authorizes.
 * @param {{ join_state?: string|null, join_open_at?: string|null, join_close_at?: string|null }} info
 * @param {number} nowMs
 */
export function thresholdState(info, nowMs = Date.now()) {
  const state = info?.join_state ?? "not_joinable";
  if (state !== "too_early" && state !== "open") return state;
  const open = info?.join_open_at ? Date.parse(info.join_open_at) : NaN;
  const close = info?.join_close_at ? Date.parse(info.join_close_at) : NaN;
  if (Number.isFinite(close) && nowMs > close) return "too_late";
  if (Number.isFinite(open) && nowMs < open) return "too_early";
  if (state === "too_early" && !Number.isFinite(open)) return "too_early";
  return "open";
}

/** "Opens in 12 minutes" / "Opens in under a minute" / null once open. */
export function opensInLabel(openAtISO, nowMs = Date.now()) {
  if (!openAtISO) return null;
  const ms = Date.parse(openAtISO) - nowMs;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const min = Math.ceil(ms / 60000);
  if (min <= 1) return "Opens in under a minute";
  if (min < 60) return `Opens in ${min} minutes`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `Opens in ${h} hour${h === 1 ? "" : "s"}`;
  return `Opens in ${h}h ${m}m`;
}

/**
 * Time left in the booked hour. Returns null before start.
 * @returns {{ label: string, tone: "normal"|"ending"|"over" } | null}
 */
export function timeRemaining(startISO, endISO, nowMs = Date.now()) {
  const start = startISO ? Date.parse(startISO) : NaN;
  const end = endISO ? Date.parse(endISO) : Number.isFinite(start) ? start + 60 * 60000 : NaN;
  if (!Number.isFinite(end)) return null;
  if (Number.isFinite(start) && nowMs < start) {
    const min = Math.ceil((start - nowMs) / 60000);
    return { label: min <= 1 ? "Starts in under a minute" : `Starts in ${min} min`, tone: "normal" };
  }
  const left = end - nowMs;
  if (left <= 0) return { label: "Past the scheduled end", tone: "over" };
  const min = Math.ceil(left / 60000);
  if (min <= 5) return { label: `${min} min left`, tone: "ending" };
  return { label: `${min} min left`, tone: "normal" };
}

/**
 * Presence line shown above the video once the participant is in the room.
 * `counterpartPresent` comes from Daily participants (user_id = role), so it is
 * real presence, not an assumption.
 * @returns {{ kind: "waiting"|"together", headline: string, detail: string }}
 */
export function presenceLine(role, counterpartPresent, counterpart, childNames) {
  const who = counterpartLabel(role, counterpart, childNames);
  const capitalized = who.charAt(0).toUpperCase() + who.slice(1);
  if (counterpartPresent) {
    return {
      kind: "together",
      headline: "Study Hall in progress",
      detail: role === "tutor" ? `${capitalized} ${plural(childNames) ? "are" : "is"} here.` : `${capitalized} is here.`,
    };
  }
  return {
    kind: "waiting",
    headline: `Waiting for ${who}`,
    detail:
      role === "tutor"
        ? "You're in. Stay visible on camera while you wait."
        : "You're in. Your Guide will appear here as soon as they arrive.",
  };
}

function plural(childNames) {
  return Array.isArray(childNames) && childNames.length > 1;
}

/**
 * What the doorway says before anyone has joined.
 * @param {"too_early"|"open"|"too_late"|"not_scheduled"|"not_joinable"|string} state
 * @param {"student"|"tutor"|"admin"|string|undefined} role
 * @param {{ statusLabel?: string }} [opts]
 * @returns {{ headline: string, body: string }}
 */
export function thresholdCopy(state, role, opts = {}) {
  const guide = role === "tutor";
  if (state === "too_early") {
    return {
      headline: "Study Hall opens soon",
      body: guide
        ? "The door opens 5 minutes before start. Have your camera ready."
        : "The door opens 5 minutes before start. Have homework and a charged device ready.",
    };
  }
  if (state === "open") {
    return {
      headline: guide ? "The door is open" : "Your Study Hall is ready",
      body: guide
        ? "Step in and set up the hour. Camera is required during Study Hall."
        : "Step in when you're ready. Camera is required during Study Hall.",
    };
  }
  if (state === "too_late") {
    return {
      headline: "This Study Hall has ended",
      body: guide
        ? "The room closed 15 minutes after the scheduled end. Finish the short report so the parent can see how it went."
        : "The room closed 15 minutes after the scheduled end. The Guide's report and the recording live with this Study Hall.",
    };
  }
  if (state === "not_scheduled") {
    return { headline: "No scheduled time yet", body: "Our team is still arranging this Study Hall." };
  }
  const label = (opts.statusLabel ?? "not available").toLowerCase();
  return { headline: "Study Hall not available", body: `This Study Hall is ${label}, so the room is closed.` };
}

/**
 * After leaving the room. `ended` = past scheduled end (report window).
 * @returns {{ headline: string, body: string, primary: { href: string, label: string } | null, canRejoin: boolean }}
 */
export function exitCopy(role, bookingId, { ended = false, windowOpen = false } = {}) {
  const guide = role === "tutor";
  if (guide) {
    if (ended) {
      return {
        headline: "Study Hall complete",
        body: "Tell the parent how the hour went. The report takes about a minute and unlocks your pay for this Study Hall.",
        primary: { href: `/dashboard/tutor/study-halls/${bookingId}/report`, label: "Finish report" },
        canRejoin: false,
      };
    }
    return {
      headline: "You stepped out",
      body: "The Study Hall is still running. Rejoin to stay present — the report opens once the hour ends.",
      primary: null,
      canRejoin: windowOpen,
    };
  }
  if (ended) {
    return {
      headline: "Study Hall complete",
      body: "Nice work. Your Guide writes a short report right after the hour, and the recording appears alongside it.",
      primary: { href: `/dashboard/student/study-halls/${bookingId}`, label: "See what happened" },
      canRejoin: false,
    };
  }
  return {
    headline: "You left the Study Hall",
    body: "The hour isn't over yet. You can step back in any time before it ends.",
    primary: { href: `/dashboard/student/study-halls/${bookingId}`, label: "View this Study Hall" },
    canRejoin: windowOpen,
  };
}

/**
 * Brand theme for Daily Prebuilt so the video surface reads as Study Hall, not
 * default video-call chrome. Colors only — no Daily capability changes.
 */
export const STUDY_HALL_DAILY_THEME = Object.freeze({
  colors: Object.freeze({
    accent: "#c9a227",
    accentText: "#1c1915",
    background: "#12141a",
    backgroundAccent: "#1b1f27",
    baseText: "#f3eee5",
    border: "#2a2e38",
    mainAreaBg: "#0b0d10",
    mainAreaBgAccent: "#161c18",
    mainAreaText: "#f3eee5",
    supportiveText: "#a9a39a",
  }),
});
