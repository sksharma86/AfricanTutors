import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  durationOptionPriceLabel,
  isFullyPrepaidQuote,
  prepaidCoversDuration,
  remainingBalanceMinutes,
} from "../src/lib/booking-prepaid-display.mjs";
import { formatDuration } from "../src/lib/format.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Prepaid booking UX — duration cards & confirm display (pure)", () => {
  it("14 hr balance covers 1/2/3 hr options with Uses … of your balance labels", () => {
    const bal = 14 * 60; // 840 minutes
    assert.equal(prepaidCoversDuration(bal, 60), true);
    assert.equal(prepaidCoversDuration(bal, 120), true);
    assert.equal(prepaidCoversDuration(bal, 180), true);

    assert.equal(durationOptionPriceLabel(bal, 60, "$12"), "Uses 1 hr of your balance");
    assert.equal(durationOptionPriceLabel(bal, 120, "$24"), "Uses 2 hr of your balance");
    assert.equal(durationOptionPriceLabel(bal, 180, "$36"), "Uses 3 hr of your balance");
  });

  it("1 hr balance + 2 hr option keeps PAYG cash price ($24)", () => {
    assert.equal(prepaidCoversDuration(60, 120), false);
    assert.equal(durationOptionPriceLabel(60, 120, "$24"), "$24");
    assert.equal(durationOptionPriceLabel(60, 60, "$12"), "Uses 1 hr of your balance");
  });

  it("fully prepaid quote drives $0 due messaging helpers", () => {
    assert.equal(isFullyPrepaidQuote({ package_minutes_used: 60, stripe_cents_due: 0 }), true);
    assert.equal(isFullyPrepaidQuote({ package_minutes_used: 0, stripe_cents_due: 0 }), false);
    assert.equal(isFullyPrepaidQuote({ package_minutes_used: 60, stripe_cents_due: 1200 }), false);
    assert.equal(remainingBalanceMinutes(840, 60), 780);
    assert.equal(formatDuration(remainingBalanceMinutes(840, 60)), "13 hr");
  });

  it("partial prepaid rule is unchanged in helpers (no partial cover)", () => {
    assert.equal(prepaidCoversDuration(90, 120), false);
    assert.equal(durationOptionPriceLabel(90, 120, "$24"), "$24");
  });
});

describe("Prepaid booking UX — wizard wiring (source)", () => {
  const wiz = read("src/components/booking/booking-wizard.tsx");
  const helper = read("src/lib/booking-prepaid-display.mjs");

  it("wizard uses prepaid display helpers for duration cards and confirm CTA", () => {
    assert.match(wiz, /durationOptionPriceLabel/);
    assert.match(wiz, /isFullyPrepaidQuote/);
    assert.match(wiz, /remainingBalanceMinutes/);
    assert.match(wiz, /Confirm with prepaid hours/);
    assert.match(wiz, /Covered by prepaid balance/);
    assert.match(wiz, /No payment required\. Your card will not be charged\./);
    assert.match(wiz, /Hours after booking/);
    assert.match(helper, /Uses \$\{formatDuration/);
  });

  it("success path still says prepaid hours; free trial and Stripe CTAs preserved", () => {
    assert.match(wiz, /confirmed using your prepaid Study Hall Hours/);
    assert.match(wiz, /Confirm booking/);
    assert.match(wiz, /First 1-hour Study Hall — FREE/);
    assert.match(wiz, /secure checkout to pay the amount due/);
  });

  it("date/time step uses day strip without nested all-days scroll trap", () => {
    assert.match(wiz, /Choose a date &amp; time|Choose a date & time/);
    assert.match(wiz, /Available dates/);
    assert.doesNotMatch(wiz, /max-h-96/);
  });

  it("does not alter financial RPCs or Stripe checkout in this change set", () => {
    assert.match(wiz, /booking_quote/);
    assert.match(wiz, /\/api\/checkout\/booking/);
    // Helper is presentation-only (no RPC / Stripe client calls).
    assert.doesNotMatch(helper, /\.rpc\(|checkout\.sessions|createCheckout|fetch\(/);
  });
});
