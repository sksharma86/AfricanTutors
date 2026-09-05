import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Visual product story — homepage contracts", () => {
  it("hero is photographic with a week rhythm, not a fabricated portal", () => {
    const hero = read("src/components/marketing/site-hero.tsx");
    assert.match(hero, /student-tutoring-session\.jpg/);
    assert.match(hero, /Make studying a habit/);
    assert.match(hero, /See how it works/);
    assert.match(hero, /WeekRhythm/);
    assert.doesNotMatch(hero, /HeroProductVisual/);
    assert.doesNotMatch(hero, /Starting at \$12/);
    assert.doesNotMatch(hero, /Kenya/);
    assert.doesNotMatch(hero, /Study Hall \(at home\)/);
  });

  it("how Study Hall works explains book → hour → after without a fake live room", () => {
    const graphic = read("src/components/marketing/how-study-hall-works.tsx");
    const how = read("src/app/(marketing)/how-it-works/page.tsx");
    assert.match(how, /HowStudyHallWorks/);
    assert.doesNotMatch(how, /LiveStudyHallDemo|TrustRow|<Steps/);
    assert.match(graphic, /Choose a time\./);
    assert.match(graphic, />Book</);
    assert.match(graphic, />The Hour</);
    assert.match(graphic, />After</);
    assert.match(graphic, /Choose a day and time\./);
    assert.match(graphic, /INFOGRAPHIC_BOOK_BODY/);
    assert.match(graphic, /Join from your Parent Portal\./);
    assert.match(graphic, /PLAN · FOCUS · FINISH/);
    assert.match(graphic, /YOUR CHILD/);
    assert.match(graphic, /THEIR GUIDE/);
    assert.match(graphic, /INFOGRAPHIC_STUDY_BODY/);
    assert.match(graphic, /INFOGRAPHIC_REPORT_BODY/);
    assert.match(graphic, /Guide report\./);
    assert.match(graphic, /Recording available\./);
    assert.match(graphic, /Parent Portal/);
    assert.match(graphic, /The subject changes\. The routine doesn’t\./);
    assert.match(graphic, /studyhall-hero-desk\.webp/);
    assert.match(graphic, /tutor-portrait\.jpg/);
    assert.doesNotMatch(graphic, /Jordan|screen share|raise hand|whiteboard|chat panel/i);
    assert.doesNotMatch(graphic, /Pick a time\.|Get the recap\./);
  });

  it("parent portal showcase is one composition, not a four-card grid", () => {
    const portal = read("src/components/marketing/product-showcase.tsx");
    assert.match(portal, /Tonight’s Study Hall|Tonight's Study Hall/);
    assert.match(portal, /View report|Recording ready|Read report/);
    assert.match(portal, /PARENT_PORTAL_NAV|Study Halls/);
    assert.match(portal, /parent-app/);
    assert.match(portal, /#161c18|#f6f1e8/);
    assert.match(portal, /WeekRhythm/);
    assert.doesNotMatch(portal, /Matching complete|America\/Chicago|Dashboard \/ Book/);
    assert.doesNotMatch(portal, /ProductStreakCard|ProductHoursCard|sm:grid-cols-2[\s\S]*ProductReportCard/);
    assert.doesNotMatch(portal, /bg-\[#f4f5f7\]/);
    assert.doesNotMatch(portal, /bg-ink-900 px-6/);
    assert.match(portal, /marketing preview/);
    assert.match(portal, /lg:max-w-\[88%\]/);
    assert.match(portal, /border-\[#D8D0C4\]/);
  });

  it("homepage how-it-works page no longer mounts the old steps or fake live room", () => {
    const how = read("src/app/(marketing)/how-it-works/page.tsx");
    assert.match(how, /HowStudyHallWorks/);
    assert.doesNotMatch(how, /LiveStudyHallDemo|<Steps/);
    assert.doesNotMatch(how, /from \"@\/components\/marketing\/steps\"/);
    assert.doesNotMatch(how, /from \"@\/components\/marketing\/live-studyhall\"/);
  });

  it("keeps the free-trial CTA and does not advertise Starting at $12/hour", () => {
    const pricing = read("src/lib/pricing.ts");
    const hero = read("src/components/marketing/site-hero.tsx");
    const section = read("src/components/marketing/pricing-section.tsx");
    assert.match(pricing, /FREE_TRIAL_CTA = "Try your first Study Hall free"/);
    assert.match(pricing, /PLANS_AS_LOW_AS_LABEL/);
    assert.match(pricing, /PREPAID_FROM_HOURLY_USD = 9/);
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
    ].map(read).join("\n");
    assert.doesNotMatch(files, /Starting at \$12/);
    assert.match(read("src/lib/pricing.ts"), /AS_LOW_AS_LABEL = `As low as \$\$\{PREPAID_FROM_HOURLY_USD\}\/hour`/);
    assert.match(read("src/lib/pricing.ts"), /PLANS_AS_LOW_AS_LABEL/);
  });
});
