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

const RECENT_NOTIFY_MS = 48 * 60 * 60 * 1000;
const RECENT_RECORDING_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_REPORT_MS = 14 * 24 * 60 * 60 * 1000;

function bookingById(bookings) {
  const map = new Map();
  for (const b of bookings ?? []) {
    if (b?.id) map.set(b.id, b);
  }
  return map;
}

function stillOperational(booking, nowMs) {
  if (!booking) return false;
  if (isOpenStudyHall(booking.status)) return true;
  const end = sessionEndMs(booking);
  return end != null && nowMs <= end + JOIN_CLOSE_GRACE_MIN * 60_000;
}

function recentlyFinished(booking, nowMs, windowMs) {
  if (!booking || !isFinishedStatus(booking.status)) return false;
  const end = sessionEndMs(booking);
  if (end == null) return false;
  return end < nowMs && nowMs - end <= windowMs;
}

function failedCall(e) {
  return (
    e?.status === "failed" ||
    e?.status === "not_configured" ||
    e?.outcome === "failed" ||
    e?.outcome === "not_configured" ||
    e?.outcome === "no_phone"
  );
}

/**
 * Current unresolved issues for one Study Hall. Historical diagnostics stay out.
 */
export function currentStudyHallIssues(booking, extras = {}) {
  const {
    presence = null,
    cancelOpen = false,
    escalations = [],
    emailFailures = [],
    recordingFailures = [],
    missingReport = false,
    nowMs = Date.now(),
  } = extras;
  if (!booking) return [];
  const issues = [];

  if (isOpenStudyHall(booking.status) && !hasGuide(booking)) {
    issues.push({
      kind: "needs_guide",
      title: "Needs a Guide",
      summary: "No Guide is assigned.",
      detail: startsInLabel(booking.scheduled_start, nowMs),
      action: "Assign Guide",
    });
  }

  if (cancelOpen && isOpenStudyHall(booking.status)) {
    issues.push({
      kind: "coverage",
      title: "Guide replacement failed",
      summary: "We couldn't automatically find another Guide.",
      detail: startsInLabel(booking.scheduled_start, nowMs),
      action: "Reassign",
    });
  }

  if (isOpenStudyHall(booking.status) && paymentNeedsReview(booking)) {
    issues.push({
      kind: "payment",
      title: "Payment needs review",
      summary: "Payment for this Study Hall has not completed.",
      detail: booking.public_reference ?? null,
      action: "Review",
    });
  }

  if (booking.status === "confirmed" && booking.scheduled_start) {
    const start = new Date(booking.scheduled_start).getTime();
    const close = (sessionEndMs(booking) ?? start) + JOIN_CLOSE_GRACE_MIN * 60_000;
    if (nowMs >= start && nowMs <= close && !someoneJoined(presence)) {
      issues.push({
        kind: "no_join",
        title: "No one has joined",
        summary: "This Study Hall is underway and nobody has joined yet.",
        detail: booking.tutor_display_name ?? null,
        action: "View",
      });
    }
  }

  if (stillOperational(booking, nowMs) && escalations.some(failedCall)) {
    issues.push({
      kind: "call_parent",
      title: "Parent needs help",
      summary: "Parent assistance was requested and the parent was not reached.",
      detail: null,
      action: "View request",
    });
  }

  const currentNotify = emailFailures.filter((d) => {
    if (!stillOperational(booking, nowMs) && !recentlyFinished(booking, nowMs, RECENT_NOTIFY_MS)) return false;
    const at = ms(d.updated_at);
    return at == null || nowMs - at <= RECENT_NOTIFY_MS;
  });
  if (currentNotify.length) {
    issues.push({
      kind: "notify",
      title: "Parent wasn't notified",
      summary: "A current message to the parent did not send.",
      detail: currentNotify[0].to_email ?? currentNotify[0].notification_type ?? null,
      action: "View",
    });
  }

  if (missingReport && recentlyFinished(booking, nowMs, RECENT_REPORT_MS)) {
    const end = sessionEndMs(booking);
    if (end != null && nowMs - end >= 24 * 60 * 60 * 1000) {
      issues.push({
        kind: "report",
        title: "Guide report missing",
        summary: "The completed Study Hall does not yet have its required report.",
        detail: booking.tutor_display_name ?? null,
        action: "View",
      });
    }
  }

  const failedRecs = recordingFailures.filter((r) => r.status === "failed" || !r.status);
  if (failedRecs.length && recentlyFinished(booking, nowMs, RECENT_RECORDING_MS)) {
    issues.push({
      kind: "recording",
      title: "Recording unavailable",
      summary: "The recording for this completed Study Hall did not finish.",
      detail: null,
      action: "View",
    });
  }

  return issues;
}

