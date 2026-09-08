import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { localDateForInstant } from "../src/lib/study-hall-365/calendar.mjs";
import {
  COPY_NEXT_WEEK_LOCAL_DAYS,
  PLAN_WEEK_MAX_OFFSET,
  collectCopySourceSessions,
  formatCopyToNextWeekMessage,
  planCopyToNextWeek,
  planningWeek,
  shiftLocalInstantByDays,
} from "../src/lib/plan-my-week.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const TZ = "America/Chicago";
/** Monday Sep 7 2026 10:00 AM Chicago (CDT). */
const NOW = new Date("2026-09-07T15:00:00.000Z");
const NOW_MS = NOW.getTime();
const WED_4PM = "2026-09-09T21:00:00.000Z";
const THU_4PM = "2026-09-10T21:00:00.000Z";
const FRI_5PM = "2026-09-11T22:00:00.000Z";
const NEXT_WED_4PM = "2026-09-16T21:00:00.000Z";
const NEXT_THU_4PM = "2026-09-17T21:00:00.000Z";
const NEXT_FRI_5PM = "2026-09-18T22:00:00.000Z";
const MON_8AM = "2026-09-07T13:00:00.000Z";
const NEXT_MON_8AM = "2026-09-14T13:00:00.000Z";

function thisWeekDays(now = NOW) {
  return planningWeek(TZ, now, 0).days;
}

describe("Copy to next week — local +7 mapping", () => {
  it("maps different local weekday times by 7 civil days, not UTC +168 hours", () => {
    assert.equal(COPY_NEXT_WEEK_LOCAL_DAYS, 7);
    assert.equal(shiftLocalInstantByDays(WED_4PM, 7, TZ), NEXT_WED_4PM);
    assert.equal(shiftLocalInstantByDays(THU_4PM, 7, TZ), NEXT_THU_4PM);
    assert.equal(shiftLocalInstantByDays(FRI_5PM, 7, TZ), NEXT_FRI_5PM);
    assert.equal(localDateForInstant(NEXT_WED_4PM, TZ), "2026-09-16");
    assert.equal(localDateForInstant(NEXT_THU_4PM, TZ), "2026-09-17");
    assert.equal(localDateForInstant(NEXT_FRI_5PM, TZ), "2026-09-18");
  });

  it("keeps 6:00 PM local across the 2026 spring-forward DST boundary", () => {
    const satBefore = "2026-03-08T00:00:00.000Z"; // Sat Mar 7 6:00 PM CST
    const shifted = shiftLocalInstantByDays(satBefore, 7, TZ);
    assert.equal(localDateForInstant(shifted, TZ), "2026-03-14");
    assert.equal(shifted, "2026-03-14T23:00:00.000Z"); // Sat Mar 14 6:00 PM CDT
    const naive = new Date(new Date(satBefore).getTime() + 168 * 3600_000).toISOString();
    assert.notEqual(shifted, naive);
  });

  it("keeps 6:00 PM local across the 2026 fall-back DST boundary", () => {
    const satBefore = "2026-10-31T23:00:00.000Z"; // Sat Oct 31 6:00 PM CDT
    const shifted = shiftLocalInstantByDays(satBefore, 7, TZ);
    assert.equal(localDateForInstant(shifted, TZ), "2026-11-07");
    assert.equal(shifted, "2026-11-08T00:00:00.000Z"); // Sat Nov 7 6:00 PM CST
    const naive = new Date(new Date(satBefore).getTime() + 168 * 3600_000).toISOString();
    assert.notEqual(shifted, naive);
  });
});

