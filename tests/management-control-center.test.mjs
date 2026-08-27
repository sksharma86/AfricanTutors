import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  collectNeedsAttention,
  isStudyHallLive,
  managementOperationalStatus,
  matchesStudyHallSearch,
  studyHallViewMembership,
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

  it("aggregates existing operational exceptions in human language", () => {
    const items = collectNeedsAttention({
      bookings: [
        { id: "b1", status: "confirmed", tutor_id: null, student_first_name: "Sam", scheduled_start: start, payment_status: "paid" },
      ],
      cancelRequests: [{ id: "c1", booking_id: "b2", student_first_name: "Ava", scheduled_start: start }],
      emailFailures: [{ id: "e1", to_email: "parent@example.com", booking_id: "b3" }],
      recordingFailures: [{ id: "r1", booking_id: "b4", student_first_name: "Noah" }],
      disputes: [{ id: "d1", booking_id: "b5", status: "open" }],
      missingReports: [{ id: "b6", tutor_display_name: "Chidi", student_first_name: "Sam" }],
      pendingApplicants: [{ profile_id: "g1", display_name: "Jane" }],
      nowMs: nowBefore,
    });
    const titles = items.map((i) => i.title);
    assert.ok(titles.includes("Study Hall needs a Guide"));
    assert.ok(titles.includes("Could not find a replacement Guide"));
    assert.ok(titles.includes("Parent wasn't notified"));
    assert.ok(titles.includes("Recording unavailable"));
    assert.ok(titles.includes("Payment needs review"));
    assert.ok(titles.includes("Guide report overdue"));
    assert.ok(titles.includes("Guide application waiting"));
    assert.equal(items.find((i) => i.kind === "needs_guide").action, "Assign Guide");
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
    assert.match(overview, /Needs attention|needs attention/i);
    assert.match(overviewUi, /Study Halls today/);
    assert.match(overviewUi, /Live now/);
    assert.match(overviewUi, /Guides active/);
    assert.match(overviewUi, /Needs attention/);
    assert.match(overviewUi, /Outstanding Guide pay/);
    assert.match(overviewUi, /Everything is running normally/);
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
    assert.match(detail, /Assign Guide|Reassign/);
    assert.match(detail, /AdminWhen/);
    assert.match(listUi, /Child, parent, Guide, or booking reference/);
  });

  it("Guides, Customers, and Finance remain authorized and reachable", () => {
    assert.match(read("src/app/dashboard/admin/guides/page.tsx"), /requireRole\("admin"/);
    assert.match(read("src/app/dashboard/admin/guides/page.tsx"), /GuideWorkforceActions/);
    assert.match(read("src/app/dashboard/admin/customers/page.tsx"), /requireRole\("admin"/);
    assert.match(read("src/app/dashboard/admin/customers/[accountId]/page.tsx"), /requireRole\("admin"/);
    assert.match(read("src/app/dashboard/admin/customers/[accountId]/page.tsx"), /lookupEmail/);
    assert.match(read("src/app/dashboard/admin/customers/[accountId]/page.tsx"), /get_customer_balances/);
    assert.match(read("src/app/dashboard/admin/customers/[accountId]/page.tsx"), /phone_e164/);
    assert.doesNotMatch(read("src/app/dashboard/admin/customers/[accountId]/page.tsx"), /impersonat|signInAs/i);
    assert.match(read("src/lib/auth.ts"), /user\.role !== role/);
    assert.match(read("src/lib/auth.ts"), /redirect\(DASHBOARD_PATH_BY_ROLE\[user\.role\]\)/);
    assert.match(read("src/app/dashboard/admin/finance/page.tsx"), /requireRole\("admin"/);
    assert.match(read("src/components/dashboard/admin-finance-console.tsx"), /Guide compensation/);
    assert.match(read("src/components/dashboard/admin-finance-console.tsx"), /Customer money/);
    assert.match(read("src/components/dashboard/admin-finance-console.tsx"), /Mixed currencies are never added together/);
  });

  it("does not change booking, Stripe, Daily, or compensation math", () => {
    const ops = read("src/lib/management-ops.mjs");
    assert.match(ops, /Does not change booking, pay, matching/);
    assert.doesNotMatch(ops, /admin_complete_booking|session_list_price_cents|authorize_session_join/);
    assert.doesNotMatch(read("src/app/dashboard/admin/page.tsx"), /from\("bookings"\)\.update|rpc\("book_session"/);
  });
});
