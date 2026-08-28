import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Visual product story — homepage contracts", () => {
  it("hero is photographic and not a fabricated portal", () => {
    const hero = read("src/components/marketing/site-hero.tsx");
    assert.match(hero, /student-tutoring-session\.jpg/);
    assert.match(hero, /Homework gets done/);
    assert.match(hero, /See how it works/);
    assert.match(hero, /PREPAID_FROM_HOURLY_USD/);
    assert.doesNotMatch(hero, /HeroProductVisual/);
    assert.doesNotMatch(hero, /Starting at \$12/);
    assert.doesNotMatch(hero, /Kenya/);
    assert.doesNotMatch(hero, /Study Hall \(at home\)/);
  });

  it("live Study Hall demo uses real session chrome and photography", () => {
    const live = read("src/components/marketing/live-studyhall.tsx");
    assert.match(live, /Study Hall \(at home\) · Live/);
    assert.match(live, /Working independently/);
    assert.match(live, /Your Guide/);
    assert.match(live, /studyhall-focus-close\.webp/);
    assert.match(live, /tutor-portrait\.jpg/);
    assert.doesNotMatch(live, /screen share|raise hand|whiteboard|chat panel/i);
    assert.doesNotMatch(live, /Do not teach lessons|Stay present\. Encourage focus/);
  });

  it("parent portal showcase is one composition, not a four-card grid", () => {
    const portal = read("src/components/marketing/product-showcase.tsx");
    assert.match(portal, /Next Study Hall/);
    assert.match(portal, /11 hours/);
    assert.match(portal, /View report|Recording ready/);
    assert.match(portal, /PARENT_PORTAL_NAV|Study Halls/);
    assert.doesNotMatch(portal, /Matching complete|America\/Chicago|Dashboard \/ Book/);
    assert.doesNotMatch(portal, /ProductStreakCard|ProductHoursCard|sm:grid-cols-2[\s\S]*ProductReportCard/);
  });

  it("how-it-works is a three-step sequence, not a four-card grid", () => {
    const steps = read("src/components/marketing/steps.tsx");
    assert.match(steps, /Book\. Study Hall\. Done/);
    assert.match(steps, /Pick a time/);
    assert.match(steps, /You get the recap/);
    assert.doesNotMatch(steps, /do not tutor/i);
    assert.doesNotMatch(steps, /60 days/);
    assert.doesNotMatch(steps, /lg:grid-cols-4/);
  });

  it("advertises as low as \$9/hour and never Starting at \$12/hour", () => {
    const pricing = read("src/lib/pricing.ts");
    const hero = read("src/components/marketing/site-hero.tsx");
    const section = read("src/components/marketing/pricing-section.tsx");
    assert.match(pricing, /FREE_TRIAL_CTA = "Try your first Study Hall free"/);
    assert.match(pricing, /PLANS_AS_LOW_AS_LABEL/);
    assert.match(pricing, /PREPAID_FROM_HOURLY_USD = 9/);
    assert.match(hero, /PREPAID_FROM_HOURLY_USD/);
    assert.match(section, /AS_LOW_AS_LABEL/);
    assert.doesNotMatch(`${hero}\n${section}`, /Starting at \$12/);
  });

  it("motion exists and respects reduced motion", () => {
    const css = read("src/app/globals.css");
    const reveal = read("src/components/marketing/reveal.tsx");
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /\.sh-reveal/);
    assert.match(reveal, /IntersectionObserver/);
  });

  it("runtime surfaces keep Study Hall \\(at home\\) and avoid beige editorial tokens", () => {
    const css = read("src/app/globals.css");
    const layout = read("src/app/layout.tsx");
    const nav = read("src/components/layout/navbar.tsx");
    const hero = read("src/components/marketing/site-hero.tsx");
    assert.match(nav + read("src/lib/constants.ts"), /Study Hall \(at home\)/);
    assert.doesNotMatch(css, /#f6f1e8|#fffcf7/);
    assert.doesNotMatch(layout, /Fraunces/);
    assert.doesNotMatch(hero, /Study Hall at Home|African Tutors/);
  });

  it("marketing copy never advertises Starting at $12/hour", () => {
    const files = [
      "src/app/(marketing)/page.tsx",
      "src/app/(marketing)/pricing/page.tsx",
      "src/components/marketing/site-hero.tsx",
      "src/components/marketing/pricing-section.tsx",
      "src/components/marketing/cta-section.tsx",
      "src/lib/pricing.ts",
    ].map(read).join("\n");
    assert.doesNotMatch(files, /Starting at \$12/);
    assert.match(read("src/lib/pricing.ts"), /AS_LOW_AS_LABEL = `As low as \$\$\{PREPAID_FROM_HOURLY_USD\}\/hour`/);
    assert.match(read("src/lib/pricing.ts"), /PLANS_AS_LOW_AS_LABEL/);
  });
});
