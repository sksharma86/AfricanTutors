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
