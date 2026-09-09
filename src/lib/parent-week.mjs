/**
 * Parent Home week presentation. Read-model only.
 * Does not book, fund, join, cancel, or compute Guide availability.
 */

import { localDateForInstant, safeTimeZone } from "./study-hall-365/calendar.mjs";
import { PLAN_MY_WEEK_HREF, planningWeek } from "./plan-my-week.mjs";
import { formatPrepaidStudyHallBalance } from "./study-hall-funding-copy.mjs";

export const PARENT_BOOK_HREF = "/dashboard/student/book";
export const PARENT_HOURS_HREF = "/dashboard/student/packages";

const SKIP_STATUSES = new Set(["cancelled", "expired"]);
const PLANNED_STATUSES = new Set(["pending", "confirmed", "completed", "no_show"]);

export function parseParentMembership(payload) {
  if (!payload || typeof payload !== "object") return null;
  const mem =
    payload.membership && typeof payload.membership === "object"
      ? payload.membership
      : "entitled" in payload
        ? payload
        : null;
  if (!mem) return null;
  const periodEnd = mem.current_period_end ? String(mem.current_period_end) : "";
  return {
    entitled: Boolean(mem.entitled),
    cancelAtPeriodEnd: Boolean(mem.cancel_at_period_end),
    periodEnd: periodEnd || null,
    customerStatus: String(mem.customer_status ?? (mem.entitled ? "active" : "inactive")),
  };
}

function awaitingPayment(booking) {
  return (
    (booking?.status === "pending" || booking?.status === "confirmed") &&
    booking?.payment_status === "awaiting_payment"
  );
}

export function bookingsOnLocalDate(bookings, localDate, timeZone) {
  const tz = safeTimeZone(timeZone);
  return (bookings ?? []).filter((booking) => {
    if (!booking?.scheduled_start) return false;
    if (SKIP_STATUSES.has(booking.status)) return false;
    return localDateForInstant(booking.scheduled_start, tz) === localDate;
  });
}

function stillOpen(booking, nowMs) {
  if (booking.status !== "pending" && booking.status !== "confirmed") return false;
  if (awaitingPayment(booking)) return false;
  const end = booking.scheduled_end
    ? new Date(booking.scheduled_end).getTime()
    : new Date(booking.scheduled_start).getTime() + 60 * 60_000;
  return Number.isFinite(end) && end >= nowMs;
}

/**
 * Day scan state from actual booking rows. Pending payment is never Completed.
 */
export function parentWeekDayKind(bookingsOnDay, { isToday = false, nowMs = Date.now() } = {}) {
  const rows = bookingsOnDay ?? [];
  const completed = rows.filter((booking) => booking.status === "completed");
  const open = rows.filter((booking) => stillOpen(booking, nowMs));
  const paidPlan = rows.filter(
    (booking) =>
      (booking.status === "pending" || booking.status === "confirmed") && !awaitingPayment(booking),
  );
  const awaiting = rows.filter(awaitingPayment);
  const missed = rows.filter((booking) => booking.status === "no_show");

  if (isToday && open.length > 0) return "today";
  if (completed.length > 0) return "completed";
  if (paidPlan.length > 0) return "scheduled";
  if (awaiting.length > 0) return "payment_needed";
  if (missed.length > 0) return "missed";
  return "none";
}

export function parentWeekDayLabel(kind, { compact = false } = {}) {
  if (kind === "today") return compact ? "Today" : "TODAY";
  if (kind === "completed") return compact ? "Done" : "COMPLETED";
  if (kind === "scheduled") return compact ? "Set" : "SCHEDULED";
  if (kind === "payment_needed") return compact ? "Pay" : "PAYMENT NEEDED";
  if (kind === "missed") return compact ? "Missed" : "MISSED STUDY HALL";
  return compact ? "—" : "NO STUDY HALL";
}

export function parentWeekStrip(bookings, timeZone, nowMs = Date.now()) {
  const week = planningWeek(timeZone, new Date(nowMs), 0);
  return week.days.map((day) => {
    const rows = bookingsOnLocalDate(bookings, day.localDate, week.timeZone);
    const kind = parentWeekDayKind(rows, { isToday: day.isToday, nowMs });
    return {
      ...day,
      kind,
      label: parentWeekDayLabel(kind),
      compactLabel: parentWeekDayLabel(kind, { compact: true }),
      bookingCount: rows.length,
    };
  });
}

