/**
 * Management Control Center — presentation helpers only.
 * Does not change booking, pay, matching, Daily, or compensation math.
 */

import { JOIN_CLOSE_GRACE_MIN } from "./session-window.mjs";

export const MANAGEMENT_STATUSES = ["ready", "live", "needs_attention", "completed", "cancelled"];

export const MANAGEMENT_STATUS_LABEL = {
  ready: "Ready",
  live: "Live",
  needs_attention: "Needs attention",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function calendarDateInTz(iso, tz) {
  if (!iso) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(iso));
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return null;
  }
}

export function todayDateInTz(tz, nowMs = Date.now()) {
  return calendarDateInTz(new Date(nowMs).toISOString(), tz);
}

export function sessionEndMs(booking) {
  if (booking?.scheduled_end) return new Date(booking.scheduled_end).getTime();
  if (!booking?.scheduled_start) return null;
  const mins = Number(booking.duration_minutes) > 0 ? Number(booking.duration_minutes) : 60;
  return new Date(booking.scheduled_start).getTime() + mins * 60_000;
}

function someoneJoined(presence) {
  return Boolean(presence?.student_first_joined_at || presence?.tutor_first_joined_at);
}

function ms(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * A role is currently in the room when last_seen (or first_joined) is set
 * and there is no later last_left. last_seen is written on join only — it is
 * not a heartbeat — so recency of last_seen must not be required.
 */
function roleCurrentlyPresent(firstJoined, lastSeen, lastLeft) {
  const presentAt = ms(lastSeen) ?? ms(firstJoined);
  if (presentAt == null) return false;
  const leftAt = ms(lastLeft);
  return leftAt == null || presentAt >= leftAt;
}

function someoneCurrentlyPresent(presence) {
  if (!presence) return false;
  return (
    roleCurrentlyPresent(presence.student_first_joined_at, presence.student_last_seen_at, presence.student_last_left_at) ||
    roleCurrentlyPresent(presence.tutor_first_joined_at, presence.tutor_last_seen_at, presence.tutor_last_left_at)
  );
}

/**
 * LIVE only when the Study Hall is in its operational period AND a participant
 * is currently present (join without a later leave). Scheduled time or a
 * historical first_joined_at alone is not enough.
 */
export function isStudyHallLive(booking, presence, nowMs = Date.now()) {
  if (!booking || booking.status !== "confirmed") return false;
  if (!booking.scheduled_start) return false;
  const start = new Date(booking.scheduled_start).getTime();
  const close = (sessionEndMs(booking) ?? start) + JOIN_CLOSE_GRACE_MIN * 60_000;
  if (nowMs < start || nowMs > close) return false;
  return someoneCurrentlyPresent(presence);
}

export function isOpenStudyHall(status) {
  return status === "confirmed" || status === "pending";
}

export function isFinishedStatus(status) {
  return status === "completed" || status === "no_show";
}

export function isCancelledStatus(status) {
  return status === "cancelled" || status === "expired";
}

function hasGuide(booking) {
  return Boolean(booking?.tutor_id || booking?.tutor_display_name);
}

function paymentNeedsReview(booking) {
  if (!booking || booking.is_free_trial) return false;
  return booking.payment_status === "awaiting_payment" || booking.payment_status === "failed";
}

/**
 * Human management status. Internal booking statuses stay intact.
 */
export function managementOperationalStatus(booking, { presence = null, nowMs = Date.now(), attention = false } = {}) {
  if (!booking) return "needs_attention";
  if (isCancelledStatus(booking.status)) return "cancelled";
  if (isFinishedStatus(booking.status)) return attention ? "needs_attention" : "completed";
  if (isStudyHallLive(booking, presence, nowMs)) return "live";
  if (attention) return "needs_attention";
  if (!hasGuide(booking) && isOpenStudyHall(booking.status)) return "needs_attention";
  if (paymentNeedsReview(booking) && isOpenStudyHall(booking.status)) return "needs_attention";
  if (booking.status === "confirmed" && booking.scheduled_start) {
    const start = new Date(booking.scheduled_start).getTime();
    const close = (sessionEndMs(booking) ?? start) + JOIN_CLOSE_GRACE_MIN * 60_000;
    if (nowMs >= start && nowMs <= close && !someoneJoined(presence)) return "needs_attention";
  }
  if (isOpenStudyHall(booking.status) && hasGuide(booking) && !paymentNeedsReview(booking)) return "ready";
  if (isOpenStudyHall(booking.status)) return "needs_attention";
  return "needs_attention";
}

export function matchesStudyHallSearch(booking, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return true;
  const hay = [
    booking.student_first_name,
    booking.student_full_name,
    booking.parent_name,
    booking.tutor_display_name,
    booking.public_reference,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function studyHallViewMembership(booking, view, { tz, nowMs, presence, attention }) {
  const status = managementOperationalStatus(booking, { presence, nowMs, attention });
  if (view === "attention") return status === "needs_attention";
  if (view === "completed") return status === "completed" || booking.status === "no_show";
  if (view === "cancelled") return status === "cancelled";
  if (view === "upcoming") {
    if (!isOpenStudyHall(booking.status) || !booking.scheduled_start) return false;
    return new Date(booking.scheduled_start).getTime() > nowMs && status !== "live";
  }
  if (view === "today") {
    if (!booking.scheduled_start) return false;
    return calendarDateInTz(booking.scheduled_start, tz) === todayDateInTz(tz, nowMs);
  }
  return true;
}

export function startsInLabel(iso, nowMs = Date.now()) {
  if (!iso) return null;
  const delta = new Date(iso).getTime() - nowMs;
  if (delta <= 0) return "Started";
  const mins = Math.round(delta / 60_000);
  if (mins < 60) return `Starts in ${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.round(mins / 60);
  return `Starts in ${hours} hour${hours === 1 ? "" : "s"}`;
}

function item(partial) {
  return {
    severity: "attention",
    ...partial,
  };
}

/**
 * Aggregate actionable exceptions from existing records. No new backend state.
 */
export function collectNeedsAttention({
  bookings = [],
  presenceByBooking = {},
  cancelRequests = [],
  escalations = [],
  emailFailures = [],
  recordingFailures = [],
  disputes = [],
  missingReports = [],
  pendingApplicants = [],
  nowMs = Date.now(),
} = {}) {
  const items = [];
  const cancelBookingIds = new Set(cancelRequests.map((r) => r.booking_id).filter(Boolean));

  for (const b of bookings) {
    if (!isOpenStudyHall(b.status)) continue;
    if (!hasGuide(b)) {
      items.push(
        item({
          id: `no-guide:${b.id}`,
          kind: "needs_guide",
          title: "Study Hall needs a Guide",
          detail: [b.student_first_name ?? "Child", startsInLabel(b.scheduled_start, nowMs)].filter(Boolean).join(" · "),
          bookingId: b.id,
          href: `/dashboard/admin/study-halls/${b.id}`,
          action: "Assign Guide",
        }),
      );
    } else if (b.status === "confirmed" && b.scheduled_start) {
      const start = new Date(b.scheduled_start).getTime();
      const close = (sessionEndMs(b) ?? start) + JOIN_CLOSE_GRACE_MIN * 60_000;
      if (nowMs >= start && nowMs <= close && !someoneJoined(presenceByBooking[b.id])) {
        items.push(
          item({
            id: `no-join:${b.id}`,
            kind: "no_join",
            title: "Study Hall started — no one has joined",
            detail: [b.student_first_name ?? "Child", b.tutor_display_name].filter(Boolean).join(" · "),
            bookingId: b.id,
            href: `/dashboard/admin/study-halls/${b.id}`,
            action: "View Study Hall",
          }),
        );
      }
    }
    if (paymentNeedsReview(b)) {
      items.push(
        item({
          id: `pay:${b.id}`,
          kind: "payment",
          title: "Payment needs review",
          detail: [b.student_first_name ?? "Child", b.public_reference].filter(Boolean).join(" · "),
          bookingId: b.id,
          href: `/dashboard/admin/study-halls/${b.id}`,
          action: "View Study Hall",
        }),
      );
    }
  }

  for (const r of cancelRequests) {
    items.push(
      item({
        id: `coverage:${r.id}`,
        kind: "coverage",
        title: "Could not find a replacement Guide",
        detail: [r.student_first_name ?? r.bookings?.student_first_name ?? "Child", startsInLabel(r.scheduled_start ?? r.bookings?.scheduled_start, nowMs)]
          .filter(Boolean)
          .join(" · "),
        bookingId: r.booking_id,
        href: r.booking_id ? `/dashboard/admin/study-halls/${r.booking_id}` : "/dashboard/admin/study-halls?view=attention",
        action: "Assign Guide",
      }),
    );
  }

  for (const e of escalations) {
    const failed =
      e.status === "failed" ||
      e.status === "not_configured" ||
      e.outcome === "failed" ||
      e.outcome === "not_configured" ||
      e.outcome === "no_phone";
    if (!failed) continue;
    items.push(
      item({
        id: `call:${e.id}`,
        kind: "call_parent",
        title: "Call Parent did not reach the parent",
        detail: e.bookings?.student_first_name ?? e.student_first_name ?? "Study Hall",
        bookingId: e.booking_id,
        href: e.booking_id ? `/dashboard/admin/study-halls/${e.booking_id}` : "/dashboard/admin/study-halls",
        action: "View Study Hall",
      }),
    );
  }

  for (const d of emailFailures) {
    items.push(
      item({
        id: `notify:${d.id}`,
        kind: "notify",
        title: "Parent wasn't notified",
        detail: d.to_email ?? d.notification_type ?? "Message failed",
        bookingId: d.booking_id ?? null,
        href: d.booking_id ? `/dashboard/admin/study-halls/${d.booking_id}` : "/dashboard/admin/finance",
        action: d.booking_id ? "View Study Hall" : "Open Finance",
      }),
    );
  }

  for (const rec of recordingFailures) {
    items.push(
      item({
        id: `rec:${rec.id}`,
        kind: "recording",
        title: "Recording unavailable",
        detail: rec.student_first_name ?? "Completed Study Hall",
        bookingId: rec.booking_id,
        href: rec.booking_id ? `/dashboard/admin/study-halls/${rec.booking_id}` : "/dashboard/admin/study-halls?view=completed",
        action: "View Study Hall",
      }),
    );
  }

  for (const d of disputes) {
    if (d.status !== "open" && d.status !== "under_review") continue;
    items.push(
      item({
        id: `dispute:${d.id}`,
        kind: "dispute",
        title: "Payment needs review",
        detail: "A parent dispute is waiting",
        bookingId: d.booking_id,
        href: "/dashboard/admin/finance",
        action: "Open Finance",
      }),
    );
  }

  for (const b of missingReports) {
    items.push(
      item({
        id: `report:${b.id}`,
        kind: "report",
        title: "Guide report overdue",
        detail: [b.tutor_display_name ?? "Guide", b.student_first_name ?? "Child"].filter(Boolean).join(" · "),
        bookingId: b.id,
        href: `/dashboard/admin/study-halls/${b.id}`,
        action: "View Study Hall",
      }),
    );
  }

  for (const a of pendingApplicants) {
    items.push(
      item({
        id: `applicant:${a.profile_id}`,
        kind: "applicant",
        title: "Guide application waiting",
        detail: a.display_name ?? a.profiles?.display_name ?? "Applicant",
        href: "/dashboard/admin/guides",
        action: "Review application",
      }),
    );
  }

  void cancelBookingIds;
  return items;
}

export function comingUpBookings(bookings, { presenceByBooking = {}, nowMs = Date.now(), limit = 8, attentionIds = new Set() } = {}) {
  return bookings
    .filter((b) => {
      if (!b.scheduled_start) return false;
      if (isStudyHallLive(b, presenceByBooking[b.id], nowMs)) return true;
      if (!isOpenStudyHall(b.status)) return false;
      return new Date(b.scheduled_start).getTime() >= nowMs - 60_000;
    })
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
    .slice(0, limit)
    .map((b) => ({
      ...b,
      statusLayer: managementOperationalStatus(b, {
        presence: presenceByBooking[b.id],
        nowMs,
        attention: attentionIds.has(b.id),
      }),
    }));
}
