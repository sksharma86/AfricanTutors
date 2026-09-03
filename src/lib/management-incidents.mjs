/**
 * Management Incident History — derived from authoritative operational records.
 * Does not persist a second incident table. Does not change attendance,
 * coverage, protection, booking, payment, or notification engines.
 */

import {
  complimentaryHourReference,
  currentAssignmentForBooking,
  hasCurrentConfirmedCoverage,
  isAtCriticalWindow,
  isCustomerProtectedAssignment,
} from "./guide-attendance.mjs";
import { bookingChildNames } from "./household-children.mjs";
import { NOTIFICATION_EVENTS } from "./notifications/events.mjs";

export const INCIDENT_STATUSES = Object.freeze(["open", "resolved"]);

export const INCIDENT_TYPES = Object.freeze({
  confirmation_missed: "Guide confirmation missed",
  emergency_search: "Emergency replacement",
  emergency_replaced: "Emergency replacement succeeded",
  emergency_failed: "Emergency replacement failed",
  no_coverage: "No Guide coverage",
  operational_emergency: "T-10 operational emergency",
  customer_protected: "Customer protected",
  coverage_cancelled: "Study Hall cancelled — coverage",
  notification_failed: "Notification failed",
});

export const RESOLUTION_TYPES = Object.freeze({
  guide_replaced: "Guide replaced",
  customer_protected: "Customer protected",
  cancelled: "Cancelled",
  manager_resolved: "Resolved by manager",
  self_recovered: "Resolved automatically",
});

export const RESOLUTION_SOURCES = Object.freeze({
  system: "system",
  manager: "manager",
});

export const RESOLUTION_STATUS_LABEL = Object.freeze({
  unresolved: "Unresolved",
  needs_follow_up: "Needs follow-up",
  customer_protected: "Customer protected",
  guide_replaced: "Guide replaced",
  cancelled: "Cancelled",
  manager_resolved: "Resolved by manager",
  resolved_automatically: "Resolved automatically",
});

export const INCIDENT_AUDIT_ACTIONS = Object.freeze([
  "emergency_coverage_search_opened",
  "emergency_coverage_claimed",
  "guide_customer_protected",
]);

/** Failed deliveries that belong on a coverage timeline when present. */
export const COVERAGE_EMAIL_TYPES = Object.freeze([
  NOTIFICATION_EVENTS.GUIDE_ATTENDANCE_REQUEST,
  NOTIFICATION_EVENTS.GUIDE_CONFIRMATION_MISSED,
  NOTIFICATION_EVENTS.GUIDE_OPEN_COVERAGE,
  NOTIFICATION_EVENTS.GUIDE_ATTENDANCE_CRITICAL,
  NOTIFICATION_EVENTS.COVERAGE_CANCELLATION,
  NOTIFICATION_EVENTS.COVERAGE_FAILURE_PROTECTION,
  NOTIFICATION_EVENTS.GUIDE_REASSIGNMENT_FAILED,
]);

/** Failed deliveries that can stand alone as incidents when no coverage story exists. */
export const STANDALONE_NOTIFY_TYPES = Object.freeze([
  NOTIFICATION_EVENTS.COVERAGE_FAILURE_PROTECTION,
  NOTIFICATION_EVENTS.COVERAGE_CANCELLATION,
  NOTIFICATION_EVENTS.GUIDE_REASSIGNMENT_FAILED,
  NOTIFICATION_EVENTS.GUIDE_ATTENDANCE_CRITICAL,
  NOTIFICATION_EVENTS.CALL_PARENT_FAILURE,
]);

const PARENT_IMPACT_EMAIL_TYPES = new Set([
  NOTIFICATION_EVENTS.COVERAGE_CANCELLATION,
  NOTIFICATION_EVENTS.COVERAGE_FAILURE_PROTECTION,
  NOTIFICATION_EVENTS.GUIDE_REASSIGNMENT_FAILED,
]);

