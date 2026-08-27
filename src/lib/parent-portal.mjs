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
