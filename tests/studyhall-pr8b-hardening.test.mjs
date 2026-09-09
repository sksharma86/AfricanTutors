import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { parentJoinHint } from "../src/lib/parent-portal.mjs";
import {
  PLAN_WEEK_DURATION_MINUTES,
  PLAN_WEEK_MAX_OFFSET,
  canScheduleStart,
  isActiveWeekBooking,
  isWithinPlanningHorizon,
  normalizePlanWeekRequest,
  planningWeek,
} from "../src/lib/plan-my-week.mjs";
import { JOIN_OPEN_LEAD_MIN, customerJoinState } from "../src/lib/session-window.mjs";
import {
  CUSTOMER_PREPAID_OFFER_CODES,
  LEGACY_PREPAID_PACKAGE_CODES,
  PACKAGE_10SH_MINUTES,
  PACKAGE_10SH_PRICE_CENTS,
  PACKAGE_CODE_10_STUDY_HALLS,
  customerFacingPrepaidPackages,
} from "../src/lib/study-hall-365/catalog.mjs";
import {
  localDateForInstant,
  utcInstantForLocalParts,
} from "../src/lib/study-hall-365/calendar.mjs";
import { chooseBookingSource } from "../src/lib/study-hall-365/entitlement.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("PR8B — launch-critical suite is required, not skip-pass", () => {
  it("test:pr8b fails closed when Postgres is missing", () => {
    const pkg = read("package.json");
    const runner = read("scripts/run-pr8b-hardening.sh");
    const live = read("tests/studyhall-pr8b-adversarial-pg-live.test.mjs");
    assert.match(pkg, /"test:pr8b": "bash scripts\/run-pr8b-hardening\.sh"/);
    assert.match(runner, /pg_isready/);
    assert.match(runner, /STUDY_HALL_PR8B_REQUIRE_PG=1/);
    assert.match(runner, /Critical concurrency tests did not execute/);
    assert.match(live, /STUDY_HALL_PR8B_REQUIRE_PG/);
    assert.match(live, /Critical tests did not execute/);
    assert.match(live, /PR8B_PG_EXECUTED/);
  });
});

describe("PR8B — legacy prepaid cutover (new purchases only)", () => {
  it("0047 deactivates pkg_14h/pkg_28h without deleting history", () => {
    const m47 = read("supabase/migrations/0047_deactivate_legacy_prepaid_packages.sql");
    assert.match(m47, /pkg_14h/);
    assert.match(m47, /pkg_28h/);
    assert.match(m47, /is_active = false/);
    assert.doesNotMatch(m47, /delete from public\.package_products/i);
    assert.doesNotMatch(m47, /delete from public\.package_minute_ledger/i);
    assert.doesNotMatch(m47, /update public\.package_minute_ledger/i);
    assert.match(read("scripts/setup-study-hall-booking-throwaway-db.sh"), /0047_deactivate_legacy_prepaid_packages/);
    const purchase = read("supabase/migrations/0007_phase4b_checkout.sql");
    assert.match(purchase, /if not v_prod\.is_active then raise exception 'Package is not available'/);
  });

  it("Hours UI never re-offers legacy SKUs, even as fallback", () => {
    assert.deepEqual(CUSTOMER_PREPAID_OFFER_CODES, [PACKAGE_CODE_10_STUDY_HALLS]);
    assert.deepEqual(LEGACY_PREPAID_PACKAGE_CODES, ["pkg_14h", "pkg_28h"]);
    assert.equal(PACKAGE_10SH_MINUTES, 600);
    assert.equal(PACKAGE_10SH_PRICE_CENTS, 10000);
    const mixed = customerFacingPrepaidPackages([
      { code: "pkg_14h" },
      { code: "pkg_10sh" },
      { code: "pkg_28h" },
    ]);
    assert.deepEqual(mixed.map((p) => p.code), ["pkg_10sh"]);
    assert.deepEqual(
      customerFacingPrepaidPackages([{ code: "pkg_14h" }, { code: "pkg_28h" }]).map((p) => p.code),
      [],
    );
    const hours = read("src/app/dashboard/student/packages/page.tsx");
    assert.match(hours, /customerFacingPrepaidPackages/);
    assert.match(hours, /\.eq\("is_active", true\)/);
    const marketing = read("src/lib/marketing.ts");
    assert.match(marketing, /pkg-10sh/);
    assert.doesNotMatch(marketing, /pkg-14|pkg-28|14 Hour Routine|28 Hour Routine/);
  });
});