describe("Copy to next week — source, merge, availability", () => {
  it("copies this-week drafts as next-week drafts without booking", () => {
    const result = planCopyToNextWeek({
      weekOffset: 0,
      drafts: { "2026-09-09": WED_4PM, "2026-09-10": THU_4PM, "2026-09-11": FRI_5PM },
      slotStarts: [NEXT_WED_4PM, NEXT_THU_4PM, NEXT_FRI_5PM],
      timeZone: TZ,
      nowMs: NOW_MS,
    });
    assert.equal(result.ok, true);
    assert.equal(result.copied.length, 3);
    assert.deepEqual(result.drafts, {
      "2026-09-16": NEXT_WED_4PM,
      "2026-09-17": NEXT_THU_4PM,
      "2026-09-18": NEXT_FRI_5PM,
    });
    assert.match(result.message, /3 Study Halls copied to next week/);
    assert.match(result.message, /Review to schedule them/);
    assert.doesNotMatch(result.message, /booked|scheduled them/i);
  });

  it("skips an unavailable destination time and still copies the rest", () => {
    const result = planCopyToNextWeek({
      weekOffset: 0,
      drafts: { "2026-09-09": WED_4PM, "2026-09-10": THU_4PM },
      slotStarts: [NEXT_WED_4PM],
      timeZone: TZ,
      nowMs: NOW_MS,
    });
    assert.equal(result.copied.length, 1);
    assert.equal(result.copied[0].startISO, NEXT_WED_4PM);
    assert.equal(result.skipped.length, 1);
    assert.equal(result.skipped[0].status, "unavailable");
    assert.match(result.skipped[0].message, /unavailable/);
    assert.match(result.message, /1 Study Hall copied to next week/);
    assert.match(result.message, /1 time was unavailable/);
    assert.equal(result.drafts["2026-09-17"], undefined);
  });

  it("skips a destination day that already has a booking", () => {
    const result = planCopyToNextWeek({
      weekOffset: 0,
      drafts: { "2026-09-09": WED_4PM },
      bookings: [{ id: "next-wed", status: "confirmed", scheduled_start: NEXT_WED_4PM }],
      slotStarts: [NEXT_WED_4PM],
      timeZone: TZ,
      nowMs: NOW_MS,
    });
    assert.equal(result.copied.length, 0);
    assert.equal(result.skipped[0].status, "already_scheduled");
    assert.deepEqual(result.drafts, {});
  });

  it("does not overwrite an existing next-week draft", () => {
    const result = planCopyToNextWeek({
      weekOffset: 0,
      drafts: {
        "2026-09-09": WED_4PM,
        "2026-09-16": "2026-09-16T22:00:00.000Z",
      },
      slotStarts: [NEXT_WED_4PM, "2026-09-16T22:00:00.000Z"],
      timeZone: TZ,
      nowMs: NOW_MS,
    });
    assert.equal(result.copied.length, 0);
    assert.equal(result.skipped[0].status, "draft_exists");
    assert.equal(result.drafts["2026-09-16"], undefined);
    assert.match(result.message, /already had a next-week time/);
  });

  it("is a no-op when this week has nothing copyable", () => {
    const result = planCopyToNextWeek({
      weekOffset: 0,
      bookings: [{ id: "old", status: "cancelled", scheduled_start: WED_4PM }],
      drafts: {},
      slotStarts: [NEXT_WED_4PM],
      timeZone: TZ,
      nowMs: NOW_MS,
    });
    assert.equal(result.copied.length, 0);
    assert.equal(result.skipped.length, 0);
    assert.match(result.message, /Nothing to copy/);
  });

  it("ignores cancelled source Study Halls and copies remaining active ones", () => {
    const sources = collectCopySourceSessions({
      bookings: [
        { id: "gone", status: "cancelled", scheduled_start: WED_4PM },
        { id: "live", status: "confirmed", scheduled_start: THU_4PM },
      ],
      thisWeekDays: thisWeekDays(),
      timeZone: TZ,
    });
    assert.deepEqual(
      sources.map((row) => row.startISO),
      [THU_4PM],
    );
  });

  it("copies a current-day session and a past-day time pattern when next week is free", () => {
    const wedMorning = new Date("2026-09-09T15:00:00.000Z").getTime();
    const result = planCopyToNextWeek({
      weekOffset: 0,
      bookings: [
        { id: "past-mon", status: "confirmed", scheduled_start: MON_8AM },
        { id: "later-today", status: "confirmed", scheduled_start: WED_4PM },
      ],
      slotStarts: [NEXT_MON_8AM, NEXT_WED_4PM],
      timeZone: TZ,
      nowMs: wedMorning,
    });
    assert.equal(result.copied.length, 2);
    assert.equal(result.drafts["2026-09-14"], NEXT_MON_8AM);
    assert.equal(result.drafts["2026-09-16"], NEXT_WED_4PM);
  });

  it("uses a pending Change time instead of the original when copying that day", () => {
    const sources = collectCopySourceSessions({
      bookings: [{ id: "b1", status: "confirmed", scheduled_start: WED_4PM }],
      replacements: { b1: FRI_5PM },
      thisWeekDays: thisWeekDays(),
      timeZone: TZ,
    });
    assert.equal(sources[0].kind, "replacement");
    assert.equal(sources[0].startISO, FRI_5PM);
  });

  it("second copy with existing destination drafts does not overwrite (duplicate-click)", () => {
    const first = planCopyToNextWeek({
      weekOffset: 0,
      drafts: { "2026-09-09": WED_4PM, "2026-09-10": THU_4PM },
      slotStarts: [NEXT_WED_4PM, NEXT_THU_4PM],
      timeZone: TZ,
      nowMs: NOW_MS,
    });
    const second = planCopyToNextWeek({
      weekOffset: 0,
      drafts: { "2026-09-09": WED_4PM, "2026-09-10": THU_4PM, ...first.drafts },
      slotStarts: [NEXT_WED_4PM, NEXT_THU_4PM],
      timeZone: TZ,
      nowMs: NOW_MS,
    });
    assert.equal(first.copied.length, 2);
    assert.equal(second.copied.length, 0);
    assert.equal(second.skipped.length, 2);
    assert.ok(second.skipped.every((row) => row.status === "draft_exists"));
    assert.deepEqual(second.drafts, {});
  });

  it("is inapplicable while already viewing next week", () => {
    const result = planCopyToNextWeek({
      weekOffset: 1,
      drafts: { "2026-09-09": WED_4PM },
      slotStarts: [NEXT_WED_4PM],
      timeZone: TZ,
      nowMs: NOW_MS,
    });
    assert.equal(result.ok, false);
    assert.equal(result.inapplicable, true);
    assert.deepEqual(result.drafts, {});
    assert.match(result.message, /this week/);
  });
});

