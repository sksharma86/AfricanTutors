import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatDuration, formatMoneyCents } from "../src/lib/format.mjs";
import { customerBookingStatus, issueStatus } from "../src/lib/status-labels.mjs";
import { customerJoinState } from "../src/lib/session-window.mjs";
import { packageEconomics } from "../src/lib/packages.mjs";
import { accountFreeTrialUsed } from "../src/lib/free-trial.mjs";

describe("Phase 8 — money & duration formatting", () => {
  it("renders account credit with two decimals", () => {
    assert.equal(formatMoneyCents(2400), "$24.00");
    assert.equal(formatMoneyCents(0), "$0.00");
    assert.equal(formatMoneyCents(1999), "$19.99");
    assert.equal(formatMoneyCents(700), "$7.00");
  });

  it("renders Study Hall balance as human hours/minutes", () => {
    assert.equal(formatDuration(510), "8 hr 30 min");
    assert.equal(formatDuration(60), "1 hr");
    assert.equal(formatDuration(120), "2 hr");
    assert.equal(formatDuration(30), "30 min");
    assert.equal(formatDuration(90), "1 hr 30 min");
    assert.equal(formatDuration(0), "0 min");
  });
});

describe("Phase 8 — customer status language (no raw enums)", () => {
  it("maps booking states to polished labels + tones", () => {
    assert.deepEqual(customerBookingStatus("confirmed"), { label: "Confirmed", tone: "positive" });
    assert.deepEqual(customerBookingStatus("confirmed", "awaiting_payment"), { label: "Awaiting payment", tone: "warning" });
    assert.deepEqual(customerBookingStatus("pending", "awaiting_payment"), { label: "Awaiting payment", tone: "warning" });
    assert.deepEqual(customerBookingStatus("pending"), { label: "Awaiting confirmation", tone: "warning" });
    assert.deepEqual(customerBookingStatus("completed"), { label: "Completed", tone: "neutral" });
    assert.deepEqual(customerBookingStatus("cancelled"), { label: "Cancelled", tone: "neutral" });
    assert.deepEqual(customerBookingStatus("no_show"), { label: "Missed session", tone: "danger" });
    assert.deepEqual(customerBookingStatus("expired"), { label: "Booking expired", tone: "neutral" });
  });

  it("never leaks a raw snake_case enum for any booking status", () => {
    for (const s of ["pending", "confirmed", "completed", "cancelled", "no_show", "expired"]) {
      const { label } = customerBookingStatus(s);
      assert.ok(!/_/.test(label), `label for ${s} contains underscore: ${label}`);
      assert.notEqual(label, s);
    }
  });

  it("maps issue/dispute states to support-friendly labels", () => {
    assert.deepEqual(issueStatus("open"), { label: "Received", tone: "info" });
    assert.deepEqual(issueStatus("under_review"), { label: "Under review", tone: "warning" });
    assert.deepEqual(issueStatus("resolved"), { label: "Resolved", tone: "positive" });
    // "denied" must not surface as litigation language.
    assert.deepEqual(issueStatus("denied"), { label: "Reviewed", tone: "neutral" });
    for (const s of ["open", "under_review", "resolved", "denied"]) {
      assert.ok(!/_/.test(issueStatus(s).label));
    }
  });
});

describe("Phase 8 — customer join-state presentation", () => {
  const base = Date.parse("2026-03-01T12:00:00Z");
  it("a pending booking never offers Join", () => {
    assert.equal(customerJoinState("pending", new Date(base + 60000).toISOString(), new Date(base + 3660000).toISOString(), base).state, "not_joinable");
  });
  it("a confirmed booking with no time is 'not_scheduled'", () => {
    assert.equal(customerJoinState("confirmed", null, null, base).state, "not_scheduled");
  });
  it("confirmed but well before start explains when it opens (5 min lead)", () => {
    const start = new Date(base + 30 * 60000).toISOString();
    const end = new Date(base + 90 * 60000).toISOString();
    const r = customerJoinState("confirmed", start, end, base);
    assert.equal(r.state, "opens_at");
    assert.equal(r.openAtISO, new Date(base + 25 * 60000).toISOString());
  });
  it("confirmed within the 5-minute pre-start window is joinable", () => {
    const start = new Date(base + 3 * 60000).toISOString(); // opens in 2 min (start-5)
    const end = new Date(base + 63 * 60000).toISOString();
    assert.equal(customerJoinState("confirmed", start, end, base).state, "join");
  });
  it("confirmed more than 5 minutes before start is not yet joinable", () => {
    const start = new Date(base + 6 * 60000).toISOString();
    const end = new Date(base + 66 * 60000).toISOString();
    assert.equal(customerJoinState("confirmed", start, end, base).state, "opens_at");
  });
  it("confirmed long after end has ended", () => {
    const start = new Date(base - 2 * 86400000).toISOString();
    const end = new Date(base - 2 * 86400000 + 3600000).toISOString();
    assert.equal(customerJoinState("confirmed", start, end, base).state, "ended");
  });
});

describe("Phase 8 — package economics (rate & savings vs $12/hr)", () => {
  it("computes hours, effective hourly rate, and savings for 14h / 28h", () => {
    const p14 = packageEconomics(840, 14000);
    assert.equal(p14.hours, 14);
    assert.equal(p14.effectiveHourlyCents, 1000);
    assert.equal(p14.savingsCents, 2800); // 14*$12 - $140

    const p28 = packageEconomics(1680, 25200);
    assert.equal(p28.hours, 28);
    assert.equal(p28.effectiveHourlyCents, 900);
    assert.equal(p28.savingsCents, 8400); // 28*$12 - $252
  });

  it("never shows negative savings", () => {
    assert.equal(packageEconomics(60, 3000).savingsCents, 0);
  });
});

describe("Phase 8 — free-trial CTA is account-scoped", () => {
  it("shows the CTA only until the account's one trial is used", () => {
    // No bookings → eligible.
    assert.equal(accountFreeTrialUsed([]), false);
    // A non-cancelled free trial (any student) → account has used it.
    assert.equal(accountFreeTrialUsed([{ is_free_trial: true, status: "confirmed", student_id: "a" }]), true);
    // Adding another student (with a paid session, no trial) does NOT restore it.
    assert.equal(
      accountFreeTrialUsed([
        { is_free_trial: true, status: "completed", student_id: "a" },
        { is_free_trial: false, status: "confirmed", student_id: "b" },
      ]),
      true,
    );
    // A cancelled trial does not count as used (matches server semantics).
    assert.equal(accountFreeTrialUsed([{ is_free_trial: true, status: "cancelled" }]), false);
    // A paid session alone never counts as a used trial.
    assert.equal(accountFreeTrialUsed([{ is_free_trial: false, status: "confirmed" }]), false);
  });
});