export function parentWeekCompletion(bookings, timeZone, nowMs = Date.now()) {
  const week = planningWeek(timeZone, new Date(nowMs), 0);
  const tz = week.timeZone;
  const planned = (bookings ?? []).filter((booking) => {
    if (!booking?.scheduled_start) return false;
    if (!PLANNED_STATUSES.has(booking.status)) return false;
    if (awaitingPayment(booking)) return false;
    const date = localDateForInstant(booking.scheduled_start, tz);
    return date >= week.monday && date <= week.sunday;
  });
  const completed = planned.filter((booking) => booking.status === "completed").length;
  const scheduled = planned.length;
  return {
    completed,
    scheduled,
    monday: week.monday,
    sunday: week.sunday,
    weekLabel: week.label,
    empty: scheduled === 0,
  };
}

export function parentWeekCompletionCopy(completion) {
  const scheduled = Number(completion?.scheduled) || 0;
  const completed = Number(completion?.completed) || 0;
  if (scheduled === 0) {
    return {
      headline: "No Study Halls this week yet.",
      body: "Plan a few evenings so homework time stays predictable.",
    };
  }
  if (completed >= scheduled) {
    return {
      headline: `${completed} of ${scheduled} scheduled Study Halls completed this week.`,
      body: "We kept up with our Study Hall routine this week.",
    };
  }
  if (completed === 0) {
    return {
      headline: `${scheduled} Study Halls on the calendar this week.`,
      body: "The week is on the calendar.",
    };
  }
  return {
    headline: `${completed} of ${scheduled} scheduled Study Halls completed this week.`,
    body: "We’re keeping up with our Study Hall routine.",
  };
}

export function formatMembershipPeriodEnd(iso, timeZone) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: safeTimeZone(timeZone),
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function parentMembershipPresentation(membership, timeZone) {
  if (!membership?.entitled) return null;
  const through = formatMembershipPeriodEnd(membership.periodEnd, timeZone);
  if (membership.cancelAtPeriodEnd && through) {
    return {
      title: "Study Hall 365",
      status: "Active",
      detail: `One Study Hall per day. Access continues through ${through}.`,
    };
  }
  return {
    title: "Study Hall 365",
    status: "Active",
    detail: "One Study Hall per day",
  };
}

/**
 * Home CTA hierarchy. Join stays on the Next Study Hall card when eligible.
 */
export function parentHomeCtas({
  entitled365 = false,
  freeTrialAvailable = false,
} = {}) {
  if (entitled365) {
    return {
      primary: { href: PLAN_MY_WEEK_HREF, label: "Plan my week" },
      secondary: { href: PARENT_BOOK_HREF, label: "Book a Study Hall" },
      showBuyHours: false,
      showFreeTrial: false,
      fundingKind: "membership",
    };
  }
  if (freeTrialAvailable) {
    return {
      primary: { href: PARENT_BOOK_HREF, label: "Book free session" },
      secondary: { href: PLAN_MY_WEEK_HREF, label: "Plan my week" },
      showBuyHours: false,
      showFreeTrial: true,
      fundingKind: "free_trial",
    };
  }
  return {
    primary: { href: PLAN_MY_WEEK_HREF, label: "Plan my week" },
    secondary: { href: PARENT_BOOK_HREF, label: "Book a Study Hall" },
    showBuyHours: true,
    showFreeTrial: false,
    fundingKind: "prepaid",
  };
}

export function parentHomeFundingCopy({
  entitled365 = false,
  minutes = 0,
  creditCents = 0,
  freeTrialAvailable = false,
} = {}) {
  const prepaid = formatPrepaidStudyHallBalance(minutes);
  const credit = Number(creditCents) > 0 ? Number(creditCents) : 0;
  if (entitled365) {
    const halls = Math.floor(Math.max(0, Number(minutes) || 0) / 60);
    return {
      kind: "membership",
      line:
        halls > 0
          ? halls === 1
            ? "You also have 1 prepaid Study Hall for an extra same-day session."
            : `You also have ${halls} prepaid Study Halls for extra same-day sessions.`
          : null,
      showZeroPrepaid: false,
      showBuyHours: false,
      creditCents: credit,
    };
  }
  if (freeTrialAvailable) {
    return {
      kind: "free_trial",
      line: "Your first Study Hall is on us — 60 minutes free, no credit card required.",
      showZeroPrepaid: false,
      showBuyHours: false,
      creditCents: credit,
    };
  }
  const creditCoversHall = credit >= 1200;
  if (Number(minutes) < 60 && creditCoversHall) {
    return {
      kind: "credit",
      line: "Account credit can cover this Study Hall.",
      showZeroPrepaid: false,
      showBuyHours: false,
      creditCents: credit,
    };
  }
  return {
    kind: "prepaid",
    line: minutes > 0 ? prepaid : "Pay as you go is $12 for one 60-minute Study Hall.",
    showZeroPrepaid: minutes === 0,
    showBuyHours: false,
    creditCents: credit,
  };
}
