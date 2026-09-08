import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { PARENT_PORTAL_NAV, parentStudyHallLists } from "../src/lib/parent-portal.mjs";
import {
  parseParentMembership,
  parentHomeCtas,
  parentHomeFundingCopy,
  parentMembershipPresentation,
  parentWeekCompletion,
  parentWeekCompletionCopy,
  parentWeekDayKind,
  parentWeekStrip,
} from "../src/lib/parent-week.mjs";
import { PLAN_MY_WEEK_HREF } from "../src/lib/plan-my-week.mjs";
import { parentPostSessionOffer } from "../src/lib/parent-next-step.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const TZ = "America/Chicago";
/** Wednesday Sep 9 2026 4:00 PM Chicago (CDT, UTC-5). */
const NOW = new Date("2026-09-09T21:00:00.000Z");
const NOW_MS = NOW.getTime();

function booking(overrides = {}) {
  return {
    id: "b1",
    status: "confirmed",
    payment_status: "paid",
    scheduled_start: "2026-09-09T23:00:00.000Z",
    scheduled_end: "2026-09-10T00:00:00.000Z",
    students: { full_name: "Sam Rivera", timezone: TZ },
    ...overrides,
  };
}

describe("PR5 — Parent Portal transformation", () => {
  it("1. household with upcoming Study Hall shows Next + SCHEDULED later days", () => {
    const upcoming = booking({
      id: "fri",
      scheduled_start: "2026-09-11T23:00:00.000Z",
      scheduled_end: "2026-09-12T00:00:00.000Z",
    });
    const days = parentWeekStrip([upcoming], TZ, NOW_MS);
    assert.equal(days.find((d) => d.localDate === "2026-09-11")?.kind, "scheduled");
    assert.equal(parentStudyHallLists([upcoming], NOW_MS).next?.id, "fri");
  });

  it("2. household with Study Hall today marks TODAY", () => {
    const today = booking({ id: "today" });
    const days = parentWeekStrip([today], TZ, NOW_MS);
    assert.equal(days.find((d) => d.isToday)?.kind, "today");
    assert.equal(parentWeekDayKind([today], { isToday: true, nowMs: NOW_MS }), "today");
  });

  it("3. completed Study Hall is COMPLETED and never pending payment", () => {
    const done = booking({
      id: "mon",
      status: "completed",
      scheduled_start: "2026-09-07T23:00:00.000Z",
      scheduled_end: "2026-09-08T00:00:00.000Z",
    });
    const days = parentWeekStrip([done], TZ, NOW_MS);
    assert.equal(days.find((d) => d.localDate === "2026-09-07")?.kind, "completed");
    const awaiting = booking({ status: "pending", payment_status: "awaiting_payment" });
    assert.equal(parentWeekDayKind([awaiting], { isToday: true, nowMs: NOW_MS }), "payment_needed");
    assert.notEqual(parentWeekDayKind([awaiting], { isToday: false, nowMs: NOW_MS }), "completed");
  });

  it("4. multiple Study Halls in the current week scan Monday–Sunday", () => {
    const rows = [
      booking({
        id: "mon",
        status: "completed",
        scheduled_start: "2026-09-07T23:00:00.000Z",
        scheduled_end: "2026-09-08T00:00:00.000Z",
      }),
      booking({ id: "wed" }),
      booking({
        id: "fri",
        scheduled_start: "2026-09-11T23:00:00.000Z",
        scheduled_end: "2026-09-12T00:00:00.000Z",
      }),
    ];
    const days = parentWeekStrip(rows, TZ, NOW_MS);
    assert.equal(days.length, 7);
    assert.equal(days[0].weekdayShort, "Mon");
    assert.equal(days[6].weekdayShort, "Sun");
    assert.equal(days[0].kind, "completed");
    assert.equal(days[2].kind, "today");
    assert.equal(days[4].kind, "scheduled");
    assert.equal(days[5].kind, "none");
    const completion = parentWeekCompletion(rows, TZ, NOW_MS);
    assert.equal(completion.completed, 1);
    assert.equal(completion.scheduled, 3);
    assert.match(parentWeekCompletionCopy(completion).headline, /1 of 3 scheduled Study Halls completed this week/);
  });

  it("5. empty week copy encourages planning", () => {
    const completion = parentWeekCompletion([], TZ, NOW_MS);
    assert.equal(completion.empty, true);
    assert.match(parentWeekCompletionCopy(completion).headline, /No Study Halls this week yet/);
    const week = read("src/components/dashboard/parent-study-hall-week.tsx");
    assert.match(week, /book one Study Hall/);
    assert.match(week, /Plan my week/);
  });

  it("zero-completed week copy names the calendar, not a 0 of N score", () => {
    const copy = parentWeekCompletionCopy({ scheduled: 5, completed: 0 });
    assert.equal(copy.headline, "5 Study Halls on the calendar this week.");
    assert.equal(copy.body, "The week is on the calendar.");
  });

  it("6. Plan my week is a contextual CTA, not a sixth nav item", () => {
    const ctas = parentHomeCtas();
    assert.equal(ctas.primary.href, PLAN_MY_WEEK_HREF);
    assert.equal(ctas.primary.label, "Plan my week");
    assert.equal(PARENT_PORTAL_NAV.length, 5);
    assert.equal(
      PARENT_PORTAL_NAV.some((item) => item.href === PLAN_MY_WEEK_HREF),
      false,
    );
    assert.match(read("src/components/dashboard/parent-home-board.tsx"), /ParentStudyHallWeek/);
  });

  it("7. Book One Study Hall remains accessible", () => {
    const ctas = parentHomeCtas();
    assert.equal(ctas.secondary.href, "/dashboard/student/book");
    assert.match(read("src/app/dashboard/student/book/page.tsx"), /BookingWizard/);
    assert.match(read("src/components/dashboard/customer-shell.tsx"), /\/dashboard\/student\/book/);
    assert.match(read("src/components/dashboard/parent-study-halls.tsx"), /Book one Study Hall/);
  });

  it("8. 365 entitled household presents membership calmly", () => {
    const mem = parseParentMembership({
      membership: {
        entitled: true,
        customer_status: "active",
        cancel_at_period_end: false,
        current_period_end: "2026-10-01T00:00:00.000Z",
      },
    });
    const view = parentMembershipPresentation(mem, TZ);
    assert.equal(mem.entitled, true);
    assert.equal(view.title, "Study Hall 365");
    assert.equal(view.status, "Active");
    assert.match(view.detail, /One Study Hall per day/);
    assert.match(read("src/lib/parent-week.mjs"), /Study Hall 365/);
  });

  it("9. cancel_at_period_end keeps access through the paid period", () => {
    const mem = parseParentMembership({
      membership: {
        entitled: true,
        customer_status: "cancels_at_period_end",
        cancel_at_period_end: true,
        current_period_end: "2026-09-20T05:00:00.000Z",
      },
    });
    const view = parentMembershipPresentation(mem, TZ);
    assert.equal(mem.cancelAtPeriodEnd, true);
    assert.match(view.detail, /Access continues through/);
    assert.doesNotMatch(JSON.stringify(mem), /sub_|cus_|price_/);
  });

  it("10. non-365 household uses prepaid funding copy", () => {
    const funding = parentHomeFundingCopy({ entitled365: false, minutes: 360 });
    assert.equal(funding.kind, "prepaid");
    assert.match(funding.line, /6 Study Halls remaining/);
    const ctas = parentHomeCtas({ entitled365: false });
    assert.equal(ctas.fundingKind, "prepaid");
    assert.equal(ctas.showBuyHours, true);
  });

  it("11. free trial available is surfaced until consumed", () => {
    const ctas = parentHomeCtas({ freeTrialAvailable: true });
    assert.equal(ctas.primary.label, "Book free session");
    assert.equal(ctas.showFreeTrial, true);
    const funding = parentHomeFundingCopy({ freeTrialAvailable: true });
    assert.match(funding.line, /first Study Hall is on us/);
  });

  it("12. free trial consumed is not advertised", () => {
    const ctas = parentHomeCtas({ freeTrialAvailable: false });
    assert.notEqual(ctas.primary.label, "Book free session");
    assert.equal(ctas.showFreeTrial, false);
    const status = read("src/components/dashboard/parent-household-status.tsx");
    assert.match(status, /freeTrialAvailable && funding\.kind === "free_trial"/);
  });

  it("13–14. prepaid remaining vs zero prepaid", () => {
    assert.match(parentHomeFundingCopy({ minutes: 180 }).line, /3 Study Halls remaining/);
    const zero = parentHomeFundingCopy({ minutes: 0 });
    assert.equal(zero.showZeroPrepaid, true);
    assert.match(zero.line, /Pay as you go is \$12/);
    const memberZero = parentHomeFundingCopy({ entitled365: true, minutes: 0 });
    assert.equal(memberZero.showZeroPrepaid, false);
    assert.equal(memberZero.line, null);
  });

  it("15. account credit is surfaced without ledger jargon", () => {
    const funding = parentHomeFundingCopy({ minutes: 60, creditCents: 2500 });
    assert.equal(funding.creditCents, 2500);
    const status = read("src/components/dashboard/parent-household-status.tsx");
    assert.match(status, /Account credit/);
    assert.doesNotMatch(status, /ledger|gross_cents|funding_source/);
  });

  it("16. 365 CTAs emphasize Plan/Book, never Buy hours on Home", () => {
    const member = parentHomeCtas({ entitled365: true, freeTrialAvailable: true });
    assert.equal(member.primary.label, "Plan my week");
    assert.equal(member.secondary.label, "Book a Study Hall");
    assert.equal(member.showBuyHours, false);
    const board = read("src/components/dashboard/parent-home-board.tsx");
    assert.doesNotMatch(board, /Buy hours|BalanceCards/);
    const offer = parentPostSessionOffer({
      bookings: [
        booking({
          id: "free",
          is_free_trial: true,
          status: "completed",
          scheduled_start: "2026-08-01T00:00:00Z",
          scheduled_end: "2026-08-01T01:00:00Z",
        }),
        booking({
          id: "paid",
          is_free_trial: false,
          status: "completed",
          scheduled_start: "2026-09-01T00:00:00Z",
          scheduled_end: "2026-09-01T01:00:00Z",
        }),
      ],
      minutes: 0,
      entitled365: true,
      nowMs: NOW_MS,
    });
    assert.equal(offer.showBuyHours, false);
  });

  it("17–19. reports and recordings stay on the dedicated destination", () => {
    const reports = read("src/app/dashboard/student/reports/page.tsx");
    const recent = read("src/components/dashboard/parent-recent-activity.tsx");
    assert.match(reports, /Reports &amp; Recordings|Reports & Recordings/);
    assert.match(reports, /No report yet/);
    assert.match(reports, /No recording yet/);
    assert.match(reports, /Reports and recordings appear here after a completed Study Hall/);
    assert.match(recent, /Report ready/);
    assert.match(recent, /Recording ready|parentRecordingHomeLabel/);
    assert.doesNotMatch(reports, /error occurred|failed to load recording/i);
  });

  it("20. upcoming/past/cancelled Study Hall lists remain partitioned", () => {
    const lists = parentStudyHallLists(
      [
        booking({ id: "up" }),
        booking({
          id: "done",
          status: "completed",
          scheduled_start: "2026-09-01T23:00:00.000Z",
          scheduled_end: "2026-09-02T00:00:00.000Z",
        }),
        booking({
          id: "cx",
          status: "cancelled",
          scheduled_start: "2026-09-02T23:00:00.000Z",
          scheduled_end: "2026-09-03T00:00:00.000Z",
        }),
      ],
      NOW_MS,
    );
    assert.deepEqual(lists.upcoming.map((b) => b.id), ["up"]);
    assert.deepEqual(lists.past.map((b) => b.id), ["done"]);
    assert.deepEqual(lists.cancelled.map((b) => b.id), ["cx"]);
  });

  it("21. mobile shell keeps Logout and five destinations without crowding Book/Plan", () => {
    const shell = read("src/components/dashboard/customer-shell.tsx");
    assert.match(shell, /LogoutButton/);
    assert.match(shell, /item\.shortLabel/);
    assert.match(shell, /flex-wrap/);
    assert.doesNotMatch(shell, /overflow-x-auto/);
    const header = shell.slice(shell.indexOf("<header"), shell.indexOf("<main"));
    assert.doesNotMatch(header, /\/dashboard\/student\/plan-week/);
    assert.doesNotMatch(header, /\/dashboard\/student\/book/);
    assert.match(shell, /shortLabel: "Reports"|item\.shortLabel/);
    assert.equal(PARENT_PORTAL_NAV.find((i) => i.href.includes("reports"))?.shortLabel, "Reports");
    assert.equal(PARENT_PORTAL_NAV.find((i) => i.href.includes("reports"))?.label, "Reports & Recordings");
  });

  it("22. Plan My Week is not a sixth primary nav item", () => {
    assert.deepEqual(
      PARENT_PORTAL_NAV.map((i) => i.label),
      ["Home", "Study Halls", "Reports & Recordings", "Hours", "Account"],
    );
  });

  it("23. Parent-facing copy does not reintroduce tutoring language", () => {
    const surfaces = [
      "src/app/dashboard/student/page.tsx",
      "src/components/dashboard/parent-home-board.tsx",
      "src/components/dashboard/parent-next-study-hall.tsx",
      "src/components/dashboard/parent-study-hall-week.tsx",
      "src/components/dashboard/parent-household-status.tsx",
      "src/app/dashboard/student/packages/page.tsx",
      "src/app/dashboard/student/reports/page.tsx",
      "src/app/dashboard/student/account/page.tsx",
      "src/lib/parent-week.mjs",
    ]
      .map(read)
      .join("\n");
    assert.doesNotMatch(surfaces, /tutor tutoring session|Book a tutor|tutoring session|lesson\b/i);
    assert.doesNotMatch(surfaces, /\btutor\b(?!_display_name)/i);
  });

  it("24. Book One booking flow is unchanged", () => {
    const book = read("src/app/dashboard/student/book/page.tsx");
    const wizard = read("src/components/booking/booking-wizard.tsx");
    assert.match(book, /BookingWizard/);
    assert.match(book, /\/api\/checkout\/booking|Every Study Hall is 60 minutes/);
    assert.match(wizard, /fetch\("\/api\/checkout\/booking"/);
    assert.match(wizard, /Every Study Hall is 60 minutes|duration/);
  });

  it("25. Plan My Week flow is unchanged", () => {
    const page = read("src/app/dashboard/student/plan-week/page.tsx");
    const ui = read("src/components/dashboard/plan-my-week.tsx");
    const service = read("src/lib/plan-week-service.ts");
    assert.match(page, /PlanMyWeek/);
    assert.match(ui, /fetch\("\/api\/plan-week"/);
    assert.match(service, /createBookingCheckout/);
    assert.match(ui, /Schedule My Week/);
  });

  it("Hours acknowledges 365 instead of pretending the household must buy hours", () => {
    const hours = read("src/app/dashboard/student/packages/page.tsx");
    assert.match(hours, /entitled365/);
    assert.match(hours, /Daily membership covers your regular Study Hall/);
    assert.match(hours, /Extra same-day Study Halls/);
    assert.match(hours, /No prepaid Study Halls on file/);
    assert.match(hours, /PackageStore/);
    assert.match(hours, /id="prepaid"/);
  });

  it("does not invent backend booking or funding logic", () => {
    const week = read("src/lib/parent-week.mjs");
    assert.match(week, /Read-model only/);
    assert.doesNotMatch(week, /book_session|createBookingCheckout|consume_study_hall_365/);
    assert.match(read("src/lib/parent-portal-data.ts"), /get_study_hall_365_membership/);
  });
});