/**
 * Human management status. Internal booking statuses stay intact.
 * Needs attention only when currentStudyHallIssues is non-empty.
 */
export function managementOperationalStatus(booking, opts = {}) {
  const { presence = null, nowMs = Date.now(), issues: provided } = opts;
  if (!booking) return "needs_attention";
  if (isCancelledStatus(booking.status)) return "cancelled";
  const issues = provided ?? currentStudyHallIssues(booking, opts);
  if (isStudyHallLive(booking, presence, nowMs)) return "live";
  if (issues.length) return "needs_attention";
  if (isFinishedStatus(booking.status)) return "completed";
  if (isOpenStudyHall(booking.status) && hasGuide(booking) && !paymentNeedsReview(booking)) return "ready";
  if (isOpenStudyHall(booking.status)) return "needs_attention";
  return "needs_attention";
}

export function managementGreeting(nowMs = Date.now(), tz = "UTC") {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "UTC",
      hour: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date(nowMs));
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 12);
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  } catch {
    return "Hello";
  }
}

export function managementDateLabel(nowMs = Date.now(), tz = "UTC") {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "UTC",
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date(nowMs));
  } catch {
    return "";
  }
}

function groupRowsByBooking(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const id = row?.booking_id;
    if (!id) continue;
    const list = map.get(id) ?? [];
    list.push(row);
    map.set(id, list);
  }
  return map;
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

