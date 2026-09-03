/**
 * Parent portal presentation helpers only.
 * Does not change booking, pay, matching, Daily, or recording retention.
 */

import { partitionBookings } from "./bookings.mjs";
import { customerJoinState } from "./session-window.mjs";
import { customerBookingStatus } from "./status-labels.mjs";

export const PARENT_PORTAL_NAV = [
  { label: "Home", href: "/dashboard/student" },
  { label: "Study Halls", href: "/dashboard/student/study-halls" },
  { label: "Reports & Recordings", href: "/dashboard/student/reports" },
  { label: "Hours", href: "/dashboard/student/packages" },
  { label: "Account", href: "/dashboard/student/account" },
];

export function childFirstName(fullName, fallback = "Your child") {
  const n = String(fullName ?? "").trim();
  if (!n) return fallback;
  return n.split(/\s+/)[0];
}

export function parentGuideLabel(booking) {
  if (booking?.tutor_display_name) return booking.tutor_display_name;
  if (booking?.status === "confirmed" || booking?.status === "pending") return "Guide being assigned";
  return null;
}

export function parentStatusLabel(booking) {
  if ((booking?.status === "pending" || booking?.status === "confirmed") && booking?.payment_status === "awaiting_payment") {
    return "Payment needs attention";
  }
  if ((booking?.status === "confirmed" || booking?.status === "pending") && !booking?.tutor_display_name) {
    return "Guide being assigned";
  }
  return customerBookingStatus(booking?.status, booking?.payment_status).label;
}

export function parentStudyHallLists(bookings, nowMs = Date.now()) {
  const { upcoming, past, next } = partitionBookings(bookings, nowMs);
  const cancelled = past.filter((b) => b.status === "cancelled" || b.status === "expired");
  const completed = past.filter((b) => b.status !== "cancelled" && b.status !== "expired");
  return { upcoming, past: completed, cancelled, next };
}

/** Upcoming list rows after the current Next Study Hall — never duplicates Next. */
export function parentLaterStudyHalls(upcoming, next) {
  if (!next?.id) return upcoming ?? [];
  return (upcoming ?? []).filter((booking) => booking.id !== next.id);
}

export function parentUpcomingEmptyCopy(hasNext) {
  return hasNext ? "No additional Study Halls scheduled." : "Nothing scheduled yet.";
}

export function lastCompletedStudyHall(bookings, nowMs = Date.now()) {
  const { past } = parentStudyHallLists(bookings, nowMs);
  const done = past.filter((b) => b.status === "completed" || b.status === "no_show");
  return (
    [...done].sort((a, b) => {
      const ta = new Date(a.scheduled_start ?? 0).getTime();
      const tb = new Date(b.scheduled_start ?? 0).getTime();
      return tb - ta;
    })[0] ?? null
  );
}

export function parentPrimaryAction(bookings, nowMs = Date.now()) {
  const joinable = (bookings ?? []).find((b) => {
    const { state } = customerJoinState(b.status, b.scheduled_start ?? null, b.scheduled_end ?? null, nowMs);
    return state === "join";
  });
  if (joinable) {
    return { kind: "join", href: `/dashboard/session/${joinable.id}`, label: "Join Study Hall", bookingId: joinable.id };
  }
  return { kind: "book", href: "/dashboard/student/book", label: "Book a Study Hall", bookingId: null };
}

export function parentJoinHint(booking, nowMs = Date.now()) {
  const { state } = customerJoinState(
    booking?.status,
    booking?.scheduled_start ?? null,
    booking?.scheduled_end ?? null,
    nowMs,
  );
  if (state === "join") return { state, label: "Join Study Hall" };
  if (state === "opens_at") return { state, label: "Ready to join 5 minutes before start" };
  if (state === "not_scheduled") return { state, label: "Time to be arranged" };
  if (state === "ended") return { state, label: "This Study Hall has ended" };
  return { state, label: null };
}

export function formatPrepaidHoursLabel(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total === 0) return "0 hours";
  const h = total / 60;
  if (Number.isInteger(h)) return `${h} hour${h === 1 ? "" : "s"}`;
  const whole = Math.floor(h);
  const m = total % 60;
  if (whole === 0) return `${m} minutes`;
  return `${whole} hour${whole === 1 ? "" : "s"} ${m} min`;
}

export function matchesParentStudyHallView(booking, view, nowMs = Date.now()) {
  const lists = parentStudyHallLists([booking], nowMs);
  if (view === "cancelled") return lists.cancelled.length > 0;
  if (view === "past") return lists.past.length > 0;
  return lists.upcoming.length > 0;
}

/**
 * Cancel is only meaningful while the Study Hall is still upcoming.
 * Does not change backend cancel/refund rules — presentation only.
 */
