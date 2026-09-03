import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  collectNeedsAttention,
  currentStudyHallIssues,
  isStudyHallLive,
  managementGreeting,
  managementOperationalStatus,
  matchesStudyHallSearch,
  presentNeedsAttention,
  studyHallViewMembership,
  uniqueAttentionDetail,
} from "../src/lib/management-ops.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const start = "2026-08-27T18:00:00.000Z";
const end = "2026-08-27T19:00:00.000Z";
const nowDuring = Date.parse("2026-08-27T18:20:00.000Z");
const nowBefore = Date.parse("2026-08-27T17:00:00.000Z");

describe("Management Control Center — operational status", () => {
  it("maps healthy confirmed sessions to Ready", () => {
    assert.equal(
      managementOperationalStatus(
        { status: "confirmed", tutor_id: "g1", tutor_display_name: "Chidi", scheduled_start: start, scheduled_end: end, payment_status: "paid" },
        { nowMs: nowBefore },
      ),
      "ready",
    );
  });

  it("does not label LIVE unless someone joined", () => {
    const booking = {
      status: "confirmed",
      tutor_id: "g1",
      scheduled_start: start,
      scheduled_end: end,
      payment_status: "paid",
    };
    assert.equal(isStudyHallLive(booking, null, nowDuring), false);
    assert.equal(managementOperationalStatus(booking, { nowMs: nowDuring }), "needs_attention");
    assert.equal(
      managementOperationalStatus(booking, {
        nowMs: nowDuring,
        presence: { student_first_joined_at: "2026-08-27T18:02:00.000Z" },
      }),
      "live",
    );
  });

  it("does not stay LIVE after everyone has left", () => {
    const booking = {
      status: "confirmed",
      tutor_id: "g1",
      scheduled_start: start,
      scheduled_end: end,
      payment_status: "paid",
    };
    assert.equal(
      isStudyHallLive(
        booking,
        {
          student_first_joined_at: "2026-08-27T18:02:00.000Z",
          student_last_seen_at: "2026-08-27T18:02:00.000Z",
          student_last_left_at: "2026-08-27T18:15:00.000Z",
        },
        nowDuring,
      ),
      false,
    );
    assert.equal(
      isStudyHallLive(
        booking,
        {
          student_first_joined_at: "2026-08-27T18:02:00.000Z",
          student_last_seen_at: "2026-08-27T18:18:00.000Z",
          student_last_left_at: "2026-08-27T18:15:00.000Z",
        },
        nowDuring,
      ),
      true,
    );
  });

  it("maps finished and cancelled database states without rewriting them", () => {
    assert.equal(managementOperationalStatus({ status: "completed" }), "completed");
    assert.equal(managementOperationalStatus({ status: "no_show" }), "completed");
    assert.equal(managementOperationalStatus({ status: "cancelled" }), "cancelled");
    assert.equal(managementOperationalStatus({ status: "expired" }), "cancelled");
  });

  it("needs a Guide when coverage is missing", () => {
    assert.equal(
      managementOperationalStatus(
        { status: "confirmed", tutor_id: null, tutor_display_name: null, scheduled_start: start, payment_status: "paid" },
        { nowMs: nowBefore },
      ),
      "needs_attention",
    );
  });
});

