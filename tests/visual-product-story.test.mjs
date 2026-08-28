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

  it("how Study Hall works is an editorial BOOK → STUDY HALL → REPORT infographic", () => {
    const graphic = read("src/components/marketing/how-study-hall-works.tsx");
    const page = read("src/app/(marketing)/page.tsx");
    assert.match(page, /HowStudyHallWorks/);
    assert.doesNotMatch(page, /LiveStudyHallDemo|TrustRow|<Steps/);
    assert.match(graphic, /Book\. Study Hall\. Done\./);
    assert.match(graphic, />Book</);
    assert.match(graphic, />Study Hall</);
    assert.match(graphic, />Report</);
    assert.match(graphic, /Choose your time\./);
    assert.match(graphic, /Join from your Parent Portal\./);
    assert.match(graphic, /LIVE GUIDE PRESENCE/);
    assert.match(graphic, /YOUR CHILD/);
    assert.match(graphic, /THEIR GUIDE/);
    assert.match(graphic, /Focused time\. Real progress\./);
    assert.match(graphic, /Session report\./);
    assert.match(graphic, /Recording available\./);
    assert.match(graphic, /Parent Portal/);
    assert.match(graphic, /Safe\. Structured\. Reliable\./);
    assert.match(graphic, /studyhall-hero-desk\.webp/);
    assert.match(graphic, /tutor-portrait\.jpg/);
    assert.doesNotMatch(graphic, /Jordan|screen share|raise hand|whiteboard|chat panel/i);
    assert.doesNotMatch(graphic, /Pick a time\.|Get the recap\./);
    assert.equal((graphic.match(/Book\. Study Hall\. Done\./g) || []).length, 1);
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

  it("homepage how-it-works page no longer mounts the old steps or fake live room", () => {
    const how = read("src/app/(marketing)/how-it-works/page.tsx");
    assert.match(how, /HowStudyHallWorks/);
    assert.doesNotMatch(how, /LiveStudyHallDemo|<Steps/);
    assert.doesNotMatch(how, /from \"@\/components\/marketing\/steps\"/);
    assert.doesNotMatch(how, /from \"@\/components\/marketing\/live-studyhall\"/);
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
