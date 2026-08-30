import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  managementClockLabel,
  managementCoverageSummary,
  managementPaymentsTodayCents,
  managementRecentActivity,
  managementTodayPulse,
} from "../src/lib/management-console.mjs";
import { managementHomeVisualFixture, managementVisualReviewNow } from "../src/lib/management-visual-fixture.mjs";
import { isStudyHallLive } from "../src/lib/management-ops.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Management Console premium", () => {
  it("scopes Management visuals to .management-app and does not reuse parent/guide shells", () => {
    const css = read("src/app/globals.css");
    const shell = read("src/components/dashboard/management-shell.tsx");
    const parent = read("src/components/dashboard/customer-shell.tsx");
    const guide = read("src/components/dashboard/guide-shell.tsx");
    assert.match(css, /\.management-app/);
    assert.match(css, /--mg-canvas: #f6f1e8/);
    assert.match(shell, /management-app/);
    assert.doesNotMatch(shell, /parent-app|guide-app|Good morning/);
    assert.doesNotMatch(parent, /management-app|--mg-canvas/);
    assert.doesNotMatch(guide, /management-app|--mg-canvas/);
  });

  it("Overview is a control tower without motivational modules", () => {
    const home = read("src/app/dashboard/admin/page.tsx");
    const board = read("src/components/dashboard/management-overview.tsx");
    assert.match(home, /ManagementOverview/);
    assert.match(home, /ManagementPage/);
    assert.doesNotMatch(home, /managementHomeVisualFixture|visual-review/);
    assert.match(board, /Study Halls today/);
    assert.match(board, /Live now/);
    assert.match(board, /Guides active/);
    assert.match(board, /Needs attention/);
    assert.match(board, /Outstanding Guide pay/);
    assert.match(board, /Everything is running normally/);
    assert.doesNotMatch(board, /Let's make today great|quota|Top Guides|satisfaction/i);
    assert.doesNotMatch(board, /managementGreeting/);
  });

  it("real Overview never imports the visual-review fixture", () => {
    const review = read("src/app/dashboard/admin/visual-review/page.tsx");
    const home = read("src/app/dashboard/admin/page.tsx");
    assert.match(review, /MANAGEMENT_VISUAL_REVIEW/);
    assert.match(review, /notFound/);
    assert.match(review, /managementHomeVisualFixture/);
    assert.doesNotMatch(home, /managementHomeVisualFixture|visual-review/);
  });

  it("today pulse uses live presence semantics and does not invent live from the clock", () => {
    const now = Date.parse("2026-08-26T23:10:00Z");
    const tz = "America/Chicago";
    const live = {
      id: "l1",
      status: "confirmed",
      scheduled_start: "2026-08-26T22:50:00Z",
      scheduled_end: "2026-08-26T23:50:00Z",
      tutor_display_name: "Sarah",
    };
    const upcoming = {
      id: "u1",
      status: "confirmed",
      scheduled_start: "2026-08-27T00:00:00Z",
      scheduled_end: "2026-08-27T01:00:00Z",
      tutor_display_name: "Grace",
    };
    const done = {
      id: "c1",
      status: "completed",
      scheduled_start: "2026-08-26T20:00:00Z",
      scheduled_end: "2026-08-26T21:00:00Z",
    };
    assert.equal(isStudyHallLive(live, null, now), false);
    const pulse = managementTodayPulse(
      [live, upcoming, done],
      { l1: { tutor_first_joined_at: "2026-08-26T22:52:00Z" } },
      tz,
      now,
    );
    assert.equal(pulse.count, 3);
    assert.equal(pulse.live, 1);
    assert.equal(pulse.upcoming, 1);
    assert.equal(pulse.completed, 1);
    assert.equal(pulse.next.id, "u1");
  });

  it("never sums mixed Guide payout currencies", () => {
    const finance = read("src/app/dashboard/admin/finance/page.tsx");
    assert.match(finance, /may use more than one currency/);
    assert.match(read("src/lib/compensation-currency.mjs"), /aggregateCompensationByCurrency/);
    const board = read("src/components/dashboard/management-overview.tsx");
    assert.match(board, /formatCompensationTotals/);
  });

  it("coverage and payments helpers stay presentation-only", () => {
    const cov = managementCoverageSummary(
      [{ status: "confirmed", scheduled_start: "2026-08-26T23:30:00Z", tutor_id: "g1", tutor_display_name: "Sarah" }],
      [
        { status: "approved", approved_at: "2026-01-01T00:00:00Z" },
        { status: "pending", approved_at: null },
      ],
      "America/Chicago",
      Date.parse("2026-08-26T23:10:00Z"),
    );
    assert.equal(cov.active, 1);
    assert.equal(cov.applications, 1);
    assert.equal(cov.assigned, 1);
    const pay = managementPaymentsTodayCents(
      [
        { created_at: "2026-08-26T18:00:00Z", status: "succeeded", stripe_paid_cents: 1200 },
        { created_at: "2026-08-25T18:00:00Z", status: "succeeded", stripe_paid_cents: 9999 },
      ],
      "America/Chicago",
      Date.parse("2026-08-26T23:10:00Z"),
    );
    assert.equal(pay, 1200);
  });

  it("recent activity only uses timestamped completed sessions and reports", () => {
    const rows = managementRecentActivity(
      [{ id: "b1", status: "completed", scheduled_end: "2026-08-26T21:00:00Z", student_first_name: "Maya", tutor_display_name: "Sarah M." }],
      [{ booking_id: "b1", submitted_at: "2026-08-26T21:10:00Z" }],
      Date.parse("2026-08-26T23:00:00Z"),
    );
    assert.ok(rows.some((r) => r.type === "Study Hall completed"));
    assert.ok(rows.some((r) => r.type === "Report submitted"));
  });

  it("populated fixture stays isolated and can show exceptions", () => {
    const now = managementVisualReviewNow(new Date("2026-08-26T23:05:00Z"), "America/Chicago", 18, 5);
    const pop = managementHomeVisualFixture(now);
    assert.equal(pop.bookings.length, 18);
    assert.ok(pop.attentionItems.length >= 1);
    assert.ok(pop.outstandingTotals.length >= 2);
    const pulse = managementTodayPulse(pop.bookings, pop.presenceByBooking, pop.timeZone, pop.nowMs);
    assert.equal(pulse.count, 18);
    assert.equal(pulse.live, 2);
    const home = read("src/app/dashboard/admin/page.tsx");
    assert.doesNotMatch(home, /fx-live-1|Chinedu/);
    const empty = managementHomeVisualFixture(now, { empty: true });
    assert.equal(empty.bookings.length, 0);
    assert.equal(managementTodayPulse(empty.bookings, {}, empty.timeZone, empty.nowMs).count, 0);
  });

  it("clock label is timezone-aware and not a greeting", () => {
    const label = managementClockLabel(Date.parse("2026-08-30T06:54:00Z"), "America/Chicago");
    assert.match(label, /Sunday, August 30/);
    assert.match(label, /·/);
    assert.doesNotMatch(label, /Good morning|👋/);
  });

  it("Management rail destinations stay real and isolated from Parent/Guide", () => {
    const shell = read("src/components/dashboard/management-shell.tsx");
    const parent = read("src/components/dashboard/customer-shell.tsx");
    const guide = read("src/components/dashboard/guide-shell.tsx");
    const marketing = read("src/app/(marketing)/page.tsx");
    assert.match(shell, /href=\{item\.href\}/);
    assert.match(shell, /aria-current=\{active \? "page"/);
    assert.doesNotMatch(shell, /Operational|system-health|system health/i);
    assert.doesNotMatch(parent, /ManagementShell|management-app/);
    assert.doesNotMatch(guide, /ManagementShell|management-app/);
    assert.doesNotMatch(marketing, /management-app|--mg-canvas/);
  });
});
