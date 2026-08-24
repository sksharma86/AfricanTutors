import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  PACKAGE_14H_MINUTES,
  PACKAGE_14H_PRICE_CENTS,
  PACKAGE_28H_MINUTES,
  PACKAGE_28H_PRICE_CENTS,
  STANDARD_HOURLY_CENTS,
  packageBadge,
  packageEconomics,
} from "../src/lib/packages.mjs";
import { adminClient, hasSupabaseEnv } from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const pricingSrc = read("src/lib/pricing.ts");

describe("Study Hall PR2 — authoritative client pricing constants", () => {
  it("pay-as-you-go is 60 minutes at $12", () => {
    assert.match(pricingSrc, /PAYG_MINUTES = 60/);
    assert.match(pricingSrc, /PAYG_PRICE_USD = 12/);
    assert.match(pricingSrc, /minutes:\s*60,\s*priceUsd:\s*12/);
  });

  it("30-minute paid support remains at $12", () => {
    assert.match(pricingSrc, /minutes:\s*30,\s*priceUsd:\s*12/);
  });

  it("14h package is $140 / 840 minutes ($10/hr); 28h is $252 / 1680 ($9/hr)", () => {
    assert.equal(PACKAGE_14H_MINUTES, 840);
    assert.equal(PACKAGE_14H_PRICE_CENTS, 14000);
    assert.equal(PACKAGE_28H_MINUTES, 1680);
    assert.equal(PACKAGE_28H_PRICE_CENTS, 25200);

    const p14 = packageEconomics(PACKAGE_14H_MINUTES, PACKAGE_14H_PRICE_CENTS);
    assert.equal(p14.hours, 14);
    assert.equal(p14.effectiveHourlyCents, 1000);
    assert.equal(p14.savingsCents, 14 * STANDARD_HOURLY_CENTS - 14000);

    const p28 = packageEconomics(PACKAGE_28H_MINUTES, PACKAGE_28H_PRICE_CENTS);
    assert.equal(p28.hours, 28);
    assert.equal(p28.effectiveHourlyCents, 900);
    assert.equal(p28.savingsCents, 28 * STANDARD_HOURLY_CENTS - 25200);
  });

  it("standard hourly comparison rate is $12/hr and badges mark primary packages", () => {
    assert.equal(STANDARD_HOURLY_CENTS, 1200);
    assert.equal(packageBadge(840), "MOST POPULAR");
    assert.equal(packageBadge(1680), "BEST VALUE");
    assert.equal(packageBadge(600), null);
  });

  it("customer-facing copy no longer claims recurring billing will never exist", () => {
    const surfaces = [
      "src/components/marketing/pricing-section.tsx",
      "src/app/(marketing)/pricing/page.tsx",
      "src/app/dashboard/student/packages/page.tsx",
      "src/components/marketing/why-african-tutors.tsx",
    ].map(read).join("\n");
    assert.doesNotMatch(surfaces, /No subscriptions|no recurring billing|not a subscription/i);
  });

  it("PR2 migration kept free-trial at 30 minutes (superseded later by PR3)", () => {
    const migration = read("supabase/migrations/0020_studyhall_pr2_pricing.sql");
    assert.match(migration, /free trial is 30 minutes only/i);
    assert.doesNotMatch(migration, /free trial is 60 minutes/i);
    const sqlBody = migration
      .split("\n")
      .filter((line) => !/^\s*--/.test(line))
      .join("\n");
    assert.doesNotMatch(sqlBody, /comp_rate|stripe.?connect|auto_?refill|subscription/i);
  });
});

describe("Study Hall PR2 — live pricing authority", { skip: !hasSupabaseEnv }, () => {
  const svc = adminClient();
  const ANY = "00000000-0000-0000-0000-000000000001";

  it("1. 60-minute paid Study Hall quotes exactly $12", async () => {
    const q = await svc.rpc("booking_quote", { p_account: ANY, p_duration: 60, p_is_free_trial: false });
    assert.equal(q.error, null, q.error?.message);
    assert.equal(q.data.session_price_cents, 1200);
    assert.equal(q.data.stripe_cents_due, 1200);
  });

  it("2–5. Active packages are exactly 14h/$140 and 28h/$252", async () => {
    const { data, error } = await svc
      .from("package_products")
      .select("code, minutes, price_cents, is_active")
      .eq("is_active", true)
      .order("sort_order");
    assert.equal(error, null, error?.message);
    const rows = (data ?? []).map((r) => [r.code, r.minutes, r.price_cents]);
    assert.deepEqual(rows, [
      ["pkg_14h", 840, 14000],
      ["pkg_28h", 1680, 25200],
    ]);
  });

  it("6. Dollar account credit applies correctly against the $12 session", async () => {
    const q = await svc.rpc("booking_quote", { p_account: ANY, p_duration: 60, p_is_free_trial: false });
    assert.equal(q.data.session_price_cents, 1200);
    // With no credit on the sentinel account, full Stripe due is the session price.
    assert.equal(q.data.credit_cents_used, 0);
    assert.equal(q.data.stripe_cents_due, 1200);
  });

  it("10–11. Historical package rows remain; free-trial quote stays $0", async () => {
    const { data: old } = await svc
      .from("package_products")
      .select("code, minutes, price_cents, is_active")
      .in("code", ["pkg_10h", "pkg_20h", "pkg_40h"])
      .order("code");
    assert.equal((old ?? []).length, 3, "historical 10/20/40h rows preserved");
    for (const row of old ?? []) {
      assert.equal(row.is_active, false, `${row.code} must be inactive for new purchases`);
    }
    assert.deepEqual(
      Object.fromEntries((old ?? []).map((r) => [r.code, [r.minutes, r.price_cents]])),
      { pkg_10h: [600, 19000], pkg_20h: [1200, 36000], pkg_40h: [2400, 68000] },
    );

    const qf = await svc.rpc("booking_quote", { p_account: ANY, p_duration: 60, p_is_free_trial: true });
    assert.equal(qf.error, null, qf.error?.message);
    assert.equal(qf.data.session_price_cents, 0);
    assert.equal(qf.data.stripe_cents_due, 0);
    assert.equal(qf.data.funding, "free_trial");
  });
});
