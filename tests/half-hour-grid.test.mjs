import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  assertHalfHourStart,
  ceilHalfHourClock,
  floorHalfHourClock,
  halfHourClockOptions,
  halfHourStartsInsideWindow,
  isHalfHourClock,
  isHalfHourInstant,
  HALF_HOUR_START_ERROR,
} from "../src/lib/half-hour-grid.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Half-hour grid — clock helpers", () => {
  it("offers only :00 and :30 options", () => {
    const opts = halfHourClockOptions();
    assert.equal(opts[0], "00:00");
    assert.equal(opts[1], "00:30");
    assert.equal(opts.at(-1), "23:30");
    assert.equal(opts.length, 48);
    assert.ok(opts.every(isHalfHourClock));
    assert.equal(opts.includes("13:44"), false);
  });

  it("accepts :00 / :30 and rejects arbitrary minutes", () => {
    assert.equal(isHalfHourClock("13:00"), true);
    assert.equal(isHalfHourClock("13:30:00"), true);
    assert.equal(isHalfHourClock("1:44"), false);
    assert.equal(isHalfHourClock("13:44"), false);
    assert.equal(isHalfHourClock("13:07"), false);
    assert.equal(isHalfHourClock("13:00:01"), false);
  });

  it("ceils legacy 1:44 forward to 2:00 without inventing 1:30", () => {
    assert.equal(ceilHalfHourClock("13:44"), "14:00");
    assert.equal(ceilHalfHourClock("13:00"), "13:00");
    assert.equal(ceilHalfHourClock("13:30"), "13:30");
    assert.equal(ceilHalfHourClock("13:01"), "13:30");
    assert.equal(ceilHalfHourClock("13:30:01"), "14:00");
    assert.equal(ceilHalfHourClock("23:44"), null);
  });

  it("floors the last possible start without expanding the window", () => {
    assert.equal(floorHalfHourClock("19:00"), "19:00");
    assert.equal(floorHalfHourClock("19:14"), "19:00");
    assert.equal(floorHalfHourClock("19:44"), "19:30");
  });
});

describe("Half-hour grid — candidate starts inside a window", () => {
  it(":00 availability produces :00/:30 starts that fit the duration", () => {
    assert.deepEqual(halfHourStartsInsideWindow("17:00", "19:00", 30), ["17:00", "17:30", "18:00", "18:30"]);
    assert.deepEqual(halfHourStartsInsideWindow("17:00", "19:00", 60), ["17:00", "17:30", "18:00"]);
  });

  it(":30 availability stays on the half-hour grid", () => {
    assert.deepEqual(halfHourStartsInsideWindow("17:30", "19:30", 60), ["17:30", "18:00", "18:30"]);
  });

  it("legacy 1:44 PM never yields a 1:44 start and snaps forward to 2:00 PM", () => {
    const slots = halfHourStartsInsideWindow("13:44", "20:00", 60);
    assert.equal(slots.includes("13:44"), false);
    assert.equal(slots.includes("13:30"), false);
    assert.equal(slots[0], "14:00");
    assert.deepEqual(
      slots,
      ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"],
    );
  });

  it("does not expand availability and only offers starts whose duration fits", () => {
    assert.deepEqual(halfHourStartsInsideWindow("13:44", "14:20", 60), []);
    assert.deepEqual(halfHourStartsInsideWindow("13:44", "15:00", 60), ["14:00"]);
    assert.deepEqual(halfHourStartsInsideWindow("13:44", "14:50", 60), []);
  });
});

describe("Half-hour grid — timezone display", () => {
  it("treats customer-facing local minutes, not raw UTC strings", () => {
    assert.equal(isHalfHourInstant("2026-08-28T18:00:00.000Z", "America/Chicago"), true);
    assert.equal(isHalfHourInstant("2026-08-28T18:30:00.000Z", "America/Chicago"), true);
    assert.equal(isHalfHourInstant("2026-08-28T18:14:00.000Z", "America/Chicago"), false);
    assert.equal(isHalfHourInstant("2026-08-28T18:00:00.000Z", "Africa/Lagos"), true);
    assert.throws(() => assertHalfHourStart("2026-08-28T18:14:00.000Z", ["America/Chicago"]), /half-hour/);
    assert.equal(HALF_HOUR_START_ERROR.includes(":00"), true);
  });
});

describe("Half-hour grid — UI and SQL wiring", () => {
  it("Guide availability UI only offers half-hour selects", () => {
    const avail = read("src/components/dashboard/availability-manager.tsx");
    assert.match(avail, /halfHourClockOptions/);
    assert.match(avail, /isHalfHourClock/);
    assert.match(avail, /Availability start/);
    assert.match(avail, /Availability end/);
    assert.doesNotMatch(avail, /type="time"/);
  });

  it("parent booking filters slots onto the local half-hour grid", () => {
    const wiz = read("src/components/booking/booking-wizard.tsx");
    assert.match(wiz, /isHalfHourInstant/);
    assert.match(wiz, /get_available_slots/);
  });

  it("SQL snaps candidate starts forward and rejects off-grid bookings", () => {
    const sql = read("supabase/migrations/0033_half_hour_scheduling_grid.sql");
    assert.match(sql, /timestamp_ceil_half_hour/);
    assert.match(sql, /timestamp_floor_half_hour/);
    assert.match(sql, /instant_is_on_half_hour_grid/);
    assert.match(sql, /enforce_booking_half_hour_start/);
    assert.match(sql, /enforce_availability_half_hour/);
    assert.doesNotMatch(sql, /days\.d \+ a\.start_time\)::timestamp,\s*\n\s*\(days\.d \+ a\.end_time\)/);
  });

  it("checkout and booking services reject off-grid starts before RPCs", () => {
    assert.match(read("src/lib/booking-service.ts"), /assertHalfHourStart/);
    assert.match(read("src/lib/checkout-service.ts"), /assertHalfHourStart/);
  });
});
