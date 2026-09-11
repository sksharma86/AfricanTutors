import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { adminClient, hasSupabaseEnv, skipIfPkg10shNotYet99 } from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Pricing page — single sessions before packages", () => {
  const shell = read("src/components/dashboard/customer-shell.tsx");
  const cards = read("src/components/dashboard/single-session-cards.tsx");
  const page = read("src/app/dashboard/student/packages/page.tsx");
  const pricing = read("src/lib/pricing.ts");
  const wizard = read("src/components/booking/booking-wizard.tsx");
  const bookPage = read("src/app/dashboard/student/book/page.tsx");

  it("authenticated customer nav includes Hours (not Packages) and a Book CTA", () => {
    const nav = read("src/lib/parent-portal.mjs");
    assert.match(nav, /label:\s*"Hours"/);
    assert.match(nav, /label:\s*"Study Halls"/);
    assert.doesNotMatch(nav, /label:\s*"Packages"/);
    assert.match(shell, /PARENT_PORTAL_NAV/);
    assert.match(shell, /Book a Study Hall/);
  });

  it("single-session prices derive from the one-hour SESSION_OPTIONS ($12)", () => {
    assert.match(pricing, /minutes:\s*60,\s*priceUsd:\s*12/);
    assert.doesNotMatch(pricing, /minutes:\s*120,/);
    assert.doesNotMatch(pricing, /minutes:\s*180,/);
    assert.doesNotMatch(pricing, /minutes:\s*30,/);
    assert.match(cards, /PAYG_PRICE_USD|SESSION_OPTIONS/);
    assert.doesNotMatch(cards, /\$\s?24\b|\$\s?36\b/);
    assert.doesNotMatch(cards, /\b2400\b|\b3600\b/);
  });

  it("single-session section renders before prepaid packages (item 4)", () => {
    const iCards = page.indexOf("SingleSessionCards");
    const iSave = page.indexOf("Save with prepaid hours");
    const iStore = page.indexOf("PackageStore packages");
    assert.ok(iCards > 0 && iSave > iCards && iStore > iCards, "single sessions appear above packages");
    assert.match(page, /Pricing &amp; Study Hall options/);
  });

  it("CTAs enter the booking flow without a client-controlled duration", () => {
    assert.match(cards, /\/dashboard\/student\/book/);
    assert.doesNotMatch(cards, /duration=/);
    assert.match(bookPage, /Duration query params cannot create a longer booking/);
    assert.doesNotMatch(wizard, /initialDuration|setDuration/);
  });

  it("free-trial stays the single account-scoped mechanism; cards add none (item 8)", () => {
    // The one authoritative free-trial check remains in the wizard.
    assert.match(wizard, /booking_quote/);
    assert.match(wizard, /funding === "free_trial"|funding_source === "free_trial"/);
    // The new cards introduce no second free-trial / payment mechanism.
    assert.doesNotMatch(cards, /useState|\.rpc\(|checkout|is_free_trial|isFreeTrial/);
  });
});

describe("Pricing page — prepaid packages (live)", { skip: !hasSupabaseEnv }, () => {
  const svc = adminClient();
  it("active customer prepaid offer is pkg_10sh; pkg_14h/pkg_28h are not sold (0047)", async (t) => {
    const { data } = await svc
      .from("package_products")
      .select("code, minutes, price_cents, is_active")
      .in("code", ["pkg_10sh", "pkg_14h", "pkg_28h"]);
    const by = Object.fromEntries((data ?? []).map((p) => [p.code, p]));
    if (skipIfPkg10shNotYet99(t, by.pkg_10sh)) return;
    assert.deepEqual([by.pkg_10sh.minutes, by.pkg_10sh.price_cents, by.pkg_10sh.is_active], [600, 9900, true]);
    assert.deepEqual([by.pkg_14h.minutes, by.pkg_14h.price_cents, by.pkg_14h.is_active], [840, 14000, false]);
    assert.deepEqual([by.pkg_28h.minutes, by.pkg_28h.price_cents, by.pkg_28h.is_active], [1680, 25200, false]);
  });
});
