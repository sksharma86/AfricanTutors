import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  collectNeedsAttention,
  currentStudyHallIssues,
} from "../src/lib/management-ops.mjs";
import { managementAttendanceIssue } from "../src/lib/guide-attendance.mjs";
import {
  buildCoverageIncident,
  collectOperationalIncidents,
  filterIncidents,
  isActionableAttentionIssue,
  isRoutineSuccessfulActivity,
  parseIncidentId,
  summarizeIncidents,
} from "../src/lib/management-incidents.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const t = (hour, minute) => `2026-08-27T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
const start = t(18, 0);
const nowBefore = Date.parse(t(17, 30));
const nowCritical = Date.parse(t(17, 52));
const nowAfter = Date.parse(t(19, 10));

const jay = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "cancelled",
  cancelled_at: t(17, 58),
  tutor_id: "guide-a",
  tutor_display_name: "Test Tutor 1",
  student_first_name: "Jay",
  parent_name: "Parent J",
  scheduled_start: start,
  scheduled_end: t(19, 0),
  payment_status: "paid",
};

const maddi = {
  ...jay,
  id: "22222222-2222-4222-8222-222222222222",
  student_first_name: "Maddi",
};

const protectedAssignment = {
  id: "a-jay",
  booking_id: jay.id,
  tutor_id: "guide-a",
  source: "t30",
  status: "missed",
  requested_at: t(17, 30),
  deadline_at: t(17, 40),
  missed_at: t(17, 40),
  resolution: "customer_protected",
  customer_protected_at: t(17, 58),
  resolved_at: t(17, 58),
  created_at: t(17, 30),
};

function openMissedBooking(id = "33333333-3333-4333-8333-333333333333") {
  return {
    id,
    status: "confirmed",
    tutor_id: "guide-a",
    tutor_display_name: "Test Tutor 1",
    student_first_name: "Sam",
    scheduled_start: start,
    scheduled_end: t(19, 0),
    payment_status: "paid",
  };
}

const openMissedAssignment = {
  id: "a-open",
  booking_id: "33333333-3333-4333-8333-333333333333",
  tutor_id: "guide-a",
  source: "t30",
  status: "missed",
  requested_at: t(17, 30),
  deadline_at: t(17, 40),
  missed_at: t(17, 40),
  created_at: t(17, 30),
};

describe("Needs Attention — only current actionable exceptions", () => {
  it("open missed confirmation appears in Needs Attention", () => {
    const items = collectNeedsAttention({
      bookings: [openMissedBooking()],
      attendanceByBooking: { [openMissedAssignment.booking_id]: openMissedAssignment },
      assignmentsLoaded: true,
      nowMs: nowBefore,
    });
    assert.equal(items.some((i) => i.kind === "guide_confirm_missed"), true);
    assert.equal(items.some((i) => i.title === "Customer protected"), false);
  });

  it("automatically resolved customer protection does not remain in Needs Attention", () => {
    const issue = managementAttendanceIssue({
      booking: jay,
      assignment: protectedAssignment,
      nowMs: nowAfter,
    });
    assert.equal(issue.kind, "guide_customer_protected");
    assert.equal(isActionableAttentionIssue(issue), false);
    const live = currentStudyHallIssues(jay, {
      attendance: protectedAssignment,
      assignmentsLoaded: true,
      nowMs: nowAfter,
    });
    assert.equal(live.some((i) => i.kind === "guide_customer_protected"), false);
    const items = collectNeedsAttention({
      bookings: [jay, maddi],
      attendanceByBooking: {
        [jay.id]: protectedAssignment,
        [maddi.id]: { ...protectedAssignment, id: "a-maddi", booking_id: maddi.id },
      },
      assignmentsLoaded: true,
      nowMs: nowAfter,
    });
    assert.equal(items.length, 0);
  });

  it("emergency replacement success leaves Needs Attention", () => {
    const booking = {
      ...openMissedBooking("44444444-4444-4444-8444-444444444444"),
      tutor_id: "guide-b",
      tutor_display_name: "Guide B",
    };
    const current = {
      id: "a-emerg",
      booking_id: booking.id,
      tutor_id: "guide-b",
      source: "emergency",
      status: "confirmed",
      confirmed_at: t(17, 43),
    };
    const issues = currentStudyHallIssues(booking, {
      attendance: current,
      assignmentsLoaded: true,
      offerCount: 0,
      nowMs: nowBefore,
    });
    assert.deepEqual(issues, []);
    const items = collectNeedsAttention({
      bookings: [booking],
      attendanceByBooking: { [booking.id]: current },
      assignmentsLoaded: true,
      nowMs: nowBefore,
    });
    assert.equal(items.length, 0);
  });

  it("unresolved no-coverage emergency remains visible", () => {
    const booking = openMissedBooking();
    const items = collectNeedsAttention({
      bookings: [booking],
      attendanceByBooking: { [booking.id]: { ...openMissedAssignment, critical_at: t(17, 50) } },
      assignmentsLoaded: true,
      offerCountByBooking: { [booking.id]: 4 },
      nowMs: nowCritical,
    });
    assert.ok(items.some((i) => i.kind === "guide_confirm_critical" || i.kind === "guide_confirm_missed"));
    assert.ok(items.every((i) => i.kind !== "guide_customer_protected"));
  });
});