describe("PR8B — funding priority (UI cannot override)", () => {
  it("order is free trial → 365 → prepaid → credit → PAYG", () => {
    assert.equal(chooseBookingSource({ freeTrialEligible: true, prepaidMinutes: 600, creditCents: 5000 }).source, "free_trial");
    assert.equal(
      chooseBookingSource({
        freeTrialEligible: false,
        studyHall365: { entitled: true, reason: "available" },
        prepaidMinutes: 600,
        creditCents: 5000,
      }).source,
      "study_hall_365",
    );
    assert.equal(
      chooseBookingSource({
        freeTrialEligible: false,
        studyHall365: { entitled: false, reason: "already_consumed" },
        prepaidMinutes: 60,
        creditCents: 5000,
      }).source,
      "prepaid",
    );
    assert.equal(
      chooseBookingSource({
        freeTrialEligible: false,
        studyHall365: { entitled: false, reason: "already_consumed" },
        prepaidMinutes: 0,
        creditCents: 1200,
      }).source,
      "credit",
    );
    assert.equal(
      chooseBookingSource({
        freeTrialEligible: false,
        prepaidMinutes: 0,
        creditCents: 0,
      }).source,
      "payg",
    );
  });

  it("checkout API and wizard cannot supply funding_source", () => {
    const api = read("src/app/api/checkout/booking/route.ts");
    const checkout = read("src/lib/checkout-service.ts");
    const wizard = read("src/components/booking/booking-wizard.tsx");
    const planApi = read("src/app/api/plan-week/route.ts");
    assert.doesNotMatch(api, /p_funding|body\.funding/);
    assert.match(checkout, /client never supplies an amount/);
    assert.match(wizard, /book_session recomputes under locks/);
    assert.doesNotMatch(wizard, /chooseFunding|setFunding/);
    assert.doesNotMatch(planApi, /p_funding/);
    assert.match(read("docs/study-hall-booking-engine.md"), /free first Study Hall/);
    assert.match(read("docs/study-hall-booking-engine.md"), /Prepaid minutes/);
    assert.match(read("docs/study-hall-booking-engine.md"), /Account credit/);
  });
});

describe("PR8B — Plan My Week product scope", () => {
  const TZ = "America/Chicago";
  const NOW = new Date("2026-09-07T15:00:00.000Z");

  it("horizon is this week + next week, 60 minutes only", () => {
    assert.equal(PLAN_WEEK_MAX_OFFSET, 1);
    assert.equal(PLAN_WEEK_DURATION_MINUTES, 60);
    const week = planningWeek(TZ, NOW, 0);
    const next = planningWeek(TZ, NOW, 1);
    assert.equal(week.monday, "2026-09-07");
    assert.equal(next.sunday, "2026-09-20");
    assert.equal(planningWeek(TZ, NOW, 9).weekOffset, 1);
    assert.equal(isWithinPlanningHorizon("2026-09-21T21:00:00.000Z", TZ, NOW), false);
    const badDuration = normalizePlanWeekRequest({ duration: 120, sessions: [{ startISO: "2026-09-09T21:00:00.000Z" }] }, { timeZone: TZ, nowMs: NOW.getTime() });
    assert.equal(badDuration.ok, false);
  });

  it("cancelled/expired rows do not block; pending PAYG replacement stays source of truth", () => {
    assert.equal(isActiveWeekBooking({ status: "cancelled", scheduled_start: "2026-09-09T21:00:00.000Z" }), false);
    assert.equal(isActiveWeekBooking({ status: "expired", scheduled_start: "2026-09-09T21:00:00.000Z" }), false);
    assert.equal(isActiveWeekBooking({ status: "pending", scheduled_start: "2026-09-09T21:00:00.000Z" }), true);
    const existing = [{ id: "keep", status: "confirmed", scheduled_start: "2026-09-09T21:00:00.000Z" }];
    const result = normalizePlanWeekRequest(
      { duration: 60, sessions: [{ startISO: "2026-09-09T21:00:00.000Z" }] },
      { timeZone: TZ, nowMs: NOW.getTime(), existingBookings: existing },
    );
    assert.equal(result.ok, true);
    assert.equal(result.skipped[0].status, "already_scheduled");
    const afterCancel = normalizePlanWeekRequest(
      { duration: 60, sessions: [{ startISO: "2026-09-09T21:00:00.000Z" }] },
      {
        timeZone: TZ,
        nowMs: NOW.getTime(),
        existingBookings: [{ id: "old", status: "cancelled", scheduled_start: "2026-09-09T21:00:00.000Z" }],
      },
    );
    assert.equal(afterCancel.skipped.length, 0);
    assert.equal(afterCancel.sessions.length, 1);
  });

  it("partial success and clientRequestId coalescing stay in the orchestrator, not a second engine", () => {
    const service = read("src/lib/plan-week-service.ts");
    assert.match(service, /Partial success is intentional/);
    assert.match(service, /inflight/);
    assert.match(service, /clientRequestId/);
    assert.match(service, /createBookingCheckout/);
    assert.doesNotMatch(service, /chooseBookingSource|funding_source/);
    assert.match(service, /Your current session stays scheduled until then/);
    assert.equal(canScheduleStart("2026-09-09T21:00:00.000Z", TZ, NOW.getTime()), true);
  });
});

