/**
 * Guide workstation presentation helpers.
 * Does not change booking, Daily, matching, compensation, or Call Parent.
 */

import { bookingChildCount, bookingChildNames, childCountLabel } from "./household-children.mjs";
import { partitionBookings } from "./bookings.mjs";
import { guideJoinUiState } from "./tutor-schedule.mjs";

export const GUIDE_PORTAL_NAV = [
  { label: "Home", href: "/dashboard/tutor" },
  { label: "Study Halls", href: "/dashboard/tutor/study-halls" },
  { label: "Availability", href: "/dashboard/tutor/availability" },
  { label: "Earnings", href: "/dashboard/tutor/earnings" },
];

export function guideChildName(booking, fallback = "Child") {
  return bookingChildNames(booking, fallback);
}

export function guideChildrenCaption(booking) {
  const n = bookingChildCount(booking);
  if (n <= 1) return null;
  return childCountLabel(n);
}

function calendarDayKey(ms, tz) {
  if (!tz) return new Date(ms).toDateString();
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toDateString();
  }
}

export function guideStudyHallLists(bookings, nowMs = Date.now(), tz) {
  const { upcoming, past, next } = partitionBookings(bookings, nowMs);
  const todayKey = calendarDayKey(nowMs, tz);
  const today = upcoming.filter(
    (b) => b.scheduled_start && calendarDayKey(Date.parse(b.scheduled_start), tz) === todayKey,
  );
  const later = upcoming.filter((b) => !today.includes(b));
  const completed = past.filter((b) => b.status !== "cancelled" && b.status !== "expired");
  const cancelled = past.filter((b) => b.status === "cancelled" || b.status === "expired");
  return { upcoming, past, next: next ?? today[0] ?? later[0] ?? null, today, later, completed, cancelled };
}

/** A Study Hall needs a Guide report after the video session, not after cancel/no-show. */
export function guideNeedsReport(booking, reported = false, nowMs = Date.now()) {
  if (!booking || reported) return false;
  if (booking.status === "cancelled" || booking.status === "expired" || booking.status === "no_show") {
    return false;
  }
  if (booking.status === "completed") return true;
  if (booking.status !== "confirmed") return false;
  const end = booking.scheduled_end
    ? Date.parse(booking.scheduled_end)
    : booking.scheduled_start
      ? Date.parse(booking.scheduled_start) + 60 * 60000
      : NaN;
  return Number.isFinite(end) && nowMs >= end;
}

export function unfinishedGuideReport(bookings, reportedIds, nowMs = Date.now()) {
  const reported = reportedIds instanceof Set ? reportedIds : new Set(reportedIds ?? []);
  const due = (bookings ?? [])
    .filter((b) => guideNeedsReport(b, reported.has(b.id), nowMs))
    .sort((a, b) => Date.parse(b.scheduled_end ?? b.scheduled_start ?? 0) - Date.parse(a.scheduled_end ?? a.scheduled_start ?? 0));
  return due[0] ?? null;
}

export function guideStartsInLabel(startISO, nowMs = Date.now()) {
  if (!startISO) return null;
  const ms = Date.parse(startISO) - nowMs;
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return "Started";
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `Starts in ${min} minute${min === 1 ? "" : "s"}`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `Starts in ${h} hour${h === 1 ? "" : "s"}`;
  return `Starts in ${h}h ${m}m`;
}

export function guideRowStatus(booking, nowMs = Date.now()) {
  const join = guideJoinUiState(booking.status, booking.scheduled_start, booking.scheduled_end, nowMs);
  if (join.kind === "join") return "Join";
  if (join.kind === "opens_at") return "Ready";
  if (join.kind === "awaiting") return "Awaiting confirmation";
  if (booking.status === "completed") return "Completed";
  if (booking.status === "no_show") return "No-show";
  if (booking.status === "cancelled" || booking.status === "expired") return "Cancelled";
  if (join.kind === "ended") return "Ended";
  return "Scheduled";
}

export function guideReportHref(bookingId) {
  return `/dashboard/tutor/study-halls/${bookingId}/report`;
}

export function guideEarningStatusLabel(status) {
  const s = String(status ?? "");
  if (s === "earned") return "Outstanding";
  if (s === "paid") return "Paid";
  if (s === "voided" || s === "void") return "Voided";
  return s.replace(/_/g, " ") || "—";
}

export function guideDayPart(nowMs = Date.now(), tz) {
  let hour;
  if (tz) {
    try {
      const raw = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        hourCycle: "h23",
      }).format(new Date(nowMs));
      hour = Number.parseInt(raw, 10);
    } catch {
      hour = new Date(nowMs).getHours();
    }
  } else {
    hour = new Date(nowMs).getHours();
  }
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function addDaysToKey(key, delta) {
  const [y, m, d] = String(key).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function weekdayInTz(ms, tz) {
  try {
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(ms));
    const i = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
    return i >= 0 ? i : new Date(ms).getDay();
  } catch {
    return new Date(ms).getDay();
  }
}

function minutesInTz(ms, tz) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(ms));
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return new Date(ms).getHours() * 60 + new Date(ms).getMinutes();
    return hour * 60 + minute;
  } catch {
    const d = new Date(ms);
    return d.getHours() * 60 + d.getMinutes();
  }
}

