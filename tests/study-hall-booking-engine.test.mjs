import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { chooseBookingSource, evaluateStudyHall365Day } from "../src/lib/study-hall-365/entitlement.mjs";
import {
  customerFundingLabel,
  formatPrepaidStudyHallBalance,
} from "../src/lib/study-hall-funding-copy.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("PR3 booking engine — duration", () => {
  const migration = read("supabase/migrations/0038_one_hour_booking_engine.sql");
  const api = read("src/app/api/checkout/booking/route.ts");
  const wizard = read("src/components/booking/booking-wizard.tsx");
  const bookPage = read("src/app/dashboard/student/book/page.tsx");
  const cards = read("src/components/dashboard/single-session-cards.tsx");

  it("new customer Study Halls are 60 minutes only", () => {
    const pricing = read("src/lib/pricing.ts");
    assert.match(pricing, /STUDY_HALL_DURATIONS: StudyHallDuration\[\] = \[60\]/);
    assert.match(pricing, /minutes: 60, priceUsd: 12/);
    assert.doesNotMatch(pricing, /minutes:\s*120,\s*priceUsd:\s*24/);
    assert.match(pricing, /n === 60/);
    assert.match(pricing, /isHistoricalStudyHallDuration/);
  });

  it("server and SQL reject non-60 customer Study Halls", () => {
    assert.match(migration, /Study Hall sessions are 60 minutes/);
    assert.match(api, /Study Hall sessions are 60 minutes/);
    assert.match(api, /duration != null/);
    assert.match(bookPage, /Duration query params cannot create a longer booking/);
    assert.match(migration, /get_available_slots/);
    assert.match(migration, /p_subject_id is null and p_duration is distinct from 60/);
    assert.doesNotMatch(wizard, /setDuration|Choose a session|2 hours|3 hours/);
    assert.doesNotMatch(cards, /duration=\$\{|Book 2 hours|Book 3 hours/);
  });
});

describe("PR3 booking engine — funding priority", () => {
  it("uses free first, then 365, then prepaid, then PAYG", () => {
    assert.equal(
      chooseBookingSource({
        freeTrialEligible: true,
        studyHall365: { entitled: true, reason: "available" },
        prepaidMinutes: 600,
      }).source,
      "free_trial",
    );
    assert.equal(
      chooseBookingSource({
        freeTrialEligible: false,
        studyHall365: { entitled: true, reason: "available" },
        prepaidMinutes: 600,
      }).source,
      "study_hall_365",
    );
    assert.equal(
      chooseBookingSource({
        freeTrialEligible: false,
        studyHall365: { entitled: false, reason: "already_consumed" },
        prepaidMinutes: 600,
      }).source,
      "prepaid",
    );
    assert.equal(
      chooseBookingSource({
        freeTrialEligible: false,
        studyHall365: { entitled: false, reason: "already_consumed" },
        prepaidMinutes: 0,
      }).source,
      "payg",
    );
  });

  it("labels funding in customer language", () => {
    assert.equal(customerFundingLabel("free_trial"), "First Study Hall free");
    assert.equal(customerFundingLabel("study_hall_365"), "Included with Study Hall 365");
    assert.equal(customerFundingLabel("prepaid"), "Uses 1 prepaid Study Hall");
    assert.equal(customerFundingLabel("payg"), "$12");
    assert.equal(formatPrepaidStudyHallBalance(540), "9 Study Halls remaining");
    assert.equal(formatPrepaidStudyHallBalance(420), "7 Study Halls remaining");
    assert.equal(formatPrepaidStudyHallBalance(90), "1 Study Hall + 30 leftover minutes");
    assert.equal(formatPrepaidStudyHallBalance(20), "20 leftover minutes");
  });
});

describe("PR3 booking engine — 365 contract", () => {
  it("books then consumes in one RPC; cancel does not restore; consume loss falls through", () => {
    const m38 = read("supabase/migrations/0038_one_hour_booking_engine.sql");
    const m40 = read("supabase/migrations/0040_same_day_365_funding_fallback.sql");
    assert.match(m40, /create_booking\(/);
    assert.match(m40, /insert into public.study_hall_365_day_usage/);
    const body40 = m40.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(body40, /This day is already included with Study Hall 365/);
    assert.doesNotMatch(body40, /Study Hall 365 is not available for that time/);
    assert.doesNotMatch(body40, /raise exception.*365/i);
    const block = m40.indexOf("lock membership");
    const lockIdx = m40.indexOf("for update", block);
    const createIdx = m40.indexOf("v_booking_id := public.create_booking", lockIdx);
    const consumeIdx = m40.indexOf("insert into public.study_hall_365_day_usage", createIdx);
    assert.ok(lockIdx > 0 && createIdx > lockIdx && consumeIdx > createIdx);
    assert.match(m40, /if v_booking_id is null then/);
    assert.match(m40, /funding_source = 'study_hall_365'/);
    assert.match(m40, /get_study_hall_365_entitlement\(v_account, v_local, now\(\), p_start\)/);
    const m42 = read("supabase/migrations/0042_same_day_365_replacement_transfer.sql");
    assert.match(m42, /p_replaces_booking_id/);
    assert.match(m42, /set booking_id = v_booking_id/);
    assert.match(m38, /This day is already included with Study Hall 365/);
    assert.match(read("docs/study-hall-booking-engine.md"), /Cancel does not restore the 365 day/);
    assert.match(read("docs/study-hall-booking-engine.md"), /prepaid, then credit, then PAYG/);
    assert.match(read("docs/study-hall-booking-engine.md"), /Prepaid \/ credit \/ PAYG/);
  });

  it("start outside the paid window is not 365", () => {
    const morning = evaluateStudyHall365Day({
      status: "active",
      periodStart: "2026-09-17T16:00:00.000Z",
      periodEnd: "2026-10-17T16:00:00.000Z",
      timeZone: "America/Chicago",
      localDate: "2026-09-17",
      bookingStart: "2026-09-17T10:00:00.000Z",
    });
    assert.equal(morning.reason, "booking_outside_paid_window");
  });
});

describe("PR3 booking engine — security / authority", () => {
  const migration = read("supabase/migrations/0038_one_hour_booking_engine.sql");
  const checkout = read("src/lib/checkout-service.ts");
  const api = read("src/app/api/checkout/booking/route.ts");

  it("does not trust client funding, price, or duration", () => {
    assert.doesNotMatch(api, /funding_source|p_funding/);
    assert.match(checkout, /client never supplies an amount/);
    assert.match(checkout, /unit_amount: q.stripe_cents_due/);
    const m40 = read("supabase/migrations/0040_same_day_365_funding_fallback.sql");
    assert.match(m40, /Not authorized to book for this student/);
    assert.match(m40, /Guides cannot book parent Study Halls/);
    assert.match(m40, /debug_fail_after_funding/);
  });
});