export function parentCanCancel(booking, nowMs = Date.now()) {
  if (!booking) return false;
  if (booking.status !== "pending" && booking.status !== "confirmed") return false;
  return parentStudyHallLists([booking], nowMs).upcoming.length > 0;
}

export function parentCanDispute(booking, hasOpenIssue = false) {
  if (!booking || hasOpenIssue) return false;
  return booking.status === "completed" || booking.status === "no_show";
}

/** Parent-facing purchase label. Never print Stripe purpose enums. */
export function parentPaymentPurposeLabel(purpose) {
  const p = String(purpose ?? "");
  if (p === "package") return "Prepaid hours";
  if (p === "booking") return "Study Hall session";
  if (p === "refund") return "Refund";
  return p.replace(/_/g, " ") || "Purchase";
}

/** Parent-facing payment row status. Succeeded rows show the amount instead. */
export function parentPaymentStatusLabel(status) {
  const s = String(status ?? "");
  if (s === "succeeded" || s === "paid") return "Paid";
  if (s === "refunded") return "Refunded";
  if (s === "pending" || s === "processing") return "Processing";
  if (s === "requires_payment" || s === "awaiting_payment" || s === "requires_payment_method") {
    return "Payment needs attention";
  }
  if (s === "canceled" || s === "cancelled") return "Cancelled";
  return s.replace(/_/g, " ") || "Update";
}

export function parentPaymentLineLabel(booking) {
  if (!booking) return "—";
  if (booking.is_free_trial) return "Free session";
  if (booking.payment_status === "awaiting_payment") return "Payment needs attention";
  if (booking.status === "cancelled" || booking.status === "expired") return "—";
  return "Paid or covered by hours";
}

const DEFAULT_PARENT_TZ = "America/Chicago";

function formatParts(date, timeZone, options) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).formatToParts(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", { timeZone: DEFAULT_PARENT_TZ, ...options }).formatToParts(date);
  }
}

function calendarYearMonth(date, timeZone = DEFAULT_PARENT_TZ) {
  const parts = formatParts(date, timeZone, { year: "numeric", month: "2-digit" });
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

function calendarDay(date, timeZone = DEFAULT_PARENT_TZ) {
  const parts = formatParts(date, timeZone, { day: "2-digit" });
  return Number(parts.find((p) => p.type === "day")?.value);
}

function daysInCalendarMonth(yearMonth) {
  const [year, month] = String(yearMonth).split("-").map(Number);
  if (!year || !month) return 31;
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Read-only count of completed Study Halls in the current calendar month.
 * Not a quota, allowance, or subscription period.
 */
export function completedStudyHallsThisMonth(bookings, nowMs = Date.now(), timeZone = DEFAULT_PARENT_TZ) {
  const now = new Date(nowMs);
  const yearMonth = calendarYearMonth(now, timeZone);
  const days = new Set();
  let count = 0;
  for (const booking of bookings ?? []) {
    if (booking?.status !== "completed") continue;
    if (!booking.scheduled_start) continue;
    const start = new Date(booking.scheduled_start);
    if (Number.isNaN(start.getTime())) continue;
    if (calendarYearMonth(start, timeZone) !== yearMonth) continue;
    count += 1;
    days.add(calendarDay(start, timeZone));
  }
  return {
    count,
    days: [...days].sort((a, b) => a - b),
    yearMonth,
    daysInMonth: daysInCalendarMonth(yearMonth),
  };
}

export function parentHabitCopy(count) {
  const n = Math.max(0, Number(count) || 0);
  if (n <= 0) {
    return {
      title: "Ready when you are.",
      body: "Regular sessions can help turn homework time into a more predictable routine.",
    };
  }
  if (n <= 2) {
    return {
      title: "A good start.",
      body: "You’re beginning to build a more consistent homework rhythm.",
    };
  }
  if (n <= 5) {
    return {
      title: "Building momentum.",
      body: "Repeated Study Halls are helping establish a more predictable routine.",
    };
  }
  if (n <= 9) {
    return {
      title: "Strong routine.",
      body: "Consistency is helping focused homework time become more familiar.",
    };
  }
  if (n <= 14) {
    return {
      title: "Consistency is becoming a habit.",
      body: "Your family is building a dependable Study Hall rhythm.",
    };
  }
  return {
    title: "Study Hall is part of the routine.",
    body: "Consistent focused time is becoming part of the household rhythm.",
  };
}

export function parentSessionMinutes(booking) {
  if (booking?.duration_minutes) return booking.duration_minutes;
  if (!booking?.scheduled_start || !booking?.scheduled_end) return null;
  const ms = new Date(booking.scheduled_end).getTime() - new Date(booking.scheduled_start).getTime();
  return ms > 0 ? Math.round(ms / 60000) : null;
}
