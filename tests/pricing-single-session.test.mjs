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

  it("authenticated customer nav includes Book and Sessions (not Packages)", () => {
    assert.match(shell, /label:\s*"Book"/);
    assert.match(shell, /label:\s*"Sessions"/);
    assert.doesNotMatch(shell, /label:\s*"Packages"/);
    assert.match(shell, /Book a Study Hall/);
  });

  it("single-session prices derive from whole-hour SESSION_OPTIONS ($12 / $24 / $36)", () => {
    assert.match(pricing, /minutes:\s*60,\s*priceUsd:\s*12/);
    assert.match(pricing, /minutes:\s*120,\s*priceUsd:\s*24/);
    assert.match(pricing, /minutes:\s*180,\s*priceUsd:\s*36/);
    assert.doesNotMatch(pricing, /minutes:\s*30,/);
    // Cards derive from SESSION_OPTIONS, not hardcoded amounts.
    assert.match(cards, /SESSION_OPTIONS/);
    assert.doesNotMatch(cards, /\$\s?12\b|\$\s?24\b|\$\s?36\b/); // no hardcoded dollar literal
    assert.doesNotMatch(cards, /\b1200\b|\b2400\b|\b3600\b/); // no hardcoded cents literal
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
    // Book page accepts only whole-hour Study Hall durations (60 / 120 / 180).
    assert.match(bookPage, /parsed === 120 \|\| parsed === 180 \|\| parsed === 60/);
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

describe("Pricing page — prepaid packages (live)", { skip: !hasSupabaseEnv }, () => {
  const svc = adminClient();
  it("active packages are 14h/$140 and 28h/$252 (Study Hall PR2)", async () => {
    const { data } = await svc
      .from("package_products")
      .select("minutes, price_cents")
      .eq("is_active", true)
      .order("sort_order");
    const rows = (data ?? []).map((r) => [r.minutes, r.price_cents]);
    assert.deepEqual(rows, [[840, 14000], [1680, 25200]]);
  });
});
