import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";

import { localDateForInstant } from "../src/lib/study-hall-365/calendar.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const sqlBody = (sql) => sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

const m36 = read("supabase/migrations/0036_study_hall_365.sql");
const m40 = read("supabase/migrations/0040_same_day_365_funding_fallback.sql");
const m41 = read("supabase/migrations/0041_booking_replacement_finalization.sql");
const m42 = read("supabase/migrations/0042_same_day_365_replacement_transfer.sql");
const checkout = read("src/lib/checkout-service.ts");
const bookingApi = read("src/app/api/checkout/booking/route.ts");
const wizard = read("src/components/booking/booking-wizard.tsx");
const planApi = read("src/app/api/plan-week/route.ts");
const planService = read("src/lib/plan-week-service.ts");
const planUi = read("src/components/dashboard/plan-my-week.tsx");
const docs = read("docs/study-hall-booking-engine.md");
const throwaway = read("scripts/setup-study-hall-booking-throwaway-db.sh");
const live = read("tests/study-hall-booking-engine-pg-live.test.mjs");

describe("0042 same-day 365 / free-trial replacement transfer", () => {
  it("1–6. same-local-day Change stays study_hall_365 with one usage row and no PAYG", () => {
    assert.match(m36, /booking_id\s+uuid references public\.bookings/);
    assert.match(m36, /unique \(account_id, local_date\)/);
    assert.match(m42, /p_replaces_booking_id uuid default null/);
    assert.match(m42, /and booking_id = p_replaces_booking_id/);
    assert.match(m42, /set booking_id = v_booking_id/);
    assert.match(m42, /funding_source = 'study_hall_365'/);
    assert.match(m42, /'stripe_cents_due', 0/);
    assert.match(sqlBody(m42), /package_minutes_used', 0[\s\S]*credit_cents_used', 0[\s\S]*stripe_cents_due', 0/);
    const transferIdx = m42.indexOf("CASE B");
    const stripeDueIdx = m42.indexOf("'stripe_cents_due', 0", transferIdx);
    const prepaidIdx = m42.indexOf("v_funding := 'package'", transferIdx);
    assert.ok(transferIdx > 0 && stripeDueIdx > transferIdx && stripeDueIdx < prepaidIdx);
    assert.match(docs, /CASE B/);
    assert.match(live, /CASE B: same-local-day 365 Change/);
    assert.match(live, /no prepaid\/credit\/PAYG/);
  });

  it("7. ordinary additional same-day session still falls through (0040)", () => {
    assert.match(m40, /Keep this booking and fund it/);
    assert.match(m40, /Do not raise; do not consume 365/);
    assert.match(m42, /Unique day lost after create_booking/);
    assert.match(docs, /CASE A/);
    assert.match(live, /CASE A: additional same-day session still falls through/);
    assert.doesNotMatch(planService, /study_hall_365_day_usage|chooseBookingSource|already_consumed/);
  });

  it("8. concurrent same-day replacements cannot both remain 365-covered", () => {
    assert.match(m42, /for update/);
    assert.match(m42, /and booking_id = p_replaces_booking_id/);
    assert.match(m42, /The current session is no longer scheduled/);
    assert.match(live, /concurrent replacements cannot both stay 365/);
    assert.match(live, /spawnBook\(c2, .*raceOld\)/);
  });

  it("9. different local date does not transfer the old day's usage", () => {
    assert.match(m42, /CASE C/);
    assert.match(m42, /and local_date = v_local/);
    assert.match(m42, /and booking_id = p_replaces_booking_id/);
    assert.match(docs, /The old day's usage is not transferred/);
    assert.match(live, /CASE C uses independent dates/);
    assert.match(live, /count\(\*\) from study_hall_365_day_usage where account_id='\$\{p2\}'.*2/);
  });

  it("10. local dates use the account timezone, including midnight", () => {
    assert.match(m42, /v_local := \(p_start at time zone v_tz\)::date/);
    assert.match(m42, /resolve_account_timezone/);
    assert.equal(localDateForInstant("2026-10-08T04:00:00.000Z", "America/Chicago"), "2026-10-07");
    assert.equal(localDateForInstant("2026-10-08T03:00:00.000Z", "America/Chicago"), "2026-10-07");
    assert.equal(localDateForInstant("2026-10-08T05:30:00.000Z", "America/Chicago"), "2026-10-08");
    assert.match(live, /honors timezone midnight/);
  });

  it("11. duplicate replacement finalization stays idempotent", () => {
    assert.match(m41, /already_cancelled/);
    assert.match(m42, /v_new.replaces_booking_id is not distinct from p_old_booking/);
    assert.match(live, /finalize_booking_replacement\('\$\{newId\}'/);
    assert.match(live, /already_cancelled/);
  });

  it("12. another household cannot take a 365 usage row via replacement", () => {
    assert.match(m42, /Not authorized to replace this session/);
    assert.match(m42, /v_replace_old.account_id is distinct from v_account/);
    assert.match(m42, /and booking_id = p_replaces_booking_id/);
    assert.match(live, /unauthorized household cannot steal 365 usage/);
  });

  it("13. free-trial Change stays free_trial and does not consume another source", () => {
    assert.match(m42, /coalesce\(v_replace_old.is_free_trial, false\)/);
    assert.match(m42, /funding_source = 'free_trial'/);
    const trialIdx = m42.indexOf("Free-trial Change");
    const prepaidIdx = m42.indexOf("v_funding := 'package'");
    assert.ok(trialIdx > 0 && trialIdx < prepaidIdx);
    assert.match(live, /free-trial Change stays free_trial/);
    assert.match(docs, /The replacement stays `free_trial`/);
  });

  it("14–15. Plan My Week does not decide funding; wizard checkout is unchanged", () => {
    assert.match(planService, /replaceBookingId: session.replaceBookingId/);
    assert.match(planService, /createBookingCheckout/);
    assert.doesNotMatch(planService, /p_replaces_booking_id|study_hall_365_day_usage|chooseBookingSource/);
    assert.doesNotMatch(planUi, /funding_source|study_hall_365_day_usage/);
    assert.doesNotMatch(planApi, /booking_quote|study_hall_365_day_usage/);
    assert.doesNotMatch(bookingApi, /replaceBookingId/);
    assert.match(wizard, /fetch\("\/api\/checkout\/booking"/);
    assert.doesNotMatch(wizard, /replaceBookingId|p_replaces_booking_id/);
  });

  it("passes p_replaces_booking_id into book_session before Stripe Checkout", () => {
    const parseIdx = checkout.indexOf("params.replaceBookingId");
    const rpcIdx = checkout.indexOf('rpc("book_session"');
    const stripeIdx = checkout.indexOf("checkout.sessions.create");
    assert.ok(parseIdx > 0 && parseIdx < rpcIdx && rpcIdx < stripeIdx);
    assert.match(checkout, /p_replaces_booking_id:\s*replaceBookingId/);
    assert.match(checkout, /same-day 365 \/ free-trial/);
  });

  it("drops the 8-arg book_session and grants only the 9-arg form", () => {
    assert.match(
      m42,
      /drop function if exists public\.book_session\(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid\[\]\)/,
    );
    assert.match(
      m42,
      /grant execute on function public\.book_session\(uuid, uuid, text, text, integer, timestamp with time zone, boolean, uuid\[\], uuid\)/,
    );
    assert.match(m42, /revoke all on function public\.book_session[\s\S]*from public/);
    assert.match(m42, /revoke all on function public\.book_session[\s\S]*from anon/);
    assert.match(throwaway, /0042_same_day_365_replacement_transfer\.sql/);
    const files = readdirSync(new URL("../supabase/migrations", import.meta.url).pathname);
    assert.equal(files.some((name) => name.startsWith("0042")), true);
    assert.equal(existsSync(new URL("../supabase/migrations/0042_same_day_365_replacement_transfer.sql", import.meta.url)), true);
    assert.doesNotMatch(m41, /create or replace function public.book_session/);
  });
});