function clockMinutes(t) {
  const [hh, mm] = String(t ?? "00:00").slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
}

function formatClockMinutes(mins) {
  const h = Math.floor(((mins % 1440) + 1440) % 1440 / 60);
  const m = ((mins % 1440) + 1440) % 1440 % 60;
  const h12 = h % 12 || 12;
  const ap = h >= 12 ? "PM" : "AM";
  return m === 0 ? `${h12} ${ap}` : `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

/**
 * All non-cancelled Study Halls on the Guide-local calendar day, soonest first.
 */
export function guideDaySchedule(bookings, nowMs = Date.now(), tz) {
  const todayKey = calendarDayKey(nowMs, tz);
  return (bookings ?? [])
    .filter((b) => b?.scheduled_start && calendarDayKey(Date.parse(b.scheduled_start), tz) === todayKey)
    .filter((b) => b.status !== "cancelled" && b.status !== "expired")
    .sort((a, b) => Date.parse(a.scheduled_start) - Date.parse(b.scheduled_start));
}

/**
 * Sunday–Saturday calendar week in the Guide timezone.
 * Counts non-cancelled bookings whose scheduled_start falls in that week.
 */
export function guideWeekSummary(bookings, nowMs = Date.now(), tz) {
  const todayKey = calendarDayKey(nowMs, tz);
  const startKey = addDaysToKey(todayKey, -weekdayInTz(nowMs, tz));
  const endKey = addDaysToKey(startKey, 6);
  const inWeek = (bookings ?? []).filter((b) => {
    if (!b?.scheduled_start) return false;
    if (b.status === "cancelled" || b.status === "expired") return false;
    const key = calendarDayKey(Date.parse(b.scheduled_start), tz);
    return key >= startKey && key <= endKey;
  });
  const completed = inWeek.filter((b) => b.status === "completed").length;
  const upcoming = inWeek.filter((b) => b.status === "pending" || b.status === "confirmed").length;
  const minutes = inWeek.reduce((sum, b) => sum + (Number(b.duration_minutes) || 0), 0);
  return {
    count: inWeek.length,
    hours: Math.round((minutes / 60) * 10) / 10,
    completed,
    upcoming,
    startKey,
    endKey,
  };
}

function exceptionCovers(exceptions, ms) {
  return (exceptions ?? []).some((ex) => {
    const a = Date.parse(ex.starts_at);
    const b = Date.parse(ex.ends_at);
    return Number.isFinite(a) && Number.isFinite(b) && ms >= a && ms < b;
  });
}

/**
 * Presentation-only availability readout from existing weekly blocks + exceptions.
 * Does not change matching.
 */
export function guideAvailabilitySummary(blocks, exceptions, nowMs = Date.now(), tz = "UTC") {
  const list = blocks ?? [];
  const nowMin = minutesInTz(nowMs, tz);
  const dow = weekdayInTz(nowMs, tz);
  const exceptedNow = exceptionCovers(exceptions, nowMs);

  const todayWindows = list
    .filter((b) => Number(b.day_of_week) === dow)
    .map((b) => ({ start: clockMinutes(b.start_time), end: clockMinutes(b.end_time) }))
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start);

  const inBlock = todayWindows.some((w) => nowMin >= w.start && nowMin < w.end);
  const availableNow = inBlock && !exceptedNow;
  const remainingToday = todayWindows.filter((w) => w.end > nowMin);
  const availableToday = remainingToday.length > 0 && !exceptedNow;

  let nextWindow = null;
  if (remainingToday[0] && !exceptedNow) {
    const w = remainingToday[0];
    nextWindow = {
      when: "Today",
      range: `${formatClockMinutes(w.start)} – ${formatClockMinutes(w.end)}`,
    };
  } else {
    for (let offset = 1; offset <= 7; offset += 1) {
      const day = (dow + offset) % 7;
      const windows = list
        .filter((b) => Number(b.day_of_week) === day)
        .map((b) => ({ start: clockMinutes(b.start_time), end: clockMinutes(b.end_time) }))
        .filter((w) => w.end > w.start)
        .sort((a, b) => a.start - b.start);
      if (windows[0]) {
        const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        nextWindow = {
          when: offset === 1 ? "Tomorrow" : names[day],
          range: `${formatClockMinutes(windows[0].start)} – ${formatClockMinutes(windows[0].end)}`,
        };
        break;
      }
    }
  }

  return {
    availableNow,
    availableToday,
    nextWindow,
    hasSchedule: list.length > 0,
  };
}

/**
 * Outstanding uses earned rows. Paid this month uses paid_at in the Guide-local calendar month.
 */
export function guideEarningsHomeSummary(earnings, nowMs = Date.now(), tz, currency = "USD") {
  const month = calendarDayKey(nowMs, tz).slice(0, 7);
  let outstanding = 0;
  let paidMonth = 0;
  for (const row of earnings ?? []) {
    if (!row || row.status === "voided" || row.status === "void") continue;
    const amount = Number(row.amount_cents) || 0;
    if (row.status === "earned") outstanding += amount;
    if (row.status === "paid" && row.paid_at) {
      const key = calendarDayKey(Date.parse(row.paid_at), tz);
      if (key.startsWith(month)) paidMonth += amount;
    }
  }
  return { outstanding, paidMonth, currency: currency || "USD" };
}