const HISTORICAL_ATTENTION_KINDS = new Set(["guide_customer_protected", "guide_coverage_restored"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isActionableAttentionIssue(issue) {
  if (!issue) return false;
  if (issue.severity === "resolved") return false;
  if (HISTORICAL_ATTENTION_KINDS.has(issue.kind)) return false;
  return true;
}

export function coverageIncidentId(bookingId) {
  return `coverage-${bookingId}`;
}

export function notifyIncidentId(deliveryId) {
  return `notify-${deliveryId}`;
}

export function parseIncidentId(raw) {
  const id = String(raw ?? "");
  if (id.startsWith("coverage-")) {
    const bookingId = id.slice("coverage-".length);
    return UUID_RE.test(bookingId) ? { kind: "coverage", bookingId, deliveryId: null } : null;
  }
  if (id.startsWith("notify-")) {
    const deliveryId = id.slice("notify-".length);
    return UUID_RE.test(deliveryId) ? { kind: "notify", bookingId: null, deliveryId } : null;
  }
  return null;
}

export function incidentHref(id) {
  return `/dashboard/admin/incidents/${id}`;
}

export function isIncidentAssignment(assignment) {
  if (!assignment) return false;
  if (assignment.status === "missed") return true;
  if (assignment.source === "emergency") return true;
  if (isCustomerProtectedAssignment(assignment)) return true;
  if (assignment.critical_at) return true;
  if (assignment.status === "awaiting" && (assignment.source === "replacement" || assignment.source === "short_notice")) {
    return true;
  }
  if (assignment.resolution === "reassigned" || assignment.resolution === "cancelled_coverage") return true;
  return false;
}

export function isIncidentAudit(row) {
  return Boolean(row?.action && INCIDENT_AUDIT_ACTIONS.includes(row.action));
}

export function isStandaloneNotifyFailure(delivery) {
  if (!delivery || delivery.status !== "failed") return false;
  return STANDALONE_NOTIFY_TYPES.includes(delivery.notification_type);
}

export function isComplimentaryRecovery(row, bookingId) {
  if (!row) return false;
  if (row.reference && String(row.reference).startsWith("comp-hour:")) return true;
  if (bookingId && row.reference === complimentaryHourReference(bookingId)) return true;
  return /complimentary service-recovery hour/i.test(String(row.reason ?? ""));
}

function ms(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function earliestIso(...values) {
  const times = values.map(ms).filter((t) => t != null);
  if (!times.length) return null;
  return new Date(Math.min(...times)).toISOString();
}

function latestIso(...values) {
  const times = values.map(ms).filter((t) => t != null);
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

function guideName(tutorId, guideNames = {}, fallback = null) {
  if (tutorId && guideNames[tutorId]) return guideNames[tutorId];
  return fallback ?? null;
}

function offerCount(offers = []) {
  return (offers ?? []).length;
}

function claimedOffer(offers = []) {
  return (offers ?? []).find((o) => o.status === "claimed" || o.claimed_at) ?? null;
}

function openOfferCount(offers = []) {
  return (offers ?? []).filter((o) => o.status === "open").length;
}

export function bookingHasCoverageIncident({ booking, assignments = [], offers = [], auditLogs = [], complimentary = [] } = {}) {
  if ((assignments ?? []).some(isIncidentAssignment)) return true;
  if ((offers ?? []).length) return true;
  if ((auditLogs ?? []).some(isIncidentAudit)) return true;
  if ((complimentary ?? []).some((row) => isComplimentaryRecovery(row, booking?.id))) return true;
  return false;
}

function classifyCoverage({ booking, assignments, offers, nowMs }) {
  const missed = (assignments ?? []).filter((a) => a.status === "missed");
  const emergencyConfirmed = (assignments ?? []).find((a) => a.source === "emergency" && a.status === "confirmed");
  const protectedRow = (assignments ?? []).find(isCustomerProtectedAssignment);
  const current = currentAssignmentForBooking(assignments, booking);
  const claimed = claimedOffer(offers);
  const openOffers = openOfferCount(offers);
  const searchOpened = (offers ?? []).length > 0;

  if (protectedRow) {
    return {
      status: "resolved",
      resolution_type: "customer_protected",
      resolution_source: "system",
      resolved_at: protectedRow.customer_protected_at ?? protectedRow.resolved_at ?? booking?.cancelled_at ?? null,
      type: "customer_protected",
    };
  }

  if (emergencyConfirmed && (booking?.status !== "cancelled" || hasCurrentConfirmedCoverage(booking, current))) {
    if (hasCurrentConfirmedCoverage(booking, current) || emergencyConfirmed.tutor_id === booking?.tutor_id) {
      return {
        status: "resolved",
        resolution_type: "guide_replaced",
        resolution_source: "system",
        resolved_at: emergencyConfirmed.confirmed_at ?? claimed?.claimed_at ?? null,
        type: "emergency_replaced",
      };
    }
  }

  if (hasCurrentConfirmedCoverage(booking, current) && (missed.length || searchOpened || claimed)) {
    const replaced = current?.source === "emergency" || current?.source === "replacement" || current?.source === "short_notice";
    return {
      status: "resolved",
      resolution_type: replaced ? "guide_replaced" : "self_recovered",
      resolution_source: "system",
      resolved_at: current?.confirmed_at ?? claimed?.claimed_at ?? null,
      type: replaced ? "emergency_replaced" : "confirmation_missed",
    };
  }

  if (booking?.status === "cancelled" && (missed.length || searchOpened || protectedRow)) {
    return {
      status: "resolved",
      resolution_type: "cancelled",
      resolution_source: "system",
      resolved_at: booking.cancelled_at ?? missed[0]?.resolved_at ?? null,
      type: "coverage_cancelled",
    };
  }

  if (booking?.status === "completed" && missed.length) {
    return {
      status: "resolved",
      resolution_type: "self_recovered",
      resolution_source: "system",
      resolved_at: booking.scheduled_end ?? booking.cancelled_at ?? null,
      type: "confirmation_missed",
    };
  }

  const persistMiss = missed.length > 0 || current?.status === "missed";
  const critical = persistMiss && booking?.scheduled_start && isAtCriticalWindow(booking.scheduled_start, nowMs);
  if (critical) {
    return {
      status: "open",
      resolution_type: null,
      resolution_source: null,
      resolved_at: null,
      type: "operational_emergency",
    };
  }

  if (searchOpened && openOffers === 0 && !claimed && persistMiss) {
    return {
      status: "open",
      resolution_type: null,
      resolution_source: null,
      resolved_at: null,
      type: "emergency_failed",
    };
  }

  if (openOffers > 0 || (searchOpened && persistMiss)) {
    return {
      status: "open",
      resolution_type: null,
      resolution_source: null,
      resolved_at: null,
      type: "emergency_search",
    };
  }

  if (current?.status === "awaiting" && (current.source === "replacement" || current.source === "short_notice")) {
    return {
      status: "open",
      resolution_type: null,
      resolution_source: null,
      resolved_at: null,
      type: "confirmation_missed",
    };
  }

  return {
    status: "open",
    resolution_type: null,
    resolution_source: null,
    resolved_at: null,
    type: persistMiss ? "confirmation_missed" : "no_coverage",
  };
}

function resolutionStatusLabel({ status, resolution_type, scheduledStart, nowMs }) {
  if (status === "resolved") {
    if (resolution_type === "customer_protected") return RESOLUTION_STATUS_LABEL.customer_protected;
    if (resolution_type === "guide_replaced") return RESOLUTION_STATUS_LABEL.guide_replaced;
    if (resolution_type === "cancelled") return RESOLUTION_STATUS_LABEL.cancelled;
    if (resolution_type === "manager_resolved") return RESOLUTION_STATUS_LABEL.manager_resolved;
    return RESOLUTION_STATUS_LABEL.resolved_automatically;
  }
  const start = ms(scheduledStart);
  if (start != null && nowMs >= start) return RESOLUTION_STATUS_LABEL.needs_follow_up;
  return RESOLUTION_STATUS_LABEL.unresolved;
}

function severityFor(type, status) {
  if (type === "operational_emergency" || type === "emergency_failed" || type === "no_coverage") return "critical";
  if (status === "resolved" && (type === "emergency_replaced" || type === "customer_protected")) return "medium";
  return "high";
}

function coverageDescription({ type, resolution_type, booking, offers, complimentary, childName, missedGuide, replacementGuide }) {
  if (resolution_type === "customer_protected" || type === "customer_protected") {
    const hour = (complimentary ?? []).some((row) => isComplimentaryRecovery(row, booking?.id));
    return hour
      ? "Booking restored · +1 complimentary hour issued"
      : "Study Hall cancelled · customer protected";
  }
  if (resolution_type === "guide_replaced" || type === "emergency_replaced") {
    return replacementGuide ? `${replacementGuide} accepted coverage` : "Automatic replacement accepted";
  }
  if (type === "operational_emergency") return "Study Hall starts within 10 minutes and coverage is not confirmed";
  if (type === "emergency_failed") return "No replacement Guide secured";
  if (type === "emergency_search") {
    const n = offerCount(offers);
    return n === 1 ? "Replacement search active · 1 eligible Guide offered" : `Replacement search active · ${n} eligible Guides offered`;
  }
  if (type === "coverage_cancelled") return "Study Hall cancelled after coverage failure";
  if (missedGuide) return `${childName} · ${missedGuide} · confirmation deadline missed`;
  return "Confirmation deadline missed";
}

function parentNotificationSummary(emails = []) {
  const impact = (emails ?? []).filter((e) => PARENT_IMPACT_EMAIL_TYPES.has(e.notification_type));
  const sent = impact.find((e) => e.status === "sent" || e.status === "delivered");
  const failed = impact.find((e) => e.status === "failed");
  if (sent) return { kind: "sent", at: sent.updated_at ?? sent.created_at ?? null, type: sent.notification_type };
  if (failed) return { kind: "failed", at: failed.updated_at ?? failed.created_at ?? null, type: failed.notification_type };
  return { kind: "none_in_records", at: null, type: null };
}

function customerImpactSummary({ resolution_type, complimentary, parentNotify, booking }) {
  if (resolution_type === "customer_protected") {
    const hour = (complimentary ?? []).some((row) => isComplimentaryRecovery(row, booking?.id));
    return hour ? "Customer protected · booking restored · complimentary hour issued" : "Customer protected";
  }
  if (resolution_type === "cancelled") return "Study Hall cancelled";
  if (parentNotify.kind === "sent") return "Parent notified of coverage failure";
  if (resolution_type === "guide_replaced") return "None — internal replacement succeeded";
  return "None recorded";
}

function pushEvent(events, at, title, detail) {
  if (!at || !title) return;
  events.push({ at, title, detail: detail ?? null });
}

export function incidentTimeline(incident) {
  return [...(incident?.timeline ?? [])].sort((a, b) => (ms(a.at) ?? 0) - (ms(b.at) ?? 0));
}

function buildCoverageTimeline({
  booking,
  assignments = [],
  offers = [],
  auditLogs = [],
  emails = [],
  complimentary = [],
  guideNames = {},
  classification,
}) {
  const events = [];
  const original = [...assignments].sort((a, b) => (ms(a.created_at ?? a.requested_at) ?? 0) - (ms(b.created_at ?? b.requested_at) ?? 0))[0];
  for (const a of assignments) {
    const name = guideName(a.tutor_id, guideNames);
    if (a.requested_at) {
      pushEvent(
        events,
        a.requested_at,
        a.source === "emergency"
          ? "Emergency coverage assignment opened"
          : a.source === "replacement" || a.source === "short_notice"
            ? "Replacement confirmation requested"
            : "Attendance confirmation requested",
        name ? `Guide: ${name}` : null,
      );
    }
    if (a.missed_at) {
      pushEvent(events, a.missed_at, "Confirmation deadline missed", name ? `Guide: ${name}` : null);
    } else if (a.status === "missed" && a.deadline_at && !a.missed_at) {
      pushEvent(events, a.deadline_at, "Confirmation deadline missed", name ? `Guide: ${name}` : null);
    }
    if (a.critical_at) {
      pushEvent(events, a.critical_at, "T-10 operational emergency", "No confirmed Guide coverage");
    }
    if (a.source === "emergency" && a.status === "confirmed" && a.confirmed_at) {
      pushEvent(events, a.confirmed_at, "Replacement Guide assigned and attendance confirmed", name ? `Guide: ${name}` : null);
    } else if (a.status === "confirmed" && a.confirmed_at && a.source !== "t30") {
      pushEvent(events, a.confirmed_at, "Replacement attendance confirmed", name ? `Guide: ${name}` : null);
    }
    if (a.customer_protected_at) {
      pushEvent(events, a.customer_protected_at, "Customer protection triggered", null);
    }
  }

  const firstOffer = [...offers].sort((a, b) => (ms(a.created_at) ?? 0) - (ms(b.created_at) ?? 0))[0];
  if (firstOffer?.created_at) {
    const n = offerCount(offers);
    pushEvent(
      events,
      firstOffer.created_at,
      "Emergency coverage opened",
      n === 1 ? "1 eligible Guide offered" : `${n} eligible Guides offered`,
    );
  }

  const claimed = claimedOffer(offers);
  if (claimed?.claimed_at) {
    pushEvent(
      events,
      claimed.claimed_at,
      "Guide accepted coverage",
      guideName(claimed.tutor_id, guideNames) ? `Guide: ${guideName(claimed.tutor_id, guideNames)}` : null,
    );
  }

  for (const log of auditLogs ?? []) {
    if (!isIncidentAudit(log) || !log.created_at) continue;
    if (log.action === "emergency_coverage_search_opened") {
      if (!firstOffer?.created_at) pushEvent(events, log.created_at, "Emergency coverage opened", null);
    } else if (log.action === "emergency_coverage_claimed") {
      if (!claimed?.claimed_at) pushEvent(events, log.created_at, "Guide accepted coverage", null);
    } else if (log.action === "guide_customer_protected") {
      pushEvent(events, log.created_at, "Customer protection recorded", "Booking restored");
    }
  }

  for (const row of complimentary ?? []) {
    if (!isComplimentaryRecovery(row, booking?.id) || !row.created_at) continue;
    const mins = Number(row.minutes_delta) || 60;
    const hours = mins / 60;
    pushEvent(
      events,
      row.created_at,
      hours === 1 ? "1 complimentary hour issued" : `${hours} complimentary hours issued`,
      null,
    );
  }

  for (const e of emails ?? []) {
    if (!COVERAGE_EMAIL_TYPES.includes(e.notification_type)) continue;
    const at = e.updated_at ?? e.created_at;
    if (!at) continue;
    if (e.notification_type === NOTIFICATION_EVENTS.COVERAGE_FAILURE_PROTECTION) {
      pushEvent(events, at, e.status === "failed" ? "Parent notification failed" : "Parent notified", null);
    } else if (e.notification_type === NOTIFICATION_EVENTS.COVERAGE_CANCELLATION) {
      pushEvent(events, at, e.status === "failed" ? "Cancellation notice failed" : "Parent notified of cancellation", null);
    } else if (e.status === "failed" && e.notification_type === NOTIFICATION_EVENTS.GUIDE_OPEN_COVERAGE) {
      pushEvent(events, at, "Emergency coverage email failed", e.to_email ?? null);
    } else if (e.status === "failed" && e.notification_type === NOTIFICATION_EVENTS.GUIDE_ATTENDANCE_CRITICAL) {
      pushEvent(events, at, "T-10 operational email failed", null);
    }
  }

  if (classification.resolved_at && classification.status === "resolved") {
    const already = events.some((ev) => ev.at === classification.resolved_at && /resolved|protected|confirmed|issued/i.test(ev.title));
    if (!already) {
      pushEvent(
        events,
        classification.resolved_at,
        classification.resolution_type === "customer_protected"
          ? "Incident automatically resolved"
          : classification.resolution_type === "guide_replaced"
            ? "Incident automatically resolved"
            : "Incident resolved",
        RESOLUTION_TYPES[classification.resolution_type] ?? null,
      );
    }
  }

  if (original && !events.length && original.created_at) {
    pushEvent(events, original.created_at, "Operational exception recorded", null);
  }

  return incidentTimeline({ timeline: events });
}

export function buildCoverageIncident({
  booking,
  assignments = [],
  offers = [],
  auditLogs = [],
  emails = [],
  complimentary = [],
  guideNames = {},
  nowMs = Date.now(),
} = {}) {
  if (!booking?.id) return null;
  if (!bookingHasCoverageIncident({ booking, assignments, offers, auditLogs, complimentary })) return null;

  const classification = classifyCoverage({ booking, assignments, offers, nowMs });
  const missed = (assignments ?? []).filter((a) => a.status === "missed");
  const originalMiss = missed[0] ?? assignments.find((a) => a.source === "t30") ?? assignments[0] ?? null;
  const replacement = (assignments ?? []).find((a) => a.source === "emergency" && a.status === "confirmed")
    ?? claimedOffer(offers);
  const childName = bookingChildNames(booking, "Child");
  const missedGuide = guideName(originalMiss?.tutor_id, guideNames, booking.tutor_display_name);
  const replacementGuide = guideName(replacement?.tutor_id, guideNames);
  const openedAt = earliestIso(
    originalMiss?.requested_at,
    originalMiss?.missed_at,
    originalMiss?.deadline_at,
    originalMiss?.created_at,
    offers[0]?.created_at,
    ...(auditLogs ?? []).map((l) => l.created_at),
  );
  const parentNotify = parentNotificationSummary(emails);
  const hourIssued = (complimentary ?? []).some((row) => isComplimentaryRecovery(row, booking.id));
  const customerImpacting =
    classification.resolution_type === "customer_protected" ||
    classification.resolution_type === "cancelled" ||
    hourIssued ||
    parentNotify.kind === "sent" ||
    parentNotify.kind === "failed";

  const displayGuide =
    classification.resolution_type === "guide_replaced" ? (replacementGuide ?? booking.tutor_display_name) : missedGuide;

  return {
    id: coverageIncidentId(booking.id),
    kind: "coverage",
    bookingId: booking.id,
    type: classification.type,
    typeLabel: INCIDENT_TYPES[classification.type] ?? classification.type,
    status: classification.status,
    severity: severityFor(classification.type, classification.status),
    resolution_type: classification.resolution_type,
    resolution_source: classification.resolution_source,
    resolutionLabel: resolutionStatusLabel({
      status: classification.status,
      resolution_type: classification.resolution_type,
      scheduledStart: booking.scheduled_start,
      nowMs,
    }),
    opened_at: openedAt,
    resolved_at: classification.resolved_at,
    occurredAt: classification.resolved_at ?? openedAt ?? booking.scheduled_start ?? null,
    childName,
    parentName: booking.parent_name ?? null,
    guideName: displayGuide ?? booking.tutor_display_name ?? null,
    guideId: replacement?.tutor_id ?? originalMiss?.tutor_id ?? booking.tutor_id ?? null,
    missedGuideId: originalMiss?.tutor_id ?? null,
    scheduledStart: booking.scheduled_start ?? null,
    scheduledEnd: booking.scheduled_end ?? null,
    description: coverageDescription({
      type: classification.type,
      resolution_type: classification.resolution_type,
      booking,
      offers,
      complimentary,
      childName,
      missedGuide,
      replacementGuide,
    }),
    customerImpacting,
    complementaryHour: hourIssued,
    parentNotification: parentNotify,
    customerImpact: customerImpactSummary({
      resolution_type: classification.resolution_type,
      complimentary,
      parentNotify,
      booking,
    }),
    href: incidentHref(coverageIncidentId(booking.id)),
    studyHallHref: `/dashboard/admin/study-halls/${booking.id}`,
    timeline: buildCoverageTimeline({
      booking,
      assignments,
      offers,
      auditLogs,
      emails,
      complimentary,
      guideNames,
      classification,
    }),
  };
}

export function buildNotifyIncident({ delivery, booking = null, nowMs = Date.now() } = {}) {
  if (!isStandaloneNotifyFailure(delivery) || !delivery.id) return null;
  const childName = booking ? bookingChildNames(booking, "Child") : "Customer";
  const at = delivery.updated_at ?? delivery.created_at ?? null;
  return {
    id: notifyIncidentId(delivery.id),
    kind: "notify",
    bookingId: delivery.booking_id ?? booking?.id ?? null,
    type: "notification_failed",
    typeLabel: INCIDENT_TYPES.notification_failed,
    status: "open",
    severity: "high",
    resolution_type: null,
    resolution_source: null,
    resolutionLabel: RESOLUTION_STATUS_LABEL.unresolved,
    opened_at: at,
    resolved_at: null,
    occurredAt: at,
    childName,
    parentName: booking?.parent_name ?? null,
    guideName: booking?.tutor_display_name ?? null,
    guideId: booking?.tutor_id ?? null,
    missedGuideId: booking?.tutor_id ?? null,
    scheduledStart: booking?.scheduled_start ?? null,
    scheduledEnd: booking?.scheduled_end ?? null,
    description: `${delivery.notification_type?.replace(/_/g, " ") ?? "Notification"} did not send`,
    customerImpacting: PARENT_IMPACT_EMAIL_TYPES.has(delivery.notification_type),
    complementaryHour: false,
    parentNotification: { kind: "failed", at, type: delivery.notification_type },
    customerImpact: "Notification to the parent did not send",
    href: incidentHref(notifyIncidentId(delivery.id)),
    studyHallHref: delivery.booking_id ? `/dashboard/admin/study-halls/${delivery.booking_id}` : "/dashboard/admin/incidents",
    timeline: at
      ? [{ at, title: "Operational notification failed", detail: delivery.to_email ?? delivery.notification_type ?? null }]
      : [],
    nowMs,
  };
}

export function collectOperationalIncidents({
  bookings = [],
  assignmentsByBooking = {},
  offersByBooking = {},
  auditByBooking = {},
  emailsByBooking = {},
  complimentaryByBooking = {},
  standaloneNotify = [],
  guideNames = {},
  nowMs = Date.now(),
} = {}) {
  const incidents = [];
  const coverageBookingIds = new Set();

  for (const booking of bookings ?? []) {
    if (!booking?.id) continue;
    const incident = buildCoverageIncident({
      booking,
      assignments: assignmentsByBooking[booking.id] ?? [],
      offers: offersByBooking[booking.id] ?? [],
      auditLogs: auditByBooking[booking.id] ?? [],
      emails: emailsByBooking[booking.id] ?? [],
      complimentary: complimentaryByBooking[booking.id] ?? [],
      guideNames,
      nowMs,
    });
    if (!incident) continue;
    coverageBookingIds.add(booking.id);
    incidents.push(incident);
  }

  const bookingMap = new Map((bookings ?? []).map((b) => [b.id, b]));
  for (const delivery of standaloneNotify ?? []) {
    if (delivery.booking_id && coverageBookingIds.has(delivery.booking_id)) continue;
    const incident = buildNotifyIncident({
      delivery,
      booking: delivery.booking_id ? bookingMap.get(delivery.booking_id) ?? null : null,
      nowMs,
    });
    if (incident) incidents.push(incident);
  }

  return incidents.sort((a, b) => (ms(b.occurredAt) ?? 0) - (ms(a.occurredAt) ?? 0));
}

export function filterIncidents(
  incidents = [],
  { status = "all", type = "all", severity = "all", dateFrom = "", dateTo = "", guideId = "", query = "", tz = "UTC" } = {},
) {
  const q = String(query ?? "").trim().toLowerCase();
  return (incidents ?? []).filter((row) => {
    if (status && status !== "all" && row.status !== status) return false;
    if (type && type !== "all" && row.type !== type) return false;
    if (severity && severity !== "all" && row.severity !== severity) return false;
    if (guideId && guideId !== "all" && row.guideId !== guideId && row.missedGuideId !== guideId) return false;
    if (dateFrom || dateTo) {
      const at = row.occurredAt ?? row.opened_at ?? row.scheduledStart;
      if (!at) return false;
      let day;
      try {
        day = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz || "UTC",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(at));
      } catch {
        day = String(at).slice(0, 10);
      }
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
    }
    if (q) {
      const hay = [row.childName, row.parentName, row.guideName, row.description, row.typeLabel, row.resolutionLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function summarizeIncidents(incidents = []) {
  const list = incidents ?? [];
  return {
    total: list.length,
    resolvedAutomatically: list.filter((i) => i.status === "resolved" && i.resolution_source === "system").length,
    managerIntervention: list.filter((i) => i.resolution_source === "manager").length,
    customerImpacting: list.filter((i) => i.customerImpacting).length,
    open: list.filter((i) => i.status === "open").length,
  };
}

export function incidentGuideOptions(incidents = []) {
  const seen = new Map();
  for (const row of incidents ?? []) {
    if (row.guideId && row.guideName && !seen.has(row.guideId)) seen.set(row.guideId, row.guideName);
    if (row.missedGuideId && row.guideName && !seen.has(row.missedGuideId)) {
      seen.set(row.missedGuideId, row.guideName);
    }
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Routine successful activity must never become an incident.
 * Used by tests and as a documented contract.
 */
export function isRoutineSuccessfulActivity({ booking, assignment = null, payment = null } = {}) {
  if (payment?.status === "succeeded" && !assignment) return true;
  if (!assignment) {
    return booking?.status === "confirmed" || booking?.status === "pending";
  }
  return (
    assignment.status === "confirmed" &&
    assignment.source === "t30" &&
    !assignment.missed_at &&
    !isCustomerProtectedAssignment(assignment) &&
    assignment.source !== "emergency"
  );
}
