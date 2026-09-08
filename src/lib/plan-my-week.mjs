/**
 * Plan My Week — week math, slot filtering, and submit normalization.
 *
 * This is an orchestration helper, not a booking engine. Availability, funding,
 * 365 coverage, Guide assignment, and booking rows stay in the existing RPCs.
 */

import { isHalfHourInstant } from "./half-hour-grid.mjs";
import {
  DEFAULT_ACCOUNT_TIMEZONE,
  localDateForInstant,
  parseLocalDate,
  safeTimeZone,
  utcInstantForLocalParts,
} from "./study-hall-365/calendar.mjs";

export const PLAN_WEEK_DURATION_MINUTES = 60;
export const PLAN_WEEK_MAX_OFFSET = 1;
export const PLAN_WEEK_MAX_SESSIONS = 14;
export const PLAN_MY_WEEK_HREF = "/dashboard/student/plan-week";
/** Keep in sync with MIN_BOOKING_NOTICE_MINUTES in booking-config.ts */
export const PLAN_WEEK_NOTICE_MINUTES = 120;

const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_INDEX = { Sun: 6, Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5 };

const ACTIVE_STATUSES = new Set(["pending", "confirmed"]);

export function addLocalDays(localDate, days, timeZone = DEFAULT_ACCOUNT_TIMEZONE) {
  const parts = parseLocalDate(localDate);
  if (!parts) return null;
  const tz = safeTimeZone(timeZone);
  const noon = utcInstantForLocalParts(parts.year, parts.month, parts.day, 12, 0, 0, tz);
  return localDateForInstant(new Date(noon.getTime() + Number(days) * 24 * 3600 * 1000), tz);
}

export function mondayOfLocalDate(localDate, timeZone = DEFAULT_ACCOUNT_TIMEZONE) {
  const parts = parseLocalDate(localDate);
  if (!parts) return null;
  const tz = safeTimeZone(timeZone);
  const noon = utcInstantForLocalParts(parts.year, parts.month, parts.day, 12, 0, 0, tz);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(noon);
  const offset = WEEKDAY_INDEX[weekday] ?? 0;
  return addLocalDays(localDate, -offset, tz);
}

function formatMonthDay(localDate, timeZone) {
  const parts = parseLocalDate(localDate);
  if (!parts) return "";
  const tz = safeTimeZone(timeZone);
  const noon = utcInstantForLocalParts(parts.year, parts.month, parts.day, 12, 0, 0, tz);
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" }).format(noon);
}

/**
 * Monday–Sunday planning week in the household timezone.
 * weekOffset 0 = week containing `now`; 1 = the following week. No further weeks.
 */
export function planningWeek(timeZone, now = new Date(), weekOffset = 0) {
  const tz = safeTimeZone(timeZone);
  const offset = Math.max(0, Math.min(PLAN_WEEK_MAX_OFFSET, Number(weekOffset) || 0));
  const instant = now instanceof Date ? now : new Date(now);
  const today = localDateForInstant(instant, tz);
  const thisMonday = mondayOfLocalDate(today, tz) ?? today;
  const monday = addLocalDays(thisMonday, offset * 7, tz) ?? thisMonday;
  const sunday = addLocalDays(monday, 6, tz) ?? monday;
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const localDate = addLocalDays(monday, i, tz);
    if (!localDate) continue;
    days.push({
      localDate,
      weekdayLong: WEEKDAY_LONG[i],
      weekdayShort: WEEKDAY_SHORT[i],
      monthDay: formatMonthDay(localDate, tz),
      isPast: localDate < today,
      isToday: localDate === today,
    });
  }
  return {
    timeZone: tz,
    weekOffset: offset,
    monday,
    sunday,
    today,
    days,
    canGoBack: offset > 0,
    canGoForward: offset < PLAN_WEEK_MAX_OFFSET,
    label: `Monday ${formatMonthDay(monday, tz)} – Sunday ${formatMonthDay(sunday, tz)}`,
  };
}