describe("PR8B — household timezone resolver", () => {
  it("Chicago / New York / Los Angeles civil dates ignore UTC midnight", () => {
    const utcMidnight = "2026-10-13T00:00:00.000Z";
    assert.equal(localDateForInstant(utcMidnight, "America/Chicago"), "2026-10-12");
    assert.equal(localDateForInstant(utcMidnight, "America/New_York"), "2026-10-12");
    assert.equal(localDateForInstant(utcMidnight, "America/Los_Angeles"), "2026-10-12");
    assert.equal(localDateForInstant(utcMidnight, "UTC"), "2026-10-13");
  });

  it("23:59 / 00:00 / 00:01 are household-local, not Guide-local", () => {
    for (const tz of ["America/Chicago", "America/New_York", "America/Los_Angeles"]) {
      const late = utcInstantForLocalParts(2026, 10, 12, 23, 59, 0, tz);
      const midnight = utcInstantForLocalParts(2026, 10, 12, 0, 0, 0, tz);
      const after = utcInstantForLocalParts(2026, 10, 12, 0, 1, 0, tz);
      assert.equal(localDateForInstant(late, tz), "2026-10-12", tz);
      assert.equal(localDateForInstant(midnight, tz), "2026-10-12", tz);
      assert.equal(localDateForInstant(after, tz), "2026-10-12", tz);
      const nextMinute = utcInstantForLocalParts(2026, 10, 13, 0, 0, 0, tz);
      assert.equal(localDateForInstant(nextMinute, tz), "2026-10-13", tz);
    }
    const chicagoEvening = utcInstantForLocalParts(2026, 10, 12, 18, 0, 0, "America/Chicago");
    assert.equal(localDateForInstant(chicagoEvening, "America/Chicago"), "2026-10-12");
    assert.equal(localDateForInstant(chicagoEvening, "Africa/Lagos"), "2026-10-13");
    const sql = read("supabase/migrations/0036_study_hall_365.sql");
    assert.match(sql, /create or replace function public\.resolve_account_timezone/);
    assert.match(sql, /from public\.profiles where id = p_account/);
    assert.doesNotMatch(sql, /tutor_profiles/);
    assert.match(read("docs/study-hall-booking-engine.md"), /does not redefine the household entitlement day/);
  });

  it("DST spring-forward and fall-back keep the household civil date", () => {
    assert.equal(localDateForInstant("2026-03-08T07:59:00.000Z", "America/Chicago"), "2026-03-08");
    assert.equal(localDateForInstant("2026-03-08T08:01:00.000Z", "America/Chicago"), "2026-03-08");
    assert.equal(localDateForInstant("2026-11-01T06:30:00.000Z", "America/Chicago"), "2026-11-01");
    assert.equal(localDateForInstant("2026-11-01T07:30:00.000Z", "America/Chicago"), "2026-11-01");
  });
});

describe("PR8B — Parent Join clock is client-side only", () => {
  it("ticks Join state without changing server authority", () => {
    const ctl = read("src/components/dashboard/parent-join-control.tsx");
    const next = read("src/components/dashboard/parent-next-study-hall.tsx");
    const detail = read("src/app/dashboard/student/study-halls/[bookingId]/page.tsx");
    const windowLib = read("src/lib/session-window.mjs");
    assert.match(ctl, /"use client"/);
    assert.match(ctl, /setInterval/);
    assert.match(ctl, /setTimeout/);
    assert.match(ctl, /JOIN_OPEN_LEAD_MIN/);
    assert.match(ctl, /authorize_session_join remains/);
    assert.match(next, /ParentJoinControl/);
    assert.match(detail, /ParentJoinControl/);
    assert.match(windowLib, /authorize_session_join/);
    assert.match(windowLib, /remains the sole/);
    const start = Date.parse("2026-10-20T18:00:00.000Z");
    const end = start + 60 * 60_000;
    const row = {
      status: "confirmed",
      scheduled_start: new Date(start).toISOString(),
      scheduled_end: new Date(end).toISOString(),
    };
    assert.equal(parentJoinHint(row, start - 6 * 60_000).state, "opens_at");
    assert.equal(parentJoinHint(row, start - JOIN_OPEN_LEAD_MIN * 60_000).state, "join");
    assert.equal(customerJoinState("confirmed", row.scheduled_start, row.scheduled_end, start).state, "join");
  });
});

describe("PR8B — throwaway overlap/expiry infrastructure", () => {
  it("throwaway extra restores household overlap, tutor gist exclusion, and hold expiry", () => {
    const extra = read("scripts/study-hall-booking-throwaway-extra.sql");
    assert.match(extra, /btree_gist/);
    assert.match(extra, /bookings_no_tutor_overlap/);
    assert.match(extra, /household_students_overlap/);
    assert.match(extra, /select exists/);
    assert.match(extra, /release_expired_holds/);
    assert.match(extra, /returns integer/);
    assert.match(extra, /status = 'expired'/);
  });
});

describe("PR8B — no production side effects in this slice", () => {
  it("does not start Stripe, Daily, or later PR8 slices", () => {
    const m47 = read("supabase/migrations/0047_deactivate_legacy_prepaid_packages.sql");
    assert.doesNotMatch(m47, /stripe|daily\.co|twilio|resend/i);
    assert.ok(existsSync(new URL("../tests/studyhall-pr8b-adversarial-pg-live.test.mjs", import.meta.url)));
    const live = read("tests/studyhall-pr8b-adversarial-pg-live.test.mjs");
    assert.doesNotMatch(live, /stripe\.checkout|daily\.co|Operation Dumbo|Galaxy 1/);
  });
});