describe("Copy to next week — stays a Plan My Week convenience", () => {
  it("does not expand the this-week + next-week horizon", () => {
    assert.equal(PLAN_WEEK_MAX_OFFSET, 1);
    const ui = read("src/components/dashboard/plan-my-week.tsx");
    const helper = read("src/lib/plan-my-week.mjs");
    assert.match(helper, /PLAN_WEEK_MAX_OFFSET = 1/);
    assert.match(ui, /Copy to next week/);
    assert.match(ui, /weekOffset !== 0/);
    assert.match(ui, /planCopyToNextWeek/);
    assert.doesNotMatch(ui, /PLAN_WEEK_MAX_OFFSET\s*=\s*[2-9]/);
  });

  it("does not change BOOKING_HORIZON_DAYS or invent availability/funding", () => {
    const bookingConfig = read("src/lib/booking-config.ts");
    assert.match(bookingConfig, /BOOKING_HORIZON_DAYS = 21/);
    const helper = read("src/lib/plan-my-week.mjs");
    const ui = read("src/components/dashboard/plan-my-week.tsx");
    const service = read("src/lib/plan-week-service.ts");
    const wizard = read("src/components/booking/booking-wizard.tsx");
    const bookingApi = read("src/app/api/checkout/booking/route.ts");
    assert.match(helper, /slotsForLocalDate/);
    assert.match(helper, /canScheduleStart/);
    assert.doesNotMatch(helper, /computeGuideAvailability|chooseBookingSource|consume_study_hall_365/);
    assert.match(ui, /get_available_slots/);
    assert.doesNotMatch(ui, /from\("bookings"\)\.insert/);
    assert.match(service, /createBookingCheckout/);
    assert.match(ui, /fetch\("\/api\/plan-week"/);
    assert.match(wizard, /fetch\("\/api\/checkout\/booking"/);
    assert.doesNotMatch(wizard, /planCopyToNextWeek|Copy to next week/);
    assert.doesNotMatch(bookingApi, /replaceBookingId|planCopyToNextWeek/);
  });

  it("parent copy message never claims the sessions are already booked", () => {
    const mixed = formatCopyToNextWeekMessage(4, [
      { status: "unavailable" },
      { status: "draft_exists" },
    ]);
    assert.match(mixed, /4 Study Halls copied to next week/);
    assert.match(mixed, /Review to schedule them/);
    assert.match(mixed, /1 time was unavailable/);
    assert.match(mixed, /already had a next-week time/);
  });
});