export function planningHorizon(timeZone, now = new Date()) {
  const current = planningWeek(timeZone, now, 0);
  const next = planningWeek(timeZone, now, 1);
  return { from: current.today, to: next.sunday, monday: current.monday };
}

export function isWithinPlanningHorizon(iso, timeZone, now = new Date()) {
  if (!iso) return false;
  const tz = safeTimeZone(timeZone);
  const horizon = planningHorizon(tz, now);
  const date = localDateForInstant(iso, tz);
  return date >= horizon.from && date <= horizon.to;
}

export function canScheduleStart(iso, timeZone, nowMs = Date.now(), noticeMinutes = PLAN_WEEK_NOTICE_MINUTES) {
  if (!iso) return false;
  const tz = safeTimeZone(timeZone);
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  if (t < Number(nowMs) + Number(noticeMinutes) * 60_000) return false;
  if (!isHalfHourInstant(iso, tz)) return false;
  return isWithinPlanningHorizon(iso, tz, new Date(nowMs));
}

/**
 * Filter authoritative slot instants down to one local civil date.
 * Does not compute Guide availability — callers must pass get_available_slots results.
 */
export function slotsForLocalDate(
  slotStarts,
  localDate,
  timeZone,
  nowMs = Date.now(),
  noticeMinutes = PLAN_WEEK_NOTICE_MINUTES,
) {
  const tz = safeTimeZone(timeZone);
  return (slotStarts ?? []).filter((iso) => {
    if (typeof iso !== "string") return false;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return false;
    if (localDateForInstant(iso, tz) !== localDate) return false;
    return canScheduleStart(iso, tz, nowMs, noticeMinutes);
  });
}

export function isActiveWeekBooking(booking) {
  if (!booking || !ACTIVE_STATUSES.has(booking.status)) return false;
  return Boolean(booking.scheduled_start);
}

export function bookingsInLocalRange(bookings, fromDate, toDate, timeZone) {
  const tz = safeTimeZone(timeZone);
  return (bookings ?? []).filter((booking) => {
    if (!isActiveWeekBooking(booking)) return false;
    const date = localDateForInstant(booking.scheduled_start, tz);
    return date >= fromDate && date <= toDate;
  });
}

export function bookingsByLocalDate(bookings, timeZone) {
  const tz = safeTimeZone(timeZone);
  const map = new Map();
  for (const booking of bookings ?? []) {
    if (!isActiveWeekBooking(booking)) continue;
    const date = localDateForInstant(booking.scheduled_start, tz);
    const list = map.get(date) ?? [];
    list.push(booking);
    map.set(date, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => String(a.scheduled_start).localeCompare(String(b.scheduled_start)));
  }
  return map;
}

export function startAlreadyBooked(existing, startISO) {
  const target = new Date(startISO).getTime();
  if (!Number.isFinite(target)) return null;
  return (
    (existing ?? []).find((booking) => {
      if (!isActiveWeekBooking(booking)) return false;
      return new Date(booking.scheduled_start).getTime() === target;
    }) ?? null
  );
}

/**
 * Normalize a Plan My Week submit. Duration is always 60. Past times, duplicates,
 * and out-of-horizon starts are rejected per session rather than failing the week.
 */
