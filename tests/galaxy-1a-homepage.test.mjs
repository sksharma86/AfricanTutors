import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { PACKAGE_10SH_PRICE_CENTS, STUDY_HALL_365_MONTHLY_USD } from "../src/lib/study-hall-365/catalog.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Galaxy 1A homepage — approved copy and product truth", () => {
  it("uses the approved five-section story and exact primary copy", () => {
    const page = read("src/app/(marketing)/page.tsx");
    const jsx = page.slice(page.indexOf("return"));
    const order = ["HomeHero", "HomeExplainer", "HomeEvening", "HomePortal", "HomePricing"];
    let last = -1;
    for (const name of order) {
      const i = jsx.indexOf(name);
      assert.ok(i > last, `${name} must follow previous section`);
      last = i;
    }
    assert.doesNotMatch(page, /SiteHero|HourChapter|MethodChapter|Routine365|CtaSection|<Faq/);
    assert.match(read("src/components/marketing/home/hero.tsx"), /Give your child an edge\./);
    assert.match(read("src/components/marketing/home/hero.tsx"), /Private, one on one Study Halls\. Right at home\./);
    assert.match(read("src/components/marketing/home/hero.tsx"), /No credit card/);
    assert.match(read("src/components/marketing/home/explainer.tsx"), /A dedicated hour for getting things done\./);
    assert.match(read("src/components/marketing/home/evening.tsx"), /Get an hour of your evening back\./);
    assert.match(read("src/components/marketing/home/evening.tsx"), /Homework time\? We got this\./);
    assert.match(read("src/components/marketing/home/portal.tsx"), /Everything in one place\./);
    assert.match(read("src/components/marketing/home/pricing.tsx"), /Choose what works for your family\./);
    assert.match(read("src/components/marketing/home/pricing.tsx"), /Study Hall Unlimited/);
  });

  it("reuses the real Parent Portal composition, not a fake dashboard", () => {
    const portal = read("src/components/marketing/home/portal.tsx");
    const callouts = read("src/components/marketing/home/portal-callouts.tsx");
    assert.match(portal, /ParentPortalPreview/);
    assert.doesNotMatch(portal, /Built for real life|sh-home-kicker|anno-line|────────/);
    assert.doesNotMatch(callouts, /Plan the week|Study Halls/);
    assert.match(callouts, /Join when it’s time/);
    assert.match(callouts, /See how it went/);
    assert.doesNotMatch(callouts, /anno-line|────────|"use client"|M 1108|C 980/);
    assert.doesNotMatch(portal, /JoinSession|This Week|Taylor|Jordan calendar/i);
    assert.match(read("src/components/marketing/product-showcase.tsx"), /export function ParentPortalPreview/);
    assert.doesNotMatch(read("src/app/(marketing)/page.tsx"), /HeroProductVisual|LiveStudyHallDemo/);
  });

  it("keeps the 10-pack homepage price truthful to the catalog", () => {
    const pricing = read("src/components/marketing/home/pricing.tsx");
    assert.equal(PACKAGE_10SH_PRICE_CENTS, 10000);
    assert.equal(STUDY_HALL_365_MONTHLY_USD, 149);
    assert.match(pricing, /PACKAGE_10SH_PRICE_CENTS/);
    assert.match(pricing, /Do not advertise \$99/);
    assert.doesNotMatch(pricing, /formatUsd\(99\)/);
    assert.doesNotMatch(pricing, /price: "\$99"|\{pack\} = "\$99"/);
  });
});