describe("Management Control Center — Needs Attention", () => {
  it("shows the healthy empty state inputs as an empty list", () => {
    assert.deepEqual(collectNeedsAttention({}), []);
  });

  it("aggregates current actionable exceptions with explicit reasons", () => {
    const recentEnd = "2026-08-25T18:00:00.000Z";
    const items = collectNeedsAttention({
      bookings: [
        { id: "b1", status: "confirmed", tutor_id: null, student_first_name: "Sam", scheduled_start: start, payment_status: "paid" },
        { id: "b3", status: "confirmed", tutor_id: "g1", tutor_display_name: "Jane", student_first_name: "Ivy", scheduled_start: start, scheduled_end: end, payment_status: "paid" },
        { id: "b4", status: "completed", tutor_id: "g1", student_first_name: "Noah", scheduled_start: "2026-08-25T17:00:00.000Z", scheduled_end: recentEnd, payment_status: "paid" },
        { id: "b6", status: "completed", tutor_id: "g1", tutor_display_name: "Chidi", student_first_name: "Sam", scheduled_start: "2026-08-24T17:00:00.000Z", scheduled_end: "2026-08-24T18:00:00.000Z", payment_status: "paid" },
      ],
      cancelRequests: [{ id: "c1", booking_id: "b2", student_first_name: "Ava", scheduled_start: start }],
      emailFailures: [{ id: "e1", to_email: "parent@example.com", booking_id: "b3", updated_at: "2026-08-27T16:00:00.000Z" }],
      recordingFailures: [{ id: "r1", booking_id: "b4", student_first_name: "Noah", status: "failed" }],
      disputes: [{ id: "d1", booking_id: "b5", status: "open" }],
      missingReports: [{ id: "b6", status: "completed", tutor_display_name: "Chidi", student_first_name: "Sam", scheduled_start: "2026-08-24T17:00:00.000Z", scheduled_end: "2026-08-24T18:00:00.000Z" }],
      pendingApplicants: [{ profile_id: "g1", display_name: "Jane" }],
      nowMs: nowBefore,
    });
    const titles = items.map((i) => i.title);
    assert.ok(titles.includes("Needs a Guide"));
    assert.ok(titles.includes("Guide replacement failed"));
    assert.ok(titles.includes("Parent wasn't notified"));
    assert.ok(titles.includes("Recording unavailable"));
    assert.ok(titles.includes("Payment needs review"));
    assert.ok(titles.includes("Guide report missing"));
    assert.ok(titles.includes("Guide application waiting"));
    assert.equal(items.find((i) => i.kind === "needs_guide").action, "Assign Guide");
    assert.ok(items.find((i) => i.kind === "needs_guide").title !== "Needs attention");
  });

  it("does not duplicate the Guide name in the rendered attention detail", () => {
    const booking = {
      id: "b-miss",
      status: "confirmed",
      tutor_id: "g1",
      tutor_display_name: "Sarah M.",
      student_first_name: "Jordan",
      scheduled_start: start,
      scheduled_end: end,
      payment_status: "paid",
    };
    const assignment = {
      id: "a-miss",
      booking_id: "b-miss",
      tutor_id: "g1",
      source: "t30",
      status: "missed",
      missed_at: "2026-08-27T17:40:00.000Z",
    };
    const items = collectNeedsAttention({
      bookings: [booking],
      attendanceByBooking: { "b-miss": assignment },
      assignmentsLoaded: true,
      nowMs: nowBefore,
    });
    const missed = items.find((i) => i.kind === "guide_confirm_missed");
    assert.ok(missed);
    assert.equal(missed.detail, "Jordan · Sarah M.");
    assert.doesNotMatch(missed.detail, /Sarah M\.\s*·\s*Sarah M\./);
    const segments = missed.detail.split(" · ");
    assert.equal(new Set(segments.map((s) => s.toLowerCase())).size, segments.length);

    const withSearch = collectNeedsAttention({
      bookings: [booking],
      attendanceByBooking: { "b-miss": assignment },
      assignmentsLoaded: true,
      offerCountByBooking: { "b-miss": 4 },
      nowMs: nowBefore,
    }).find((i) => i.kind === "guide_confirm_missed");
    assert.equal(withSearch.detail, "Jordan · Sarah M. · 4 eligible Guides offered");
    const searchSegments = withSearch.detail.split(" · ");
    assert.equal(new Set(searchSegments.map((s) => s.toLowerCase())).size, searchSegments.length);

    const otherGuide = collectNeedsAttention({
      bookings: [{ ...booking, id: "b-other", student_first_name: "Ava", tutor_display_name: "Chidi Okeke" }],
      attendanceByBooking: { "b-other": { ...assignment, booking_id: "b-other" } },
      assignmentsLoaded: true,
      nowMs: nowBefore,
    }).find((i) => i.kind === "guide_confirm_missed");
    assert.equal(otherGuide.detail, "Ava · Chidi Okeke");
    assert.equal(uniqueAttentionDetail(["Ava", "Chidi Okeke", "Chidi Okeke"]), "Ava · Chidi Okeke");
  });

  it("does not permanently flag historical notification or recording failures", () => {
    const items = collectNeedsAttention({
      bookings: [
        {
          id: "old",
          status: "completed",
          tutor_id: "g1",
          student_first_name: "Sam",
          scheduled_start: "2026-07-20T18:00:00.000Z",
          scheduled_end: "2026-07-20T19:00:00.000Z",
          payment_status: "paid",
        },
      ],
      emailFailures: [{ id: "e-old", booking_id: "old", to_email: "parent@example.com", updated_at: "2026-07-20T19:10:00.000Z" }],
      recordingFailures: [{ id: "r-old", booking_id: "old", status: "failed" }],
      nowMs: nowBefore,
    });
    assert.equal(items.length, 0);
  });

  it("does not flag orphan email failures with no booking as operational attention", () => {
    const items = collectNeedsAttention({
      emailFailures: [{ id: "orphan", to_email: "test@example.com", booking_id: null, updated_at: "2026-08-27T16:00:00.000Z" }],
      nowMs: nowBefore,
    });
    assert.equal(items.length, 0);
  });

  it("lists every current issue on one Study Hall instead of collapsing to Needs attention", () => {
    const booking = {
      id: "multi",
      status: "confirmed",
      tutor_id: null,
      student_first_name: "Sam",
      scheduled_start: start,
      scheduled_end: end,
      payment_status: "awaiting_payment",
      is_free_trial: false,
    };
    const issues = currentStudyHallIssues(booking, {
      nowMs: nowBefore,
      emailFailures: [{ id: "e", booking_id: "multi", updated_at: "2026-08-27T16:30:00.000Z" }],
    });
    const kinds = issues.map((i) => i.kind);
    assert.ok(kinds.includes("needs_guide"));
    assert.ok(kinds.includes("payment"));
    assert.ok(kinds.includes("notify"));
    assert.ok(issues.every((i) => i.title && i.title !== "Needs attention"));
    const presented = presentNeedsAttention(
      collectNeedsAttention({
        bookings: [booking],
        emailFailures: [{ id: "e", booking_id: "multi", updated_at: "2026-08-27T16:30:00.000Z" }],
        nowMs: nowBefore,
      }),
    );
    assert.equal(presented.length, 1);
    assert.equal(presented[0].issueCount, 3);
    assert.equal(presented[0].title, "3 issues");
    assert.ok(presented[0].reasons.includes("Needs a Guide"));
    assert.ok(presented[0].reasons.includes("Payment needs review"));
    assert.ok(presented[0].reasons.includes("Parent wasn't notified"));
  });
});