export function normalizePlanWeekRequest(input, options = {}) {
  const timeZone = safeTimeZone(options.timeZone);
  const nowMs = options.nowMs ?? Date.now();
  const noticeMinutes = options.noticeMinutes ?? PLAN_WEEK_NOTICE_MINUTES;
  const existing = options.existingBookings ?? [];
  const duration = Number(input?.duration ?? PLAN_WEEK_DURATION_MINUTES);
  const sessions = Array.isArray(input?.sessions) ? input.sessions : [];

  if (duration !== PLAN_WEEK_DURATION_MINUTES) {
    return {
      ok: false,
      error: "Study Hall sessions are 60 minutes.",
      sessions: [],
    };
  }
  if (sessions.length > PLAN_WEEK_MAX_SESSIONS) {
    return {
      ok: false,
      error: "Please plan one week at a time.",
      sessions: [],
    };
  }

  const seen = new Set();
  const accepted = [];
  const skipped = [];

  for (const raw of sessions) {
    const startISO = typeof raw?.startISO === "string" ? raw.startISO : "";
    const localDate = startISO ? localDateForInstant(startISO, timeZone) : null;
    const replaceBookingId = typeof raw?.replaceBookingId === "string" ? raw.replaceBookingId : null;
    const base = { startISO, localDate, replaceBookingId };

    if (!startISO || !localDate) {
      skipped.push({ ...base, status: "error", message: "Choose a time for each day." });
      continue;
    }
    if (seen.has(startISO)) {
      skipped.push({ ...base, status: "already_scheduled", message: "That time was already included." });
      continue;
    }
    seen.add(startISO);

    if (!canScheduleStart(startISO, timeZone, nowMs, noticeMinutes)) {
      skipped.push({
        ...base,
        status: "unavailable",
        message: localDate < localDateForInstant(new Date(nowMs), timeZone)
          ? "That day has already passed."
          : "That time is no longer available.",
      });
      continue;
    }

    const match = startAlreadyBooked(existing, startISO);
    if (match && match.id !== replaceBookingId) {
      skipped.push({
        ...base,
        status: "already_scheduled",
        bookingId: match.id,
        message: "Already on your schedule.",
      });
      continue;
    }

    accepted.push(base);
  }

  return { ok: true, error: null, sessions: accepted, skipped };
}

export function planWeekResultMessage(errorMessage) {
  const m = String(errorMessage ?? "");
  if (!m) return "Something went wrong. Please try again.";
  if (/no longer available|No Guide is available|choose another slot/i.test(m)) {
    return "Time no longer available";
  }
  if (/Cannot book a time in the past|already passed/i.test(m)) {
    return "That time has already passed";
  }
  if (/already has a Study Hall/i.test(m)) {
    return "A Study Hall is already scheduled at that time";
  }
  if (/Study Hall sessions are 60 minutes|Invalid duration/i.test(m)) {
    return "Study Hall sessions are 60 minutes";
  }
  if (/Not authorized/i.test(m)) {
    return "You can only plan Study Halls for your household.";
  }
  if (/permission denied|violates|constraint|supabase|sql|rls/i.test(m)) {
    return "Something went wrong. Please try again.";
  }
  if (m.length < 160) return m;
  return "Something went wrong. Please try again.";
}

function clockAndPeriod(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
  return { clock: `${hour}:${minute}`, dayPeriod };
}

export function formatPlanSessionLine(iso, timeZone) {
  const tz = safeTimeZone(timeZone);
  const start = new Date(iso);
  const end = new Date(start.getTime() + PLAN_WEEK_DURATION_MINUTES * 60_000);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(start);
  const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" }).format(start);
  const from = clockAndPeriod(start, tz);
  const to = clockAndPeriod(end, tz);
  const range =
    from.dayPeriod && from.dayPeriod === to.dayPeriod
      ? `${from.clock}–${to.clock} ${to.dayPeriod}`
      : `${from.clock} ${from.dayPeriod}–${to.clock} ${to.dayPeriod}`.replace(/\s+/g, " ").trim();
  return `${weekday} ${monthDay} — ${range}`;
}

/** Local weekdays, not UTC +168h. */
export const COPY_NEXT_WEEK_LOCAL_DAYS = 7;

function localClockParts(iso, timeZone) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0;
  return { hour, minute: get("minute"), second: get("second") };
}

function sameInstant(a, b) {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return Number.isFinite(ta) && ta === tb;
}

/**
 * Move an instant by whole local calendar days in `timeZone`.
 * Keeps the civil clock (e.g. 6:00 PM → 6:00 PM) across DST.
 */
