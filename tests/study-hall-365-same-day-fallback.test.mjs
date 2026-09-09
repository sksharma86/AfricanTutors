import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { evaluateStudyHall365Day, chooseBookingSource } from "../src/lib/study-hall-365/entitlement.mjs";
import { localDateForInstant } from "../src/lib/study-hall-365/calendar.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const sqlBody = (sql) => sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

const m38 = read("supabase/migrations/0038_one_hour_booking_engine.sql");
const m40 = read("supabase/migrations/0040_same_day_365_funding_fallback.sql");
const quote = m38;
const wizard = read("src/components/booking/booking-wizard.tsx");
const checkout = read("src/lib/checkout-service.ts");
const planApi = read("src/app/api/plan-week/route.ts");
const planService = read("src/lib/plan-week-service.ts");
const planUi = read("src/components/dashboard/plan-my-week.tsx");

describe("Same-day 365 extra Study Hall — intended hierarchy", () => {
  it("1. unused 365 day is chosen before prepaid and PAYG", () => {
    const day = evaluateStudyHall365Day({
      status: "active",
      periodStart: "2026-09-01T05:00:00.000Z",
      periodEnd: "2026-10-01T05:00:00.000Z",
      timeZone: "America/Chicago",
      localDate: "2026-09-21",
      bookingStart: "2026-09-21T21:00:00.000Z",
      consumed: false,
    });
    assert.equal(day.entitled, true);
    assert.equal(day.reason, "available");
    assert.equal(
      chooseBookingSource({
        freeTrialEligible: false,
        studyHall365: day,
        prepaidMinutes: 600,
      }).source,
      "study_hall_365",
    );
  });

  it("2. consumed 365 day with prepaid available uses prepaid", () => {
    const day = evaluateStudyHall365Day({
      status: "active",
      periodStart: "2026-09-01T05:00:00.000Z",
      periodEnd: "2026-10-01T05:00:00.000Z",
      timeZone: "America/Chicago",
      localDate: "2026-09-21",
      bookingStart: "2026-09-21T22:00:00.000Z",
      consumed: true,
    });
    assert.equal(day.entitled, false);
    assert.equal(day.reason, "already_consumed");
    assert.equal(
      chooseBookingSource({
        freeTrialEligible: false,
        studyHall365: day,
        prepaidMinutes: 600,
      }).source,
      "prepaid",
    );
  });

  it("3. consumed 365 day without prepaid still allows credit/PAYG in the engine, not a 365 abort", () => {
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
        studyHall365: { entitled: false, reason: "already_consumed" },
        prepaidMinutes: 0,
      }).source,
      "payg",
    );
    assert.match(quote, /v_credit_used := least\(greatest\(v_credit, 0\), v_price\)/);
    assert.match(m40, /v_funding := 'credit'/);
    assert.match(m40, /v_funding_source := 'payg'/);
  });

  it("4–5. second same-day booking is not rejected as a 365 duplicate; PAYG remains the last source", () => {
    assert.match(m38, /This day is already included with Study Hall 365/);
    assert.doesNotMatch(sqlBody(m40), /This day is already included with Study Hall 365/);
    assert.doesNotMatch(sqlBody(m40), /Study Hall 365 is not available for that time/);
    assert.doesNotMatch(sqlBody(m40), /raise exception.*365/i);
    assert.match(m40, /Keep this booking and fund it/);
    assert.match(m40, /Do not raise; do not consume 365/);
  });

  it("6. next local day is a new 365 entitlement", () => {
    const next = evaluateStudyHall365Day({
      status: "active",
      periodStart: "2026-09-01T05:00:00.000Z",
      periodEnd: "2026-10-01T05:00:00.000Z",
      timeZone: "America/Chicago",
      localDate: "2026-09-22",
      bookingStart: "2026-09-22T21:00:00.000Z",
      consumed: false,
    });
    assert.equal(next.entitled, true);
    assert.equal(next.reason, "available");
  });

  it("7. timezone midnight uses the booking start's local date, not UTC truncation", () => {
    assert.match(m40, /v_local := \(p_start at time zone v_tz\)::date/);
    assert.match(m40, /resolve_account_timezone/);
    const chicagoLate = localDateForInstant("2026-09-22T04:30:00.000Z", "America/Chicago");
    assert.equal(chicagoLate, "2026-09-21");
    const chicagoEarly = localDateForInstant("2026-09-22T05:30:00.000Z", "America/Chicago");
    assert.equal(chicagoEarly, "2026-09-22");
  });

  it("8. concurrent same-day attempts cannot both consume 365", () => {
    const block = m40.indexOf("lock membership");
    const lockIdx = m40.indexOf("for update", block);
    const createIdx = m40.indexOf("v_booking_id := public.create_booking", lockIdx);
    const consumeIdx = m40.indexOf("insert into public.study_hall_365_day_usage", createIdx);
    assert.ok(lockIdx > 0 && lockIdx < createIdx && createIdx < consumeIdx);
    assert.match(m40, /on conflict \(account_id, local_date\) do nothing/);
    assert.match(m40, /select id into v_consumed_id/);
  });

  it("9. Plan My Week inherits engine funding and does not decide 365 fallback itself", () => {
    assert.match(planService, /createBookingCheckout/);
    assert.match(planApi, /schedulePlanWeek/);
    assert.doesNotMatch(planService, /study_hall_365_day_usage|chooseBookingSource|already_consumed/);
    assert.doesNotMatch(planUi, /consume_study_hall_365|chooseBookingSource/);
    assert.doesNotMatch(planApi, /booking_quote/);
  });

  it("10. the booking wizard inherits the same book_session / booking_quote path", () => {
    assert.match(wizard, /booking_quote/);
    assert.match(wizard, /p_start: selectedSlot/);
    assert.match(wizard, /fetch\("\/api\/checkout\/booking"/);
    assert.match(checkout, /book_session/);
    assert.doesNotMatch(wizard, /study_hall_365_day_usage/);
  });
});

describe("0040 book_session privileges", () => {
  it("revokes public/anon and grants execute only to authenticated and service_role", () => {
    assert.match(m40, /revoke all on function public\.book_session[\s\S]*from public/);
    assert.match(m40, /revoke all on function public\.book_session[\s\S]*from anon/);
    assert.match(
      m40,
      /grant execute on function public\.book_session[\s\S]*to authenticated, service_role/,
    );
  });
});
