import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Visual product story — homepage contracts", () => {
  it("hero is photographic, short, and habit-first", () => {
    const hero = read("src/components/marketing/site-hero.tsx");
    assert.match(hero, /student-tutoring-session\.jpg/);
    assert.match(hero, /Make studying a habit\./);
    assert.match(hero, /A focused hour with a real human Guide/);
    assert.match(hero, /First Study Hall free\. No credit card required\./);
    assert.doesNotMatch(hero, /HeroProductVisual|ROUTINE_WEEK|Mon|Tue|Wed/);
    assert.doesNotMatch(hero, /Starting at \$12|Study Hall 365|sibling/i);
    assert.doesNotMatch(hero, /Homework gets done|See how it works|PREPAID_FROM_HOURLY_USD/);
    assert.doesNotMatch(hero, /Kenya|Study Hall \(at home\)|African Tutors/);
  });

  it("homepage is seven chapters, not the old infographic stack", () => {
    const page = read("src/app/(marketing)/page.tsx");
    const jsx = page.slice(page.indexOf("return"));
    const order = [
      "SiteHero",
      "HourChapter",
      "MethodChapter",
      "WhyStudyHall",
      "Routine365",
      "TrustSafety",
      "PricingSection",
      "Faq",
      "CtaSection",
    ];
    let last = -1;
    for (const name of order) {
      const i = jsx.indexOf(name);
      assert.ok(i > last, `${name} must follow previous section`);
      last = i;
    }
    assert.doesNotMatch(page, /HowStudyHallWorks|HouseholdValue|HabitBuilding|ProductShowcase/);
    assert.doesNotMatch(page, /LiveStudyHallDemo|TrustRow|<Steps/);
  });

  it("how-it-works page is a short journey, not the hour page", () => {
    const how = read("src/app/(marketing)/how-it-works/page.tsx");
    const journey = read("src/components/marketing/how-it-works-journey.tsx");
    assert.match(how, /HowItWorksJourney/);
    assert.doesNotMatch(how, /HowStudyHallWorks|LiveStudyHallDemo|<Steps/);
    assert.match(journey, /Choose a time/);
    assert.match(journey, /Join/);
    assert.match(journey, /Plan/);
    assert.match(journey, /Focus/);
    assert.match(journey, /Finish/);
    assert.match(journey, /Report/);
    assert.match(journey, /Return/);
  });

  it("parent portal showcase file remains a single composition", () => {
    const portal = read("src/components/marketing/product-showcase.tsx");
    assert.match(portal, /Next Study Hall/);
    assert.match(portal, /11 hours/);
    assert.match(portal, /View report|Recording ready|Read report/);
    assert.match(portal, /PARENT_PORTAL_NAV|Study Halls/);
    assert.match(portal, /parent-app/);
    assert.doesNotMatch(portal, /Matching complete|America\/Chicago|Dashboard \/ Book/);
    assert.doesNotMatch(portal, /ProductStreakCard|ProductHoursCard|sm:grid-cols-2[\s\S]*ProductReportCard/);
  });

  it("public pricing is the upcoming ladder with Start free only", () => {
    const pricingLib = read("src/lib/pricing.ts");
    const offers = read("src/lib/public-offers.ts");
    const section = read("src/components/marketing/pricing-section.tsx");
    assert.match(pricingLib, /FREE_TRIAL_CTA = "Try your first Study Hall free"/);
    assert.match(offers, /START_FREE_CTA = "Start free"/);
    assert.match(section, /First Study Hall free/);
    assert.match(section, /Study Hall 365/);
    assert.match(section, /\$149/);
    assert.match(section, /coming next/);
    assert.doesNotMatch(section, /Subscribe|Buy now|href=.*365/);
    assert.doesNotMatch(`${read("src/components/marketing/site-hero.tsx")}\n${section}`, /Starting at \$12/);
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
    const marketingCss = css.split("/* Parent Portal application system")[0];
    assert.doesNotMatch(marketingCss, /#f6f1e8|#fffcf7/);
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
    ]
      .map(read)
      .join("\n");
    assert.doesNotMatch(files, /Starting at \$12/);
    assert.match(read("src/lib/pricing.ts"), /AS_LOW_AS_LABEL = `As low as \$\$\{PREPAID_FROM_HOURLY_USD\}\/hour`/);
  });
});