export function shiftLocalInstantByDays(iso, days, timeZone) {
  if (!iso) return null;
  const tz = safeTimeZone(timeZone);
  const sourceDate = localDateForInstant(iso, tz);
  const destDate = addLocalDays(sourceDate, Number(days) || 0, tz);
  const destParts = parseLocalDate(destDate);
  const clock = localClockParts(iso, tz);
  if (!destParts || !clock) return null;
  return utcInstantForLocalParts(
    destParts.year,
    destParts.month,
    destParts.day,
    clock.hour,
    clock.minute,
    clock.second,
    tz,
  ).toISOString();
}

/**
 * Source times for Copy to next week, matching what the parent currently sees.
 *
 * Per this-week local date:
 * 1. Active bookings (pending/confirmed) win. A pending Change uses the
 *    replacement time, not the original.
 * 2. Else an unsaved new-session draft for that date.
 * Cancelled, expired, and completed rows are ignored.
 *
 * @param {{
 *   bookings?: object[],
 *   drafts?: Record<string, string>,
 *   replacements?: Record<string, string>,
 *   thisWeekDays?: Array<{ localDate?: string }>,
 *   timeZone?: string,
 * }} [input]
 */
export function collectCopySourceSessions(input = {}) {
  const bookings = input.bookings ?? [];
  const drafts = input.drafts ?? {};
  const replacements = input.replacements ?? {};
  const thisWeekDays = input.thisWeekDays ?? [];
  const tz = safeTimeZone(input.timeZone);
  const byDate = bookingsByLocalDate(bookings, tz);
  const sources = [];
  const seen = new Set();

  for (const day of thisWeekDays) {
    const localDate = day?.localDate;
    if (!localDate) continue;
    const existing = byDate.get(localDate) ?? [];
    if (existing.length > 0) {
      for (const booking of existing) {
        const replacement = replacements?.[booking.id];
        const startISO =
          typeof replacement === "string" && replacement ? replacement : booking.scheduled_start;
        if (!startISO || seen.has(startISO)) continue;
        seen.add(startISO);
        sources.push({
          sourceLocalDate: localDate,
          startISO,
          kind: replacement ? "replacement" : "booking",
          bookingId: booking.id,
        });
      }
      continue;
    }
    const draft = drafts?.[localDate];
    if (typeof draft === "string" && draft && !seen.has(draft)) {
      seen.add(draft);
      sources.push({ sourceLocalDate: localDate, startISO: draft, kind: "draft" });
    }
  }
  return sources;
}

function skipRow(source, destISO, destLocalDate, status, message) {
  return {
    sourceLocalDate: source.sourceLocalDate,
    startISO: destISO ?? "",
    localDate: destLocalDate,
    status,
    message,
  };
}

export function formatCopyToNextWeekMessage(copiedCount, skipped = []) {
  const copied = Number(copiedCount) || 0;
  const unavailable = skipped.filter((row) => row.status === "unavailable").length;
  const kept = skipped.filter((row) => row.status === "already_scheduled" || row.status === "draft_exists").length;

  if (copied < 1 && skipped.length < 1) {
    return "Nothing to copy. Add Study Halls this week first.";
  }

  const parts = [];
  if (copied > 0) {
    parts.push(`${copied} Study Hall${copied === 1 ? "" : "s"} copied to next week.`);
    parts.push("Review to schedule them.");
  } else {
    parts.push("No Study Halls were copied.");
  }
  if (unavailable > 0) {
    parts.push(`${unavailable} time${unavailable === 1 ? " was" : "s were"} unavailable.`);
  }
  if (kept > 0) {
    parts.push(
      kept === 1
        ? "1 day already had a next-week time, so it was left as-is."
        : `${kept} days already had a next-week time, so they were left as-is.`,
    );
  }
  return parts.join(" ");
}

