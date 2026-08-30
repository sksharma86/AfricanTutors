import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  guideAvailabilitySummary,
  guideDayPart,
  guideDaySchedule,
  guideEarningsHomeSummary,
  guideNeedsReport,
  guideWeekSummary,
  unfinishedGuideReport,
} from "../src/lib/guide-portal.mjs";
import { guideHomeVisualFixture } from "../src/lib/guide-home-visual-fixture.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Guide Portal premium workstation", () => {
  it("scopes Guide visuals to .guide-app and does not reuse .parent-app", () => {
    const css = read("src/app/globals.css");
    const shell = read("src/components/dashboard/guide-shell.tsx");
    const parent = read("src/components/dashboard/customer-shell.tsx");
    const admin = read("src/components/dashboard/dashboard-shell.tsx");
    assert.match(css, /\.guide-app/);
    assert.match(css, /--gp-canvas: #f6f1e8/);
    assert.match(css, /--gp-gold: #c9a227/);
    assert.match(shell, /guide-app/);
    assert.doesNotMatch(shell, /parent-app|--pp-canvas|Book a Study Hall/);
    assert.doesNotMatch(parent, /guide-app|--gp-canvas/);
    assert.doesNotMatch(admin, /guide-app|--gp-canvas/);
  });

  it("Home is a workstation board with week or report in the same slot", () => {
    const home = read("src/app/dashboard/tutor/page.tsx");
    const board = read("src/components/dashboard/guide-home-board.tsx");
    assert.match(home, /GuideHomeBoard/);
    assert.match(home, /firstName/);
    assert.doesNotMatch(home, /guideHomeVisualFixture|visual-review/);
    assert.match(board, /GuideWeekCard/);
    assert.match(board, /unfinished \? \(/);
    assert.match(board, /GuideFinishReport/);
    assert.doesNotMatch(board, /Pending Tasks|Action Center|3 things remaining/);
    assert.doesNotMatch(board, /parent-home-visual-fixture|Buy hours/);
  });

  it("real Home never imports the visual-review fixture", () => {
    const review = read("src/app/dashboard/tutor/visual-review/page.tsx");
    const home = read("src/app/dashboard/tutor/page.tsx");
    assert.match(review, /GUIDE_HOME_VISUAL_REVIEW/);
    assert.match(review, /notFound/);
    assert.match(review, /guideHomeVisualFixture/);
    assert.doesNotMatch(home, /guideHomeVisualFixture|visual-review/);
  });

  it("week summary uses Sunday–Saturday in the Guide timezone", () => {
    const now = Date.parse("2026-08-26T18:00:00Z"); // Wednesday
    const week = guideWeekSummary(
      [
        { status: "confirmed", scheduled_start: "2026-08-24T17:00:00Z", duration_minutes: 60 },
        { status: "completed", scheduled_start: "2026-08-25T17:00:00Z", duration_minutes: 60 },
        { status: "cancelled", scheduled_start: "2026-08-26T17:00:00Z", duration_minutes: 60 },
        { status: "confirmed", scheduled_start: "2026-09-02T17:00:00Z", duration_minutes: 60 },
      ],
      now,
      "America/Chicago",
    );
    assert.equal(week.startKey, "2026-08-23");
    assert.equal(week.endKey, "2026-08-29");
    assert.equal(week.count, 2);
    assert.equal(week.hours, 2);
    assert.equal(week.completed, 1);
    assert.equal(week.upcoming, 1);
  });

  it("day schedule includes completed sessions on the Guide-local day", () => {
    const now = Date.parse("2026-08-26T18:00:00Z");
    const rows = guideDaySchedule(
      [
        { id: "a", status: "completed", scheduled_start: "2026-08-26T16:00:00Z" },
        { id: "b", status: "confirmed", scheduled_start: "2026-08-26T23:00:00Z" },
        { id: "c", status: "cancelled", scheduled_start: "2026-08-26T20:00:00Z" },
      ],
      now,
      "America/Chicago",
    );
    assert.deepEqual(rows.map((r) => r.id), ["a", "b"]);
  });

  it("availability summary reads weekly blocks without inventing matching rules", () => {
    const now = Date.parse("2026-08-26T16:00:00Z"); // Wed 11:00 Chicago
    const summary = guideAvailabilitySummary(
      [{ day_of_week: 3, start_time: "17:00:00", end_time: "21:00:00" }],
      [],
      now,
      "America/Chicago",
    );
    assert.equal(summary.hasSchedule, true);
    assert.equal(summary.availableToday, true);
    assert.equal(summary.nextWindow?.when, "Today");
  });

  it("earnings home summary keeps outstanding vs paid-this-month from real rows", () => {
    const now = Date.parse("2026-08-26T18:00:00Z");
    const pay = guideEarningsHomeSummary(
      [
        { amount_cents: 12000, status: "earned", paid_at: null },
        { amount_cents: 54000, status: "paid", paid_at: "2026-08-10T15:00:00Z" },
        { amount_cents: 2000, status: "paid", paid_at: "2026-07-10T15:00:00Z" },
      ],
      now,
      "America/Chicago",
      "USD",
    );
    assert.equal(pay.outstanding, 12000);
    assert.equal(pay.paidMonth, 54000);
  });

  it("report-needed detection stays the existing completed/ended-confirmed rule", () => {
    const ended = { id: "r1", status: "completed", scheduled_start: "2026-08-26T16:00:00Z", scheduled_end: "2026-08-26T17:00:00Z" };
    assert.equal(guideNeedsReport(ended, false), true);
    assert.equal(unfinishedGuideReport([ended], []).id, "r1");
    const card = read("src/components/dashboard/guide-finish-report.tsx");
    assert.match(card, /Complete report/);
    assert.doesNotMatch(card, /Pending Tasks|1 of 1|quota|streak/i);
  });

  it("populated fixture stays isolated and can show report needed", () => {
    const now = new Date("2026-08-26T18:00:00-05:00");
    const pop = guideHomeVisualFixture(now);
    const report = guideHomeVisualFixture(now, { reportNeeded: true });
    assert.equal(pop.firstName, "Sarah");
    assert.ok(pop.bookings.length >= 5);
    assert.equal(unfinishedGuideReport(pop.bookings, pop.reportedBookings, pop.nowMs), null);
    assert.ok(unfinishedGuideReport(report.bookings, report.reportedBookings, report.nowMs));
    const home = read("src/app/dashboard/tutor/page.tsx");
    assert.doesNotMatch(home, /fixture-next|Sarah/);
  });

  it("greeting uses a real first name helper and Guide-local day part", () => {
    assert.equal(guideDayPart(Date.parse("2026-08-26T14:00:00Z"), "America/Chicago"), "Good morning");
    assert.equal(guideDayPart(Date.parse("2026-08-26T19:00:00Z"), "America/Chicago"), "Good afternoon");
    const greet = read("src/components/dashboard/guide-greeting.tsx");
    assert.match(greet, /Everything you need for today/);
    assert.doesNotMatch(greet, /Sarah/);
  });

  it("session leave still routes to the existing report page", () => {
    const room = read("src/components/session/session-room.tsx");
    assert.match(room, /\/dashboard\/tutor\/study-halls\/\$\{bookingId\}\/report/);
  });
});
