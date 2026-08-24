import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as T from "../src/lib/email/templates.mjs";

const APP = "https://app.africantutors.test";
const BID = "8f0be464-665a-49d9-8897-9f15adfe2806";
const ISO = "2026-08-20T20:30:00.000Z";

// No email should ever leak a Daily room/token or provider secret.
function assertNoLeaks(rendered) {
  const blob = `${rendered.subject}\n${rendered.html}\n${rendered.text}`.toLowerCase();
  for (const bad of ["daily.co", "token=", "start_cloud_recording", "meeting-token", "resend", "whsec_"]) {
    assert.ok(!blob.includes(bad), `email must not contain "${bad}"`);
  }
}

describe("Phase 6 — email templates (pure)", () => {
  it("session links point at the authenticated app route, never Daily", () => {
    assert.equal(T.sessionUrl(APP, BID), `${APP}/dashboard/session/${BID}`);
    const r = T.bookingConfirmed({ subject: "Algebra", whenISO: ISO, tz: "America/Chicago", durationMinutes: 60, tutorName: "Tomiwa", appUrl: APP, bookingId: BID });
    assert.ok(r.text.includes(`${APP}/dashboard/session/${BID}`), "join link present");
    assertNoLeaks(r);
  });

  it("free-trial confirmation emphasizes free + no card and has no leaks", () => {
    const r = T.bookingConfirmed({ isFreeTrial: true, subject: "Algebra", whenISO: ISO, tz: "UTC", durationMinutes: 30, tutorName: "Tomiwa", appUrl: APP, bookingId: BID });
    assert.match(r.text, /free 30-minute/i);
    assert.match(r.text, /no payment method/i);
    assertNoLeaks(r);
  });

  it("timezone rendering differs by recipient timezone (same instant)", () => {
    const chi = T.formatWhen(ISO, "America/Chicago");
    const lagos = T.formatWhen(ISO, "Africa/Lagos");
    assert.notEqual(chi, lagos, "customer and tutor see their own local time");
    assert.match(chi, /CDT|CST/);
  });

  it("reminders: 24h vs 1h subjects differ and include a safe join link", () => {
    const r24 = T.reminder({ role: "customer", kind: "24h", subject: "Algebra", whenISO: ISO, tz: "UTC", tutorName: "Tomiwa", appUrl: APP, bookingId: BID });
    const r1 = T.reminder({ role: "customer", kind: "1h", subject: "Algebra", whenISO: ISO, tz: "UTC", tutorName: "Tomiwa", appUrl: APP, bookingId: BID });
    assert.notEqual(r24.subject, r1.subject);
    assert.ok(r1.text.includes(`/dashboard/session/${BID}`));
    assertNoLeaks(r24);
    assertNoLeaks(r1);
    // tutor reminder shows student, not tutor-to-tutor contact
    const rt = T.reminder({ role: "tutor", kind: "1h", subject: "Algebra", whenISO: ISO, tz: "UTC", studentName: "Amara", appUrl: APP, bookingId: BID });
    assert.match(rt.text, /Student: Amara/);
  });

  it("refund vs account credit wording is distinct and correct", () => {
    const refund = T.refundIssued({ amountCents: 1300, reason: "duplicate charge" });
    assert.match(refund.text, /original payment method/i, "refund is a card/Stripe refund");
    assert.match(refund.text, /not account credit/i, "explicitly distinguishes from account credit");

    const resolved = T.disputeResolved({ resolution: "upheld", creditCents: 500, refundCents: 1000 });
    assert.match(resolved.text, /Account credit added: \$5/);
    assert.match(resolved.text, /original payment method/i);
  });

  it("cancellation email reflects early vs late outcome", () => {
    const early = T.cancellation({ early: true, restoredCreditCents: 1200 });
    assert.match(early.text, /returned to your account/i);
    assert.match(early.text, /\$12/);
    const late = T.cancellation({ early: false });
    assert.match(late.text, /non-refundable/i);
  });

  it("package purchase shows minutes, amount, and never-expire", () => {
    const r = T.packagePurchased({ minutes: 840, amountCents: 14000, balanceMinutes: 840, appUrl: APP });
    assert.match(r.text, /840/);
    assert.match(r.text, /\$140/);
    assert.match(r.text, /never expire/i);
  });
});