describe("Management Control Center — Study Hall views and search", () => {
  const ready = {
    id: "b1",
    status: "confirmed",
    tutor_id: "g",
    tutor_display_name: "Chidi Okeke",
    student_first_name: "Sam Johnson",
    parent_name: "Alex Johnson",
    public_reference: "AT-ABCD1234",
    scheduled_start: start,
    scheduled_end: end,
    payment_status: "paid",
  };

  it("filters Today / Upcoming / Completed / Cancelled / Needs Attention", () => {
    const tz = "UTC";
    assert.equal(studyHallViewMembership(ready, "today", { tz, nowMs: nowBefore }), true);
    assert.equal(studyHallViewMembership(ready, "upcoming", { tz, nowMs: nowBefore }), true);
    assert.equal(studyHallViewMembership({ ...ready, status: "completed" }, "completed", { tz, nowMs: nowBefore }), true);
    assert.equal(studyHallViewMembership({ ...ready, status: "cancelled" }, "cancelled", { tz, nowMs: nowBefore }), true);
    assert.equal(
      studyHallViewMembership({ ...ready, tutor_id: null, tutor_display_name: null }, "attention", { tz, nowMs: nowBefore }),
      true,
    );
  });

  it("finds Study Halls by child, parent, Guide, or reference", () => {
    assert.equal(matchesStudyHallSearch(ready, "sam"), true);
    assert.equal(matchesStudyHallSearch(ready, "alex"), true);
    assert.equal(matchesStudyHallSearch(ready, "chidi"), true);
    assert.equal(matchesStudyHallSearch(ready, "AT-ABCD"), true);
    assert.equal(matchesStudyHallSearch(ready, "xyz"), false);
  });
});

