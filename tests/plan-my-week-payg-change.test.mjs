import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { bookingsByLocalDate, isActiveWeekBooking } from "../src/lib/plan-my-week.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const m41 = read("supabase/migrations/0041_booking_replacement_finalization.sql");
const checkout = read("src/lib/checkout-service.ts");
const planService = read("src/lib/plan-week-service.ts");
const webhook = read("src/app/api/stripe/webhook/route.ts");
const bookingApi = read("src/app/api/checkout/booking/route.ts");
const returnView = read("src/app/checkout/return/return-view.tsx");

describe("PAYG Change replacement lifecycle", () => {
  it("1. immediately funded Change books new first, then finalizes/cancels old", () => {
    assert.match(checkout, /replaceBookingId/);
    assert.match(checkout, /finalize_booking_replacement/);
    assert.match(planService, /replaceBookingId: session.replaceBookingId/);
    assert.match(planService, /!paymentPending/);
    assert.match(m41, /finalize_booking_replacement/);
  });

  it("2. PAYG Change records durable replacement and does not cancel on checkout create", () => {
    assert.match(checkout, /attach_booking_replacement/);
    assert.match(checkout, /replaces_booking_id/);
    assert.match(m41, /bookings\.replaces_booking_id/);
    const attachIdx = checkout.indexOf("attach_booking_replacement");
    const stripeIdx = checkout.indexOf("checkout.sessions.create");
    assert.ok(attachIdx > 0 && attachIdx < stripeIdx);
    assert.match(planService, /Your current session stays scheduled until then/);
  });

  it("3. abandoned/expired replacement must not cancel the original in fulfillment", () => {
    assert.match(m41, /'status', 'credited'/);
    assert.doesNotMatch(
      m41,
      /credited_cents',\s*v_paid\);\s*v_result := public\.finalize_booking_replacement/,
    );
    assert.match(webhook, /cancel_pending_payment/);
    assert.doesNotMatch(webhook, /finalize_booking_replacement/);
  });

  it("4–5. successful payment and duplicate webhook finalize once via fulfill_booking_payment", () => {
    assert.match(m41, /already_fulfilled/);
    assert.match(m41, /finalize_booking_replacement\(v_pay.booking_id\)/);
    assert.match(m41, /finalize_booking_replacement\(v_bk.id\)/);
    assert.match(webhook, /bookings.replaces_booking_id/);
  });

  it("6. already-cancelled original does not fail new fulfillment", () => {
    assert.match(m41, /already_cancelled/);
    assert.match(m41, /v_old.status not in \('pending', 'confirmed'\)/);
  });

  it("7–8. cancellation uses existing restore references; 365 usage is not restored", () => {
    assert.match(m41, /restore_booking_value/);
    assert.match(m41, /cancel:pkg:|customer cancellation 24h\+/);
    assert.doesNotMatch(m41, /study_hall_365_day_usage/);
    assert.match(m41, /on conflict \(reference\) do nothing/);
  });

  it("9. Plan My Week refresh hides cancelled sessions and keeps pending holds", () => {
    assert.equal(isActiveWeekBooking({ status: "confirmed", scheduled_start: "2026-09-23T17:00:00Z" }), true);
    assert.equal(isActiveWeekBooking({ status: "pending", scheduled_start: "2026-09-23T19:00:00Z" }), true);
    assert.equal(isActiveWeekBooking({ status: "cancelled", scheduled_start: "2026-09-23T17:00:00Z" }), false);
    const map = bookingsByLocalDate(
      [
        { id: "old", status: "cancelled", scheduled_start: "2026-09-23T17:00:00Z" },
        { id: "neu", status: "confirmed", scheduled_start: "2026-09-23T19:00:00Z" },
      ],
      "America/Chicago",
    );
    const day = map.get("2026-09-23") ?? [];
    assert.deepEqual(day.map((row) => row.id), ["neu"]);
  });

  it("10. ordinary booking checkout is not a Change", () => {
    assert.doesNotMatch(bookingApi, /replaceBookingId/);
    assert.match(returnView, /\/api\/checkout\/status/);
    assert.doesNotMatch(returnView, /customer_cancel_booking|finalize_booking_replacement|replaceBookingId/);
  });
});

describe("0041 replacement privileges", () => {
  it("does not rewrite 0040 and grants attach/finalize to authenticated + service_role", () => {
    assert.doesNotMatch(m41, /create or replace function public.book_session/);
    assert.match(m41, /grant execute on function public.attach_booking_replacement/);
    assert.match(m41, /grant execute on function public.finalize_booking_replacement/);
    assert.match(m41, /revoke all on function public.attach_booking_replacement[\s\S]*from anon/);
  });
});
