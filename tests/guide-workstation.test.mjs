import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  GUIDE_PORTAL_NAV,
  guideChildName,
  guideEarningStatusLabel,
  guideNeedsReport,
  guideReportHref,
  guideRowStatus,
  guideStartsInLabel,
  guideStudyHallLists,
  unfinishedGuideReport,
} from "../src/lib/guide-portal.mjs";
import { JOIN_CLOSE_GRACE_MIN, JOIN_OPEN_LEAD_MIN } from "../src/lib/session-window.mjs";
import { guideJoinUiState } from "../src/lib/tutor-schedule.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const START = Date.parse("2026-08-27T18:00:00Z");
const END = Date.parse("2026-08-27T19:00:00Z");

function booking(overrides = {}) {
  return {
    id: "g1",
    status: "confirmed",
    scheduled_start: new Date(START).toISOString(),
    scheduled_end: new Date(END).toISOString(),
    student_first_name: "Sam",
    ...overrides,
  };
}

describe("Guide workstation — routes and authorization", () => {
  const pages = [
    ["src/app/dashboard/tutor/page.tsx", "/dashboard/tutor"],
    ["src/app/dashboard/tutor/study-halls/page.tsx", "/dashboard/tutor/study-halls"],
    ["src/app/dashboard/tutor/study-halls/[bookingId]/report/page.tsx", "/dashboard/tutor/study-halls/"],
    ["src/app/dashboard/tutor/availability/page.tsx", "/dashboard/tutor/availability"],
    ["src/app/dashboard/tutor/earnings/page.tsx", "/dashboard/tutor/earnings"],
  ];

  it("every Guide destination is a real route guarded by requireRole(tutor)", () => {
    for (const [file, path] of pages) {
      const src = read(file);
      assert.match(src, /requireRole\(\s*"tutor"/, `${file} must require Guide role`);
      assert.match(src, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("nav is Home, Study Halls, Availability, Earnings — no Messages", () => {
    assert.deepEqual(
      GUIDE_PORTAL_NAV.map((i) => i.label),
      ["Home", "Study Halls", "Availability", "Earnings"],
    );
    assert.doesNotMatch(GUIDE_PORTAL_NAV.map((i) => i.label).join(" "), /Messages|Soon/);
  });

  it("shell marks the active destination and keeps labels on mobile", () => {
    const shell = read("src/components/dashboard/guide-shell.tsx");
    assert.match(shell, /aria-current=\{isActive\(item\.href\) \? "page"/);
    assert.match(shell, /hidden items-center gap-1 md:flex/);
    assert.match(shell, /md:hidden/);
    assert.match(shell, /overflow-x-auto/);
    assert.match(shell, /GUIDE_PORTAL_NAV/);
  });

  it("legacy hashes redirect to real destinations", () => {
    const redir = read("src/components/dashboard/guide-hash-redirect.tsx");
    assert.match(redir, /hash === "earnings"/);
    assert.match(redir, /\/dashboard\/tutor\/earnings/);
    assert.match(redir, /hash === "availability"/);
    assert.match(redir, /hash === "study-halls"/);
  });
});

describe("Guide workstation — Home, Next, Today, Join", () => {
  it("Home is next assignment + today's schedule + optional report recovery", () => {
    const home = read("src/app/dashboard/tutor/page.tsx");
    assert.match(home, /GuideNextStudyHall/);
    assert.match(home, /GuideTodaySchedule/);
    assert.match(home, /GuideFinishReport/);
    assert.match(home, /unfinishedGuideReport/);
    assert.doesNotMatch(home, /Buy hours|Prepaid Hours|PackageStore/);
  });

  it("Next Study Hall join follows T−5 / end+15", () => {
    assert.equal(JOIN_OPEN_LEAD_MIN, 5);
    assert.equal(JOIN_CLOSE_GRACE_MIN, 15);
    const row = booking();
    assert.equal(guideJoinUiState(row.status, row.scheduled_start, row.scheduled_end, START - 6 * 60000).kind, "opens_at");
    assert.equal(guideJoinUiState(row.status, row.scheduled_start, row.scheduled_end, START - 5 * 60000).kind, "join");
    assert.equal(guideJoinUiState(row.status, row.scheduled_start, row.scheduled_end, END + 15 * 60000).kind, "join");
    assert.equal(guideJoinUiState(row.status, row.scheduled_start, row.scheduled_end, END + 15 * 60000 + 1).kind, "ended");
    const next = read("src/components/dashboard/guide-next-study-hall.tsx");
    assert.match(next, /Your next Study Hall/);
    assert.match(next, /Join Study Hall/);
    const join = read("src/components/dashboard/guide-join-control.tsx");
    assert.match(join, /Join opens at/);
  });

  it("Today's schedule is compact child + time + status", () => {
    const nowMs = Date.now();
    const start = new Date(nowMs + 3 * 3600000);
    const lists = guideStudyHallLists(
      [
        booking({
          id: "today",
          scheduled_start: start.toISOString(),
          scheduled_end: new Date(start.getTime() + 3600000).toISOString(),
        }),
      ],
      nowMs,
    );
    if (new Date(nowMs).toDateString() === start.toDateString()) {
      assert.equal(lists.today[0]?.id, "today");
    } else {
      assert.equal(lists.later[0]?.id, "today");
    }
    const nairobi = guideStudyHallLists(
      [
        booking({
          id: "nbo",
          scheduled_start: "2026-08-27T16:00:00Z",
          scheduled_end: "2026-08-27T17:00:00Z",
        }),
      ],
      Date.parse("2026-08-27T10:00:00Z"),
      "Africa/Nairobi",
    );
    assert.equal(nairobi.today[0]?.id, "nbo");
    const schedule = read("src/components/dashboard/guide-today-schedule.tsx");
    assert.match(schedule, /Today'?s Study Halls/);
    assert.match(schedule, /guideChildName/);
    assert.doesNotMatch(schedule, /payment_status|Daily room|UUID/);
  });

  it("starts-in and child helpers stay parent-safe and short", () => {
    assert.equal(guideChildName({ student_first_name: "Sam Shah" }), "Sam Shah");
    assert.equal(guideStartsInLabel(new Date(START).toISOString(), START - 42 * 60000), "Starts in 42 minutes");
    assert.equal(guideRowStatus(booking(), START - 60 * 60000), "Ready");
    assert.equal(guideReportHref("abc"), "/dashboard/tutor/study-halls/abc/report");
  });
});

describe("Guide workstation — mandatory report", () => {
  it("completed and ended-confirmed need a report; cancel/no-show do not", () => {
    const completed = booking({ status: "completed" });
    const cancelled = booking({ status: "cancelled" });
    const noShow = booking({ status: "no_show" });
    const future = booking();
    const ended = booking();
    assert.equal(guideNeedsReport(completed, false, END + 1000), true);
    assert.equal(guideNeedsReport(completed, true, END + 1000), false);
    assert.equal(guideNeedsReport(cancelled, false, END + 1000), false);
    assert.equal(guideNeedsReport(noShow, false, END + 1000), false);
    assert.equal(guideNeedsReport(future, false, START - 60 * 60000), false);
    assert.equal(guideNeedsReport(ended, false, END + 1000), true);
  });

  it("recovery surfaces the most recent unfinished report, not a queue", () => {
    const older = booking({ id: "old", status: "completed", scheduled_end: "2026-08-20T19:00:00Z" });
    const newer = booking({ id: "new", status: "completed", scheduled_end: "2026-08-26T19:00:00Z" });
    const last = unfinishedGuideReport([older, newer], []);
    assert.equal(last?.id, "new");
    const home = read("src/components/dashboard/guide-finish-report.tsx");
    assert.match(home, /Finish your last Study Hall/);
    assert.match(home, /Finish report/);
    assert.doesNotMatch(home, /Reports pending|Reports to complete/i);
  });

  it("session leave after scheduled end sends the Guide to the report", () => {
    const room = read("src/components/session/session-room.tsx");
    assert.match(room, /sessionEndedForReport/);
    assert.match(room, /\/dashboard\/tutor\/study-halls\/\$\{bookingId\}\/report/);
    assert.match(room, /End Study Hall/);
    assert.match(room, /Finish report/);
  });

  it("report page uses existing fields and does not invent a new schema", () => {
    const page = read("src/app/dashboard/tutor/study-halls/[bookingId]/report/page.tsx");
    const form = read("src/components/dashboard/guide-session-report.tsx");
    const m30 = read("supabase/migrations/0030_guide_report_after_session_end.sql");
    assert.match(page, /Study Hall complete/);
    assert.match(page, /Before you finish, tell the parent how the hour went/);
    assert.match(form, /What did they work on/);
    assert.match(form, /Note for parent \(optional\)/);
    assert.match(form, /Complete report|Submit report/);
    assert.match(m30, /status = 'completed'/);
    assert.match(m30, /status = 'confirmed' and v_ended/);
    assert.match(m30, /Does not create earnings/);
    assert.match(m30, /Reports can only be submitted for completed Study Hall sessions/);
  });
});

describe("Guide workstation — earnings, availability, privacy", () => {
  it("earnings stay multi-currency and do not gate on reports", () => {
    const earn = read("src/app/dashboard/tutor/earnings/page.tsx");
    assert.match(earn, /formatCompensationHourly/);
    assert.match(earn, /formatCompensationMinor/);
    assert.match(earn, /Outstanding/);
    assert.match(earn, /Paid/);
    assert.match(earn, /Hourly rate/);
    assert.doesNotMatch(earn, /formatCents\(/);
    assert.doesNotMatch(earn, /submit_session_report|report required for earning/i);
    assert.equal(guideEarningStatusLabel("earned"), "Outstanding");
    assert.equal(guideEarningStatusLabel("paid"), "Paid");
  });

  it("availability uses weekly human days and existing exception table", () => {
    const avail = read("src/components/dashboard/availability-manager.tsx");
    assert.match(avail, /Your weekly availability/);
    assert.match(avail, /Unavailable/);
    assert.match(avail, /Add another time/);
    assert.match(avail, /Time off \/ exceptions/);
    assert.match(avail, /Add time off/);
    assert.match(avail, /tutor_availability_exceptions/);
    assert.match(avail, /parents can book for Study Hall/);
    assert.match(avail, /halfHourClockOptions/);
    assert.match(avail, /Start and end on the half-hour/);
    assert.doesNotMatch(avail, /type="time"/);
  });

  it("Guide UI never prints a parent phone number", () => {
    const blob = [
      "src/app/dashboard/tutor/page.tsx",
      "src/app/dashboard/tutor/study-halls/page.tsx",
      "src/app/dashboard/tutor/earnings/page.tsx",
      "src/components/session/call-parent-control.tsx",
    ]
      .map(read)
      .join("\n");
    assert.doesNotMatch(blob, /phone_e164|parent_phone|\+1555/);
  });

  it("workforce gating files are unchanged in spirit", () => {
    const applicant = read("src/app/dashboard/applicant/page.tsx");
    const workforce = read("src/lib/guide-workforce.mjs");
    assert.match(applicant, /getGuideApplicantInfo|GuideApplicantPanel/);
    assert.match(workforce, /suspended|approved|pending/);
  });
});