/**
 * Build next-week DRAFTS from this week's visible routine. Does not book.
 *
 * Destination merge (never overwrite):
 * - next-week local date already has an active booking → skip
 * - next-week draft already exists for that date → skip
 * - destination instant missing from get_available_slots (filtered by
 *   slotsForLocalDate / canScheduleStart) → skip unavailable
 * Multiple sources mapping to the same next-week date: first eligible wins.
 *
 * @param {{
 *   weekOffset?: number,
 *   bookings?: object[],
 *   drafts?: Record<string, string>,
 *   replacements?: Record<string, string>,
 *   slotStarts?: string[],
 *   timeZone?: string,
 *   nowMs?: number,
 *   noticeMinutes?: number,
 * }} [input]
 */
export function planCopyToNextWeek(input = {}) {
  const weekOffset = input.weekOffset ?? 0;
  const bookings = input.bookings ?? [];
  const drafts = input.drafts ?? {};
  const replacements = input.replacements ?? {};
  const slotStarts = input.slotStarts ?? [];
  const nowMs = input.nowMs ?? Date.now();
  const noticeMinutes = input.noticeMinutes ?? PLAN_WEEK_NOTICE_MINUTES;
  const tz = safeTimeZone(input.timeZone);
  const now = new Date(nowMs);
  if (Number(weekOffset) !== 0) {
    return {
      ok: false,
      inapplicable: true,
      drafts: {},
      copied: [],
      skipped: [],
      message: "Copy to next week is only available while viewing this week.",
    };
  }

  const thisWeek = planningWeek(tz, now, 0);
  const nextWeek = planningWeek(tz, now, 1);
  const sources = collectCopySourceSessions({
    bookings,
    drafts,
    replacements,
    thisWeekDays: thisWeek.days,
    timeZone: tz,
  });

  if (sources.length === 0) {
    return {
      ok: true,
      inapplicable: false,
      drafts: {},
      copied: [],
      skipped: [],
      message: formatCopyToNextWeekMessage(0, []),
    };
  }

  const destByDate = bookingsByLocalDate(bookings, tz);
  const copied = [];
  const skipped = [];
  const newDrafts = {};

  for (const source of sources) {
    const destISO = shiftLocalInstantByDays(source.startISO, COPY_NEXT_WEEK_LOCAL_DAYS, tz);
    const destLocalDate = destISO ? localDateForInstant(destISO, tz) : null;
    if (
      !destISO ||
      !destLocalDate ||
      destLocalDate < nextWeek.monday ||
      destLocalDate > nextWeek.sunday
    ) {
      skipped.push(skipRow(source, destISO, destLocalDate, "unavailable", "That time could not be copied because it is unavailable."));
      continue;
    }
    if (drafts[destLocalDate] || newDrafts[destLocalDate]) {
      skipped.push(skipRow(source, destISO, destLocalDate, "draft_exists", "Next week already has a time for that day."));
      continue;
    }
    const destExisting = destByDate.get(destLocalDate) ?? [];
    if (destExisting.length > 0 || startAlreadyBooked(bookings, destISO)) {
      skipped.push(skipRow(source, destISO, destLocalDate, "already_scheduled", "Already on your schedule."));
      continue;
    }
    const daySlots = slotsForLocalDate(slotStarts, destLocalDate, tz, nowMs, noticeMinutes);
    const inSlots = daySlots.some((slot) => sameInstant(slot, destISO));
    if (!inSlots || !canScheduleStart(destISO, tz, nowMs, noticeMinutes)) {
      skipped.push(skipRow(source, destISO, destLocalDate, "unavailable", "That time could not be copied because it is unavailable."));
      continue;
    }
    newDrafts[destLocalDate] = destISO;
    copied.push({ localDate: destLocalDate, startISO: destISO, sourceLocalDate: source.sourceLocalDate });
  }

  return {
    ok: true,
    inapplicable: false,
    drafts: newDrafts,
    copied,
    skipped,
    message: formatCopyToNextWeekMessage(copied.length, skipped),
  };
}