describe("Management Control Center — routes and authorization", () => {
  it("Overview is a control tower, not the old giant page", () => {
    const overview = read("src/app/dashboard/admin/page.tsx");
    const overviewUi = read("src/components/dashboard/management-overview.tsx");
    assert.match(overview, /requireRole\("admin"/);
    assert.match(overview, /ManagementOverview/);
    assert.match(overviewUi, /Study Halls today/);
    assert.match(overviewUi, /Live now/);
    assert.match(overviewUi, /Guides active/);
    assert.match(overviewUi, /Needs attention/);
    assert.match(overviewUi, /Outstanding Guide pay/);
    assert.match(overviewUi, /No issues need attention/);
    assert.match(overviewUi, /managementDateLabel/);
    assert.match(overviewUi, /presentNeedsAttention/);
    assert.match(overviewUi, /browserTimezone/);
    assert.match(overviewUi, /formatCompensationTotals/);
    assert.doesNotMatch(overview, /AdminConsole/);
    assert.doesNotMatch(overview, /id="sessions"|id="guide-approvals"/);
  });

  it("Study Halls list and detail are authorized destinations", () => {
    const list = read("src/app/dashboard/admin/study-halls/page.tsx");
    const listUi = read("src/components/dashboard/management-study-halls.tsx");
    const detail = read("src/app/dashboard/admin/study-halls/[bookingId]/page.tsx");
    assert.match(list, /requireRole\("admin"/);
    assert.match(list, /ManagementStudyHalls/);
    assert.match(listUi, /Today/);
    assert.match(listUi, /Needs Attention/);
    assert.match(listUi, /Completed/);
    assert.match(listUi, /Cancelled/);
    assert.match(detail, /requireRole\("admin"/);
    assert.match(detail, /ManagementStudyHallActions/);
    assert.match(read("src/components/dashboard/management-study-hall-actions.tsx"), /Assign Guide|Reassign Guide/);
    assert.match(detail, /AdminWhen/);
    assert.match(listUi, /Child, parent, Guide, or booking reference/);
    assert.match(listUi, /quiet \? "text-ink-500" \| "text-ink-900"|opacity-70/);
    assert.match(listUi, /Time/);
    assert.match(listUi, /Child/);
    assert.match(detail, /Current issue/);
    assert.match(detail, /currentStudyHallIssues/);
    assert.match(detail, /History and diagnostics/);
    assert.match(detail, /Parent wasn't notified/);
    assert.match(detail, /ManagementNotifyRetry/);
  });

  it("Guides, Customers, and Finance remain authorized and reachable", () => {
    assert.match(read("src/app/dashboard/admin/guides/page.tsx"), /requireRole\("admin"/);
    assert.match(read("src/components/dashboard/admin-guides-directory.tsx"), /GuideWorkforceActions/);
    assert.match(read("src/app/dashboard/admin/customers/page.tsx"), /requireRole\("admin"/);
    assert.match(read("src/app/dashboard/admin/customers/page.tsx"), /Email search uses notification history/);
    assert.doesNotMatch(read("src/app/dashboard/admin/customers/page.tsx"), /listUsers|getUserByEmail/);
    assert.match(read("src/app/dashboard/admin/customers/[accountId]/page.tsx"), /requireRole\("admin"/);
    assert.match(read("src/app/dashboard/admin/customers/[accountId]/page.tsx"), /lookupEmail/);
    assert.match(read("src/app/dashboard/admin/customers/[accountId]/page.tsx"), /get_customer_balances/);
    assert.match(read("src/app/dashboard/admin/customers/[accountId]/page.tsx"), /phone_e164/);
    assert.doesNotMatch(read("src/app/dashboard/admin/customers/[accountId]/page.tsx"), /impersonat|signInAs/i);
    assert.match(read("src/lib/auth.ts"), /user\.role !== role/);
    assert.match(read("src/lib/auth.ts"), /redirect\(DASHBOARD_PATH_BY_ROLE\[user\.role\]\)/);
    assert.match(read("src/app/dashboard/admin/finance/page.tsx"), /requireRole\("admin"/);
    const financeUi = read("src/components/dashboard/admin-finance-console.tsx");
    assert.match(financeUi, /Guide compensation/);
    assert.match(financeUi, /Customer money/);
    assert.match(financeUi, /Customer balances/);
    assert.match(financeUi, /Mixed currencies are never added together/);
    assert.doesNotMatch(financeUi, /Parent wasn't notified/);
    assert.doesNotMatch(financeUi, /"notifications"/);
    assert.match(read("src/app/dashboard/admin/customers/[accountId]/page.tsx"), /Notifications/);
    assert.match(read("src/app/dashboard/admin/customers/[accountId]/page.tsx"), /email_deliveries/);
  });

  it("does not change booking, Stripe, Daily, or compensation math", () => {
    const ops = read("src/lib/management-ops.mjs");
    assert.match(ops, /Does not change booking, pay, matching/);
    assert.doesNotMatch(ops, /admin_complete_booking|session_list_price_cents|authorize_session_join/);
    assert.doesNotMatch(read("src/app/dashboard/admin/page.tsx"), /from\("bookings"\)\.update|rpc\("book_session"/);
    assert.match(read("src/lib/timezone-format.mjs"), /minute: "2-digit"/);
    assert.doesNotMatch(ops, /Math\.round\(.*scheduled_start|setMinutes\(0\)/);
    assert.match(read("src/lib/pricing.ts"), /minutes: 60/);
    assert.doesNotMatch(read("src/lib/pricing.ts"), /minutes: 30/);
  });
});

describe("Management Control Center — Today order and greeting", () => {
  it("keeps Live, Needs Attention, Ready ahead of Completed", () => {
    const listUi = read("src/components/dashboard/management-study-halls.tsx");
    const live = listUi.indexOf("live: 0");
    const attention = listUi.indexOf("needs_attention: 1");
    const ready = listUi.indexOf("ready: 2");
    const completed = listUi.indexOf("completed: 3");
    assert.ok(live >= 0 && attention > live && ready > attention && completed > ready);
  });

  it("greeting changes by hour without inventing booking times", () => {
    const morning = Date.parse("2026-08-27T08:00:00.000Z");
    const afternoon = Date.parse("2026-08-27T15:00:00.000Z");
    const evening = Date.parse("2026-08-27T20:00:00.000Z");
    assert.equal(managementGreeting(morning, "UTC"), "Good morning");
    assert.equal(managementGreeting(afternoon, "UTC"), "Good afternoon");
    assert.equal(managementGreeting(evening, "UTC"), "Good evening");
  });
});
