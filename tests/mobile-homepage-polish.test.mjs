import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const home = [
  "src/app/(marketing)/page.tsx",
  "src/components/marketing/site-hero.tsx",
  "src/components/marketing/trust-row.tsx",
  "src/components/marketing/live-studyhall.tsx",
  "src/components/marketing/steps.tsx",
  "src/components/marketing/product-showcase.tsx",
  "src/components/marketing/why-african-tutors.tsx",
  "src/components/marketing/pricing-section.tsx",
  "src/components/marketing/trust-safety.tsx",
  "src/components/marketing/cta-section.tsx",
]
  .map(read)
  .join("\n");

describe("Mobile homepage polish", () => {
  it("preserves the hero promise and removes the redundant eyebrow", () => {
    const hero = read("src/components/marketing/site-hero.tsx");
    assert.match(hero, /Homework gets done/);
    assert.match(hero, /You get your evening back/);
    assert.match(hero, /Try your first Study Hall free|primaryLabel/);
    assert.match(hero, /From \$\{PREPAID_FROM_HOURLY_USD\}\/hour/);
    assert.doesNotMatch(hero, /tracking-\[0\.18em\][\s\S]*Study Hall \(at home\)/);
  });

  it("explains the product with one composition, not three stacked photos", () => {
    const visual = read("src/components/marketing/trust-row.tsx");
    assert.match(visual, /Your child works/);
    assert.match(visual, /Their Guide stays present/);
    assert.match(visual, /You get your evening back/);
    assert.match(visual, /studyhall-hero-desk\.webp/);
    assert.doesNotMatch(visual, /60 days/);
    assert.doesNotMatch(visual, /tutor-portrait|student-tutoring-session/);
  });

  it("keeps a simplified live Study Hall without SOP or join-window clutter", () => {
    const live = read("src/components/marketing/live-studyhall.tsx");
    assert.match(live, /This is a Study Hall/);
    assert.match(live, /Present\. Encouraging\. Keeping things moving/);
    assert.doesNotMatch(live, /Ready to join 5 minutes/);
    assert.doesNotMatch(live, /Do not teach|homework answers/);
    assert.doesNotMatch(live, /42:18/);
  });

  it("how-it-works is three customer-journey steps", () => {
    const steps = read("src/components/marketing/steps.tsx");
    assert.equal((steps.match(/n: "0/g) || []).length, 3);
    assert.doesNotMatch(steps, /n: "04"/);
  });

  it("parent portal mock uses current destinations, not the old dashboard tabs", () => {
    const portal = read("src/components/marketing/product-showcase.tsx");
    assert.match(portal, /Home/);
    assert.match(portal, /Study Halls/);
    assert.match(portal, /Hours/);
    assert.match(portal, /Account/);
    assert.doesNotMatch(portal, /Matching complete/);
    assert.doesNotMatch(portal, /Available for 60 days/);
  });

  it("pricing separates the free hour from paid choices and does not change values", () => {
    const pricing = read("src/components/marketing/pricing-section.tsx");
    assert.match(pricing, /Your first Study Hall is on us/);
    assert.match(pricing, /PAYG_PRICE_USD/);
    assert.match(pricing, /formatCents\(pkg\.priceCents\)/);
    assert.match(pricing, /Prepaid hours never expire/);
    assert.doesNotMatch(pricing, /Hours never expire[\s\S]*Hours never expire/);
  });

  it("trust is four pillars and no repeated James / 60-day photo", () => {
    const trust = read("src/components/marketing/trust-safety.tsx");
    assert.match(trust, /Supervision you can see/);
    assert.match(trust, /Highly vetted Guides/);
    assert.match(trust, /Private, on-platform sessions/);
    assert.match(trust, /Recorded for safety/);
    assert.match(trust, /always reachable/);
    assert.doesNotMatch(trust, /tutor-portrait|Not stored forever|60 days/);
  });

  it("homepage marketing does not repeat 60-day retention or negative tutoring framing", () => {
    assert.doesNotMatch(home, /60 days/);
    assert.doesNotMatch(home, /not tutoring|do not tutor|do not teach|do not complete homework/i);
  });

  it("homepage section order stays hero → visual → live → steps → portal → why → pricing → trust → faq → cta", () => {
    const page = read("src/app/(marketing)/page.tsx");
    const jsx = page.slice(page.indexOf("return"));
    const order = [
      "SiteHero",
      "TrustRow",
      "LiveStudyHallDemo",
      "Steps",
      "ProductShowcase",
      "WhyStudyHall",
      "PricingSection",
      "TrustSafety",
      "Faq",
      "CtaSection",
    ];
    let last = -1;
    for (const name of order) {
      const i = jsx.indexOf(name);
      assert.ok(i > last, `${name} must follow previous section`);
      last = i;
    }
  });
});
