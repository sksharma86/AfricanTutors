/**
 * Guide workstation presentation helpers.
 * Does not change booking, Daily, matching, compensation, or Call Parent.
 */

import { partitionBookings } from "./bookings.mjs";
import { guideJoinUiState } from "./tutor-schedule.mjs";

export const GUIDE_PORTAL_NAV = [
  { label: "Home", href: "/dashboard/tutor" },
  { label: "Study Halls", href: "/dashboard/tutor/study-halls" },
  { label: "Availability", href: "/dashboard/tutor/availability" },
  { label: "Earnings", href: "/dashboard/tutor/earnings" },
];

export function guideChildName(booking, fallback = "Child") {
  const n = String(booking?.student_first_name ?? "").trim();
  return n || fallback;
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