export function studyHallViewMembership(booking, view, { tz, nowMs, presence, issues } = {}) {
  const issueList = issues ?? booking.issues ?? currentStudyHallIssues(booking, { presence, nowMs });
  const status = managementOperationalStatus(booking, { presence, nowMs, issues: issueList });
  if (view === "attention") return issueList.length > 0;
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

function attentionFromIssue(booking, issue) {
  return item({
    id: `${issue.kind}:${booking.id}`,
    kind: issue.kind,
    title: issue.title,
    summary: issue.summary,
    detail: [booking.student_first_name ?? "Child", booking.tutor_display_name, issue.detail].filter(Boolean).join(" · "),
    bookingId: booking.id,
    href: `/dashboard/admin/study-halls/${booking.id}`,
    action: issue.action,
  });
}

/**
 * Current unresolved exceptions only. Historical diagnostics stay on detail pages.
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
  const bookingsMap = bookingById(bookings);
  const cancelOpen = new Set(cancelRequests.map((r) => r.booking_id).filter(Boolean));
  const escBy = groupRowsByBooking(escalations);
  const emailBy = groupRowsByBooking(emailFailures);
  const recBy = groupRowsByBooking(recordingFailures);
  const missingSet = new Set((missingReports ?? []).map((b) => b.id).filter(Boolean));
  const seen = new Set();

  for (const b of bookings) {
    if (!b?.id) continue;
    seen.add(b.id);
    const issues = currentStudyHallIssues(b, {
      presence: presenceByBooking[b.id],
      cancelOpen: cancelOpen.has(b.id),
      escalations: escBy.get(b.id) ?? [],
      emailFailures: emailBy.get(b.id) ?? [],
      recordingFailures: recBy.get(b.id) ?? [],
      missingReport: missingSet.has(b.id),
      nowMs,
    });
    for (const issue of issues) items.push(attentionFromIssue(b, issue));
  }

  for (const r of cancelRequests) {
    if (r.booking_id && seen.has(r.booking_id)) continue;
    const start = r.scheduled_start ?? r.bookings?.scheduled_start ?? bookingsMap.get(r.booking_id)?.scheduled_start;
    items.push(
      item({
        id: `coverage:${r.id}`,
        kind: "coverage",
        title: "Guide replacement failed",
        summary: "We couldn't automatically find another Guide.",
        detail: [r.student_first_name ?? r.bookings?.student_first_name ?? "Child", startsInLabel(start, nowMs)]
          .filter(Boolean)
          .join(" · "),
        bookingId: r.booking_id ?? null,
        href: r.booking_id ? `/dashboard/admin/study-halls/${r.booking_id}` : "/dashboard/admin/study-halls?view=attention",
        action: "Reassign",
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
        summary: "A parent dispute is waiting.",
        detail: "A parent dispute is waiting",
        bookingId: d.booking_id ?? null,
        href: "/dashboard/admin/finance",
        action: "Review",
      }),
    );
  }

  for (const a of pendingApplicants) {
    items.push(
      item({
        id: `applicant:${a.profile_id}`,
        kind: "applicant",
        title: "Guide application waiting",
        summary: "A Guide application is waiting for a decision.",
        detail: a.display_name ?? a.profiles?.display_name ?? "Applicant",
        href: "/dashboard/admin/guides",
        action: "Review application",
      }),
    );
  }

  return items;
}

/**
 * Group per-Study-Hall issues so a manager sees every current reason, not a
 * single meaningless "Needs attention" label.
 */
export function presentNeedsAttention(items = []) {
  const presented = [];
  const seenBookings = new Set();
  for (const entry of items) {
    if (!entry.bookingId) {
      presented.push({
        id: entry.id,
        bookingId: null,
        href: entry.href,
        action: entry.action,
        title: entry.title,
        summary: entry.summary ?? "",
        detail: entry.detail ?? "",
        reasons: [entry.title],
        issueCount: 1,
        urgent: entry.kind === "call_parent" || entry.kind === "no_join" || entry.kind === "coverage",
      });
      continue;
    }
    if (seenBookings.has(entry.bookingId)) continue;
    seenBookings.add(entry.bookingId);
    const group = items.filter((i) => i.bookingId === entry.bookingId);
    presented.push({
      id: `booking:${entry.bookingId}`,
      bookingId: entry.bookingId,
      href: group[0].href,
      action: group[0].action,
      title: group.length === 1 ? group[0].title : `${group.length} issues`,
      summary: group.length === 1 ? (group[0].summary ?? "") : "",
      detail: group[0].detail ?? "",
      reasons: group.map((i) => i.title),
      issueCount: group.length,
      urgent: group.some((i) => ["call_parent", "no_join", "coverage", "needs_guide"].includes(i.kind)),
    });
  }
  return presented;
}

export function comingUpBookings(bookings, { presenceByBooking = {}, nowMs = Date.now(), limit = 8 } = {}) {
  return bookings
    .filter((b) => {
      if (!b.scheduled_start) return false;
      if (isStudyHallLive(b, presenceByBooking[b.id], nowMs)) return true;
      if (!isOpenStudyHall(b.status)) return false;
      return new Date(b.scheduled_start).getTime() >= nowMs - 60_000;
    })
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
    .slice(0, limit)
    .map((b) => {
      const issues = b.issues ?? currentStudyHallIssues(b, { presence: presenceByBooking[b.id], nowMs });
      return {
        ...b,
        issues,
        statusLayer: managementOperationalStatus(b, {
          presence: presenceByBooking[b.id],
          nowMs,
          issues,
        }),
      };
    });
}