describe("Incident History — derivation and resolution", () => {
  it("resolved customer protection remains available in Incident History", () => {
    const incidents = collectOperationalIncidents({
      bookings: [jay],
      assignmentsByBooking: { [jay.id]: [protectedAssignment] },
      complimentaryByBooking: {
        [jay.id]: [
          {
            booking_id: jay.id,
            minutes_delta: 60,
            reference: `comp-hour:${jay.id}`,
            created_at: t(17, 58),
          },
        ],
      },
      emailsByBooking: {
        [jay.id]: [
          {
            notification_type: "coverage_failure_protection",
            status: "sent",
            updated_at: t(17, 58),
          },
        ],
      },
      nowMs: nowAfter,
    });
    assert.equal(incidents.length, 1);
    assert.equal(incidents[0].status, "resolved");
    assert.equal(incidents[0].resolution_type, "customer_protected");
    assert.equal(incidents[0].resolution_source, "system");
    assert.equal(incidents[0].type, "customer_protected");
    assert.match(incidents[0].description, /complimentary hour/i);
    assert.equal(incidents[0].customerImpacting, true);
    assert.ok(incidents[0].timeline.some((e) => /complimentary hour/i.test(e.title)));
    assert.ok(incidents[0].timeline.every((e) => e.at));
  });

  it("emergency replacement success resolves the associated incident", () => {
    const booking = {
      ...openMissedBooking("44444444-4444-4444-8444-444444444444"),
      tutor_id: "guide-b",
      tutor_display_name: "Guide B",
    };
    const assignments = [
      { ...openMissedAssignment, booking_id: booking.id, status: "missed" },
      {
        id: "a-emerg",
        booking_id: booking.id,
        tutor_id: "guide-b",
        source: "emergency",
        status: "confirmed",
        requested_at: t(17, 40),
        confirmed_at: t(17, 43),
        created_at: t(17, 40),
      },
    ];
    const offers = [
      { booking_id: booking.id, tutor_id: "guide-c", status: "closed", created_at: t(17, 40), closed_at: t(17, 43) },
      { booking_id: booking.id, tutor_id: "guide-b", status: "claimed", created_at: t(17, 40), claimed_at: t(17, 43) },
      { booking_id: booking.id, tutor_id: "guide-d", status: "closed", created_at: t(17, 40), closed_at: t(17, 43) },
      { booking_id: booking.id, tutor_id: "guide-e", status: "closed", created_at: t(17, 40), closed_at: t(17, 43) },
    ];
    const incident = buildCoverageIncident({
      booking,
      assignments,
      offers,
      guideNames: { "guide-a": "Test Tutor 1", "guide-b": "Guide B" },
      nowMs: nowBefore,
    });
    assert.equal(incident.status, "resolved");
    assert.equal(incident.resolution_type, "guide_replaced");
    assert.equal(incident.resolution_source, "system");
    assert.equal(incident.type, "emergency_replaced");
    assert.equal(incident.customerImpact.includes("None"), true);
    assert.ok(incident.timeline.some((e) => /Emergency coverage opened/.test(e.title)));
    assert.ok(incident.timeline.some((e) => /accepted coverage|attendance confirmed/.test(e.title)));
    const items = collectNeedsAttention({
      bookings: [booking],
      attendanceByBooking: { [booking.id]: assignments[1] },
      assignmentsLoaded: true,
      nowMs: nowBefore,
    });
    assert.equal(items.length, 0);
  });

  it("customer protection completion resolves the live alert but preserves history", () => {
    const live = collectNeedsAttention({
      bookings: [maddi],
      attendanceByBooking: { [maddi.id]: { ...protectedAssignment, booking_id: maddi.id } },
      assignmentsLoaded: true,
      nowMs: nowAfter,
    });
    const history = collectOperationalIncidents({
      bookings: [maddi],
      assignmentsByBooking: { [maddi.id]: [{ ...protectedAssignment, booking_id: maddi.id }] },
      nowMs: nowAfter,
    });
    assert.equal(live.length, 0);
    assert.equal(history.length, 1);
    assert.equal(history[0].resolutionLabel, "Customer protected");
  });

  it("unresolved no-coverage emergency remains an open incident", () => {
    const booking = openMissedBooking();
    const incident = buildCoverageIncident({
      booking,
      assignments: [{ ...openMissedAssignment, critical_at: t(17, 50) }],
      offers: [
        { booking_id: booking.id, status: "closed", created_at: t(17, 40), closed_at: t(17, 50), close_reason: "expired" },
      ],
      nowMs: nowCritical,
    });
    assert.equal(incident.status, "open");
    assert.ok(["operational_emergency", "emergency_failed", "emergency_search"].includes(incident.type));
  });

  it("Incident History filtering works", () => {
    const incidents = collectOperationalIncidents({
      bookings: [jay, openMissedBooking()],
      assignmentsByBooking: {
        [jay.id]: [protectedAssignment],
        [openMissedAssignment.booking_id]: [openMissedAssignment],
      },
      nowMs: nowBefore,
    });
    assert.equal(filterIncidents(incidents, { status: "resolved" }).length, 1);
    assert.equal(filterIncidents(incidents, { status: "open" }).length, 1);
    assert.equal(filterIncidents(incidents, { type: "customer_protected" }).length, 1);
    assert.equal(filterIncidents(incidents, { query: "jay" }).length, 1);
    assert.equal(filterIncidents(incidents, { query: "nobody" }).length, 0);
    assert.equal(filterIncidents(incidents, { dateFrom: "2026-08-27", dateTo: "2026-08-27", tz: "UTC" }).length, 2);
    const summary = summarizeIncidents(incidents);
    assert.equal(summary.total, 2);
    assert.equal(summary.resolvedAutomatically, 1);
    assert.equal(summary.open, 1);
  });

  it("existing historical incidents render safely with sparse records", () => {
    const sparse = buildCoverageIncident({
      booking: {
        id: "55555555-5555-4555-8555-555555555555",
        status: "cancelled",
        student_first_name: "Historical",
        tutor_display_name: "Old Guide",
      },
      assignments: [{ status: "missed", resolution: "customer_protected", booking_id: "55555555-5555-4555-8555-555555555555" }],
      nowMs: nowAfter,
    });
    assert.equal(sparse.status, "resolved");
    assert.equal(sparse.resolution_type, "customer_protected");
    assert.ok(Array.isArray(sparse.timeline));
    assert.ok(sparse.childName);
    assert.ok(sparse.description);
  });

  it("routine successful booking, confirmation, and payment do not pollute Incident History", () => {
    const booking = {
      id: "66666666-6666-4666-8666-666666666666",
      status: "confirmed",
      tutor_id: "guide-a",
      tutor_display_name: "Test Tutor 1",
      student_first_name: "Routine",
      scheduled_start: start,
      payment_status: "paid",
    };
    const assignment = {
      booking_id: booking.id,
      tutor_id: "guide-a",
      source: "t30",
      status: "confirmed",
      confirmed_at: t(17, 32),
    };
    assert.equal(isRoutineSuccessfulActivity({ booking, assignment, payment: { status: "succeeded" } }), true);
    const incidents = collectOperationalIncidents({
      bookings: [booking],
      assignmentsByBooking: { [booking.id]: [assignment] },
      nowMs: nowBefore,
    });
    assert.equal(incidents.length, 0);
  });
});

