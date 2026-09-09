import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Galaxy Phase 1 — hero prototype contracts", () => {
  it("hero states one-to-one homework supervision with the approved headline", () => {
    const hero = read("src/components/marketing/phase1/hero-prototype.tsx");
    assert.match(hero, /Homework time\./);
    assert.match(hero, /Handled\./);
    assert.match(hero, /one on one/i);
    assert.match(hero, /homework they already have/);
    assert.match(hero, /FREE_TRIAL_CTA/);
    assert.match(hero, /ParentPortalPreview/);
    assert.doesNotMatch(hero, /HeroProductVisual|LiveStudyHallDemo/);
    assert.doesNotMatch(hero, /personalized support|individualized learning|guided homework/i);
  });

  it("first scroll reinforces personal Study Hall without redesigning lower chapters", () => {
    const page = read("src/app/(marketing)/page.tsx");
    const beat = read("src/components/marketing/phase1/personal-beat.tsx");
    const jsx = page.slice(page.indexOf("return"));
    assert.ok(jsx.indexOf("Phase1PersonalBeat") < jsx.indexOf("HourChapter"));
    assert.match(beat, /Their homework/);
    assert.match(beat, /one-to-one/);
    assert.match(page, /MethodChapter/);
    assert.match(page, /PricingSection/);
    assert.doesNotMatch(page, /SiteHero/);
  });

  it("reuses the existing parent portal composition, not invented UI", () => {
    const showcase = read("src/components/marketing/product-showcase.tsx");
    assert.match(showcase, /export function ParentPortalPreview/);
    assert.match(showcase, /Jordan/);
    assert.match(showcase, /with Guide[\s\S]*James/);
    assert.match(showcase, /Next Study Hall/);
  });
});
