import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { completedStudyHallsThisMonth, parentHabitCopy } from "../src/lib/parent-portal.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Parent Portal premium visual system", () => {
  it("scopes the application canvas to .parent-app so other portals stay unchanged", () => {
    const css = read("src/app/globals.css");
    const shell = read("src/components/dashboard/customer-shell.tsx");
    const guide = read("src/components/dashboard/guide-shell.tsx");
    const admin = read("src/components/dashboard/dashboard-shell.tsx");
    assert.match(css, /\.parent-app/);
    assert.match(css, /--pp-canvas: #f6f1e8/);
    assert.match(css, /--pp-gold: #c9a227/);
    assert.match(css, /--pp-hero: #161c18/);
    assert.match(shell, /parent-app/);
    assert.doesNotMatch(guide, /parent-app|--pp-canvas/);
    assert.doesNotMatch(admin, /parent-app|--pp-canvas/);
  });

  it("desktop uses a left rail and mobile keeps a scrollable destination bar", () => {
    const shell = read("src/components/dashboard/customer-shell.tsx");
    assert.match(shell, /<aside/);
    assert.match(shell, /PARENT_NAV_ICONS/);
    assert.match(shell, /bg-\[#f3e6c4\]/);
    assert.match(shell, /overflow-x-auto/);
    assert.match(shell, /snap-x/);
    assert.doesNotMatch(shell, /hamburger|Menu2/);
  });

  it("Next Study Hall is a dark featured hero with gold join action", () => {
    const next = read("src/components/dashboard/parent-next-study-hall.tsx");
    const surface = read("src/components/dashboard/parent-surface.tsx");
    assert.match(next, /ParentSurface featured/);
    assert.match(next, /variant="secondary"/);
    assert.match(next, /Join Study Hall/);
    assert.match(surface, /before:bg-gold-400/);
    assert.match(surface, /pp-hero/);
  });

  it("Home greeting uses local time-of-day without inventing profile data", () => {
    const greet = read("src/components/dashboard/parent-greeting.tsx");
    const home = read("src/app/dashboard/student/page.tsx");
    const board = read("src/components/dashboard/parent-home-board.tsx");
    assert.match(board, /ParentGreeting/);
    assert.match(home, /firstName/);
    assert.match(greet, /Good morning/);
    assert.match(greet, /Good evening/);
    assert.match(greet, /getHours/);
    assert.doesNotMatch(greet, /Priya|notification|avatar/);
  });

  it("Home uses a stable dashboard grid and a habit indicator that is not a quota", () => {
    const home = read("src/app/dashboard/student/page.tsx");
    const board = read("src/components/dashboard/parent-home-board.tsx");
    const habit = read("src/components/dashboard/parent-habit.tsx");
    const css = read("src/app/globals.css");
    const shell = read("src/components/dashboard/customer-shell.tsx");
    assert.match(home, /ParentHomeBoard/);
    assert.match(board, /pp-home-grid/);
    assert.match(css, /grid-template-areas/);
    assert.match(css, /pp-home-grid\.is-empty/);
    assert.match(board, /is-empty/);
    assert.match(habit, /Study Halls this month/);
    assert.match(habit, /completedStudyHallsThisMonth/);
    assert.match(habit, /parentHabitCopy/);
    assert.match(habit, /pp-habit-day/);
    assert.match(habit, /is-done/);
    assert.doesNotMatch(habit, /of 20|Renews|hours remaining|progress ring|monthly quota/i);
    assert.doesNotMatch(home, /ParentBrandStrip|A better homework routine/);
    assert.doesNotMatch(shell, /ParentSidebarAtmosphere|Calm, focused evenings/);
    assert.doesNotMatch(home, /parent-home-visual-fixture|Priya|Jordan/);
  });

  it("visual-review fixture is gated and not used by the real Home", () => {
    const review = read("src/app/dashboard/student/visual-review/page.tsx");
    const home = read("src/app/dashboard/student/page.tsx");
    assert.match(review, /PARENT_HOME_VISUAL_REVIEW/);
    assert.match(review, /notFound/);
    assert.match(review, /parentHomeVisualFixture/);
    assert.doesNotMatch(home, /parentHomeVisualFixture|visual-review/);
  });

  it("empty Next Study Hall Book action is gold, not black", () => {
    const next = read("src/components/dashboard/parent-next-study-hall.tsx");
    assert.match(next, /Nothing scheduled yet/);
    assert.match(next, /variant="secondary"/);
    assert.doesNotMatch(next, /variant="primary"/);
  });

  it("counts completed Study Halls in the current calendar month only", () => {
    const now = Date.parse("2026-08-15T18:00:00Z");
    const month = completedStudyHallsThisMonth(
      [
        { status: "completed", scheduled_start: "2026-08-03T23:00:00Z" },
        { status: "completed", scheduled_start: "2026-08-10T23:00:00Z" },
        { status: "completed", scheduled_start: "2026-07-28T23:00:00Z" },
        { status: "cancelled", scheduled_start: "2026-08-12T23:00:00Z" },
        { status: "confirmed", scheduled_start: "2026-08-20T23:00:00Z" },
        { status: "no_show", scheduled_start: "2026-08-08T23:00:00Z" },
      ],
      now,
      "America/Chicago",
    );
    assert.equal(month.count, 2);
    assert.equal(month.yearMonth, "2026-08");
    assert.ok(month.days.length >= 2);
  });

  it("maps habit language from completed-session counts without quota language", () => {
    assert.equal(parentHabitCopy(0).title, "Ready when you are.");
    assert.equal(parentHabitCopy(1).title, "A good start.");
    assert.equal(parentHabitCopy(2).title, "A good start.");
    assert.equal(parentHabitCopy(3).title, "Building momentum.");
    assert.equal(parentHabitCopy(5).title, "Building momentum.");
    assert.equal(parentHabitCopy(6).title, "Strong routine.");
    assert.equal(parentHabitCopy(9).title, "Strong routine.");
    assert.equal(parentHabitCopy(10).title, "Consistency is becoming a habit.");
    assert.equal(parentHabitCopy(14).title, "Consistency is becoming a habit.");
    assert.equal(parentHabitCopy(15).title, "Study Hall is part of the routine.");
    for (const n of [0, 1, 4, 8, 12, 20]) {
      const copy = parentHabitCopy(n);
      assert.doesNotMatch(copy.title, /of 20|renew|quota|%|grade/i);
      assert.doesNotMatch(copy.body, /of 20|renew|quota|better grades|neurolog/i);
    }
  });
});