describe("Incident History — navigation and destination", () => {
  it("manager navigation to Incident History is a real authorized destination", () => {
    const nav = read("src/components/dashboard/dashboard-shell.tsx");
    const page = read("src/app/dashboard/admin/incidents/page.tsx");
    const detail = read("src/app/dashboard/admin/incidents/[incidentId]/page.tsx");
    const icons = read("src/components/dashboard/management-icons.tsx");
    assert.match(nav, /label: "Incident History"/);
    assert.match(nav, /href: "\/dashboard\/admin\/incidents"/);
    assert.doesNotMatch(nav, /Errors/);
    assert.match(page, /requireRole\("admin"/);
    assert.match(page, /Incident History/);
    assert.match(detail, /requireRole\("admin"/);
    assert.match(icons, /Incident History/);
    assert.equal(parseIncidentId(jay.id), null);
    assert.equal(parseIncidentId(`coverage-${jay.id}`)?.bookingId, jay.id);
  });

  it("does not introduce a competing incident table or alter coverage engines", () => {
    const lib = read("src/lib/management-incidents.mjs");
    assert.match(lib, /Does not persist a second incident table/);
    assert.doesNotMatch(lib, /create table|insert into public\.management_incidents/);
    assert.doesNotMatch(read("src/lib/guide-attendance.mjs"), /collectOperationalIncidents/);
    assert.doesNotMatch(read("src/lib/open-coverage.mjs"), /collectOperationalIncidents/);
  });
});
