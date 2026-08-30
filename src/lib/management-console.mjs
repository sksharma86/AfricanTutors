/**
 * Management Console presentation helpers.
 * Does not change booking, pay, matching, Daily, or compensation math.
 */

import { bookingChildNames } from "./household-children.mjs";
import {
  calendarDateInTz,
  isCancelledStatus,
  isFinishedStatus,
  isOpenStudyHall,
  isStudyHallLive,
  todayDateInTz,
} from "./management-ops.mjs";
import { guideWorkforceLabel } from "./guide-workforce.mjs";

export function managementClockLabel(nowMs = Date.now(), tz = "UTC") {
  try {
    const d = new Date(nowMs);
    const zone = tz || "UTC";
    const date = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(d);
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
    return `${date} · ${time}`;
  } catch {
    return "";
  }
}

export function managementTodayShort(nowMs = Date.now(), tz = "UTC") {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "UTC",
      month: "short",
      day: "numeric",
    })
      .format(new Date(nowMs))
      .toUpperCase();
  } catch {
    return "";
  }
}

function firstName(name) {
  const n = String(name ?? "").trim();
  if (!n) return null;
  return n.split(/\s+/)[0];
}

/**
 * Today pulse from existing booking status + presence.
 * Live uses isStudyHallLive (confirmed + window + currently present).
 */
export function managementTodayPulse(bookings = [], presenceByBooking = {}, tz, nowMs = Date.now()) {
  const today = todayDateInTz(tz, nowMs);
  const todayRows = (bookings ?? []).filter(
    (b) => b?.scheduled_start && calendarDateInTz(b.scheduled_start, tz) === today,
  );
  const counted = todayRows.filter((b) => !isCancelledStatus(b.status));
  const live = counted.filter((b) => isStudyHallLive(b, presenceByBooking[b.id], nowMs));
  const completed = counted.filter((b) => isFinishedStatus(b.status));
  const upcoming = counted.filter((b) => {
    if (!isOpenStudyHall(b.status) || !b.scheduled_start) return false;
    if (isStudyHallLive(b, presenceByBooking[b.id], nowMs)) return false;
    return new Date(b.scheduled_start).getTime() > nowMs;
  });
  const next = [...upcoming].sort(
    (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
  )[0] ?? null;

  return {
    todayKey: today,
    count: counted.length,
    live: live.length,
    upcoming: upcoming.length,
    completed: completed.length,
    liveRows: live.slice(0, 3),
    nextRows: upcoming.slice(0, 3),
    next,
  };
}

export function managementTodayWorkload(bookings = [], tz, nowMs = Date.now()) {
  const today = todayDateInTz(tz, nowMs);
  const counts = new Map();
  for (const b of bookings ?? []) {
    if (!b?.scheduled_start || calendarDateInTz(b.scheduled_start, tz) !== today) continue;
    if (isCancelledStatus(b.status)) continue;
    const name = b.tutor_display_name;
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, sessions]) => ({ name, sessions }))
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
    .slice(0, 3);
}

export function managementCoverageSummary(bookings = [], guides = [], tz, nowMs = Date.now()) {
  const today = todayDateInTz(tz, nowMs);
  const todayOpen = (bookings ?? []).filter((b) => {
    if (!b?.scheduled_start || calendarDateInTz(b.scheduled_start, tz) !== today) return false;
    return isOpenStudyHall(b.status);
  });
  const assigned = todayOpen.filter((b) => b.tutor_id || b.tutor_display_name).length;
  const needing = todayOpen.length - assigned;
  const active = (guides ?? []).filter((g) => guideWorkforceLabel(g.status, g.approved_at) === "active").length;
  const applications = (guides ?? []).filter((g) => guideWorkforceLabel(g.status, g.approved_at) === "pending").length;
  return {
    active,
    applications,
    todayOpen: todayOpen.length,
    assigned,
    needing,
    covered: todayOpen.length > 0 && needing === 0,
  };
}

/**
 * Recent operational rows derived only from records that already carry a time.
 * Not a new event-log system.
 */
export function managementRecentActivity(bookings = [], reports = [], nowMs = Date.now()) {
  const rows = [];
  for (const b of bookings ?? []) {
    if (!b?.id) continue;
    if (b.status === "completed" && b.scheduled_end) {
      rows.push({
        id: `completed:${b.id}`,
        at: Date.parse(b.scheduled_end),
        type: "Study Hall completed",
        details: `${bookingChildNames(b, "Child")} completed.`,
        related: bookingChildNames(b, "Child"),
        by: firstName(b.tutor_display_name) ?? "System",
        href: `/dashboard/admin/study-halls/${b.id}`,
      });
    }
    /* Cancelled/expired rows are omitted: bookings do not carry a reliable cancellation timestamp. */
  }
  for (const r of reports ?? []) {
    const at = Date.parse(r.submitted_at ?? "");
    if (!Number.isFinite(at) || !r.booking_id) continue;
    const booking = (bookings ?? []).find((b) => b.id === r.booking_id);
    rows.push({
      id: `report:${r.booking_id}`,
      at,
      type: "Report submitted",
      details: booking ? `${bookingChildNames(booking, "Child")} report submitted.` : "Guide report submitted.",
      related: booking ? bookingChildNames(booking, "Child") : "Study Hall",
      by: firstName(booking?.tutor_display_name) ?? "Guide",
      href: `/dashboard/admin/study-halls/${r.booking_id}`,
    });
  }
  return rows
    .filter((r) => Number.isFinite(r.at) && r.at <= nowMs)
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);
}

export function managementPaymentsTodayCents(payments = [], tz, nowMs = Date.now()) {
  const today = todayDateInTz(tz, nowMs);
  let cents = 0;
  for (const p of payments ?? []) {
    if (!p?.created_at) continue;
    if (calendarDateInTz(p.created_at, tz) !== today) continue;
    const status = String(p.status ?? "");
    if (status !== "succeeded" && status !== "paid") continue;
    cents += Number(p.stripe_paid_cents) || 0;
  }
  return cents;
}
