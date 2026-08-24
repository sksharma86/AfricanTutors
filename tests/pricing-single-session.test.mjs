import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { adminClient, hasSupabaseEnv } from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Pricing page — single sessions before packages", () => {
  const shell = read("src/components/dashboard/customer-shell.tsx");
  const cards = read("src/components/dashboard/single-session-cards.tsx");
  const page = read("src/app/dashboard/student/packages/page.tsx");
  const pricing = read("src/lib/pricing.ts");
  const wizard = read("src/components/booking/booking-wizard.tsx");
  const bookPage = read("src/app/dashboard/student/book/page.tsx");

  it("authenticated customer nav says 'Pricing', not 'Packages' (item 1)", () => {
    assert.match(shell, /label:\s*"Pricing"/);
    assert.doesNotMatch(shell, /label:\s*"Packages"/);
    // 'Sessions' item is unchanged.
    assert.match(shell, /label:\s*"Sessions"/);
  });

  it("single-session prices derive from the authoritative constant ($12 / $20) (items 2,3,9)", () => {
    assert.match(pricing, /minutes:\s*30,\s*priceUsd:\s*12/);
    assert.match(pricing, /minutes:\s*60,\s*priceUsd:\s*20/);
    // Cards derive from SESSION_OPTIONS, not hardcoded amounts.
    assert.match(cards, /SESSION_OPTIONS/);
    assert.doesNotMatch(cards, /\$\s?12\b|\$\s?20\b/); // no hardcoded dollar literal
    assert.doesNotMatch(cards, /\b1200\b|\b2000\b/); // no hardcoded cents literal
  });

  it("single-session section renders before prepaid packages (item 4)", () => {
    const iCards = page.indexOf("SingleSessionCards");
    const iSave = page.indexOf("Save with prepaid hours");
    const iStore = page.indexOf("PackageStore packages");
    assert.ok(iCards > 0 && iSave > iCards && iStore > iCards, "single sessions appear above packages");
    assert.match(page, /Pricing &amp; Study Hall options/);
  });

  it("CTAs enter the existing booking flow with duration preselected (items 6,7)", () => {
    assert.match(cards, /book\?duration=\$\{option\.minutes\}/);
    // Book page reads duration SAFELY (only 30 or 60) and passes it through.
    assert.match(bookPage, /duration === "60" \? 60 : 30/);
    assert.match(bookPage, /initialDuration=\{initialDuration\}/);
    assert.match(wizard, /initialDuration/);
  });

  it("free-trial stays the single account-scoped mechanism; cards add none (item 8)", () => {
    // The one authoritative free-trial check remains in the wizard.
    assert.match(wizard, /account_has_used_free_trial/);
    assert.match(wizard, /freeTrialUsed === false/);
    // The new cards introduce no second free-trial / payment mechanism.
    assert.doesNotMatch(cards, /useState|\.rpc\(|checkout|is_free_trial|isFreeTrial/);
  });
});

describe("Pricing page — prepaid packages unchanged (live)", { skip: !hasSupabaseEnv }, () => {
  const svc = adminClient();
  it("10/20/40-hour package prices remain $190 / $360 / $680 (item 5)", async () => {
    const { data } = await svc
      .from("package_products")
      .select("minutes, price_cents")
      .eq("is_active", true)
      .order("sort_order");
    const rows = (data ?? []).map((r) => [r.minutes, r.price_cents]);
    assert.deepEqual(rows, [[600, 19000], [1200, 36000], [2400, 68000]]);
  });
});
