import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  PACKAGE_10SH_PRICE_CENTS,
  STUDY_HALL_365_MONTHLY_USD,
} from "../src/lib/study-hall-365/catalog.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Galaxy 1A — homepage overhaul contracts", () => {
  it("hero states one-to-one homework supervision without anti-tutor copy", () => {
    const hero = read("src/components/marketing/galaxy/home-hero.tsx");
    assert.match(hero, /Homework time\. Handled\./);
    assert.match(hero, /one on one/);
    assert.match(hero, /homework they already have/);
    assert.match(hero, /FREE_TRIAL_CTA/);
    assert.match(hero, /ParentPortalPreview/);
    assert.doesNotMatch(hero, /Plan → Focus → Finish/);
    assert.doesNotMatch(hero, /You don't need another tutor/i);
    assert.doesNotMatch(hero, /personalized learning|individualized support|guided learning/);
  });

  it("homepage pricing is truthful and sourced from catalog constants", () => {
    const pricing = read("src/components/marketing/galaxy/home-pricing.tsx");
    assert.match(pricing, /PAYG_PRICE_USD/);
    assert.match(pricing, /PACKAGE_10SH_PRICE_CENTS/);
    assert.match(pricing, /STUDY_HALL_365_MONTHLY_USD/);
    assert.match(read("src/lib/pricing.ts"), /PAYG_PRICE_USD = 12/);
    assert.equal(PACKAGE_10SH_PRICE_CENTS, 10000);
    assert.equal(STUDY_HALL_365_MONTHLY_USD, 149);
    assert.match(pricing, /Authoritative backend remains \$100/);
    assert.doesNotMatch(pricing, /formatUsd\(99\)/);
    assert.doesNotMatch(pricing, /Subscribe|Buy now|coming next/);
  });

  it("does not invent product capabilities or fake screenshots", () => {
    const files = [
      "src/app/(marketing)/page.tsx",
      "src/components/marketing/galaxy/home-plan-week.tsx",
      "src/components/marketing/galaxy/home-guide.tsx",
      "src/components/marketing/galaxy/home-evening.tsx",
    ]
      .map(read)
      .join("\n");
    assert.match(files, /this week and next/);
    assert.doesNotMatch(files, /four weeks|AI homework|tutor matching|streak rewards|grades will improve/i);
    assert.doesNotMatch(read("src/app/(marketing)/page.tsx"), /LiveStudyHallDemo|HeroProductVisual/);
  });
});
