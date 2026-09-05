import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const home = [
  "src/app/(marketing)/page.tsx",
  "src/components/marketing/site-hero.tsx",
  "src/components/marketing/habit-building.tsx",
  "src/components/marketing/product-showcase.tsx",
  "src/components/marketing/why-african-tutors.tsx",
  "src/components/marketing/pricing-section.tsx",
  "src/components/marketing/trust-safety.tsx",
  "src/components/marketing/cta-section.tsx",
  "src/components/marketing/study-hall-hour-section.tsx",
  "src/components/marketing/study-hall-method.tsx",
  "src/components/marketing/parent-relief.tsx",
  "src/components/marketing/study-hall-365.tsx",
]
  .map(read)
  .join("\n");

describe("Mobile homepage polish", () => {
  it("preserves the hero promise and removes the redundant eyebrow", () => {
    const hero = read("src/components/marketing/site-hero.tsx");
    assert.match(hero, /Make studying a habit/);
    assert.match(hero, /One dedicated hour/);
    assert.match(hero, /Try your first Study Hall free|primaryLabel/);
    assert.match(hero, /First hour free/);
    assert.doesNotMatch(hero, /tracking-\[0\.18em\][\s\S]*Study Hall \(at home\)/);
  });

  it("does not restore the rejected under-hero lifestyle photo or fake live room", () => {
    const page = read("src/app/(marketing)/page.tsx");
    assert.doesNotMatch(page, /TrustRow|LiveStudyHallDemo|<Steps/);
    assert.doesNotMatch(home, /Present on video|This is a Study Hall/);
    assert.doesNotMatch(home, /Ready to join 5 minutes|42:18/);
    assert.doesNotMatch(home, /Pick a time\.|Get the recap\./);
  });

  it("how Study Hall works is book → hour → after", () => {
    const graphic = read("src/components/marketing/how-study-hall-works.tsx");
    assert.match(graphic, /Choose a time\./);
    assert.match(graphic, /Choose a day and time\./);
    assert.match(graphic, /Join from your Parent Portal\./);
    assert.match(graphic, /PLAN · FOCUS · FINISH/);
    assert.match(graphic, /YOUR CHILD/);
    assert.match(graphic, /THEIR GUIDE/);
    assert.match(graphic, /Guide report\./);
    assert.match(graphic, /Recording available\./);
    assert.match(graphic, /View the full session securely in your Parent Portal\./);
    assert.doesNotMatch(graphic, /Pick a time\.|Get the recap\./);
    assert.doesNotMatch(graphic, /emailed|email the recording|public (url|link)/i);
    assert.doesNotMatch(graphic, /30-minute|30 minute|30m/);
    assert.doesNotMatch(graphic, /\bmic\b|microphone|raise hand|whiteboard|webcam frame|Live badge/i);
  });

  it("parent portal mock uses current destinations and a week composition", () => {
    const portal = read("src/components/marketing/product-showcase.tsx");
    assert.match(portal, /PARENT_PORTAL_NAV/);
    assert.match(portal, /Reports & Recordings|item\.label/);
    assert.match(portal, /WeekRhythm/);
    assert.doesNotMatch(portal, /Buy hours/);
    assert.doesNotMatch(portal, /Matching complete/);
    assert.doesNotMatch(portal, /11h 30m|11 hours 30|30m/);
  });

  it("pricing separates the free hour from the offer ladder and does not checkout 365", () => {
    const pricing = read("src/components/marketing/pricing-section.tsx");
    assert.match(pricing, /Your first Study Hall is on us/);
    assert.match(pricing, /PUBLIC_OFFERS/);
    assert.match(pricing, /PUBLIC_OFFER_CTA_HREF|ctaHref/);
    assert.match(pricing, /never expire/);
    assert.doesNotMatch(pricing, /\/api\/checkout|checkout\.sessions|mode:\s*"subscription"/);
  });

  it("trust keeps the existing safety truths", () => {
    const trust = read("src/components/marketing/trust-safety.tsx");
    assert.match(trust, /Presence you can see|Supervision you can see/);
    assert.match(trust, /Highly vetted Guides/);
    assert.match(trust, /Private, on-platform sessions/);
    assert.match(trust, /Recorded for safety/);
    assert.match(trust, /Parent contact when needed/);
    assert.doesNotMatch(trust, /always reachable/i);
    assert.doesNotMatch(trust, /tutor-portrait/);
  });

  it("homepage marketing does not repeat negative tutoring framing", () => {
    assert.doesNotMatch(home, /not tutoring|do not tutor|do not teach|do not complete homework/i);
  });

  it("homepage section order follows the new narrative", () => {
    const page = read("src/app/(marketing)/page.tsx");
    const jsx = page.slice(page.indexOf("return"));
    const order = [
      "SiteHero",
      "WhyStudyHall",
      "StudyHallHourSection",
      "StudyHallMethod",
      "ParentRelief",
      "HabitBuilding",
      "StudyHall365",
      "PricingSection",
      "HumanDifference",
      "TrustSafety",
      "ProductShowcase",
      "Faq",
      "CtaSection",
    ];
    let last = -1;
    for (const name of order) {
      const i = jsx.indexOf(name);
      assert.ok(i > last, `${name} must follow previous section`);
      last = i;
    }
    assert.ok(!/SiteHero[\s\S]*<(TrustRow|LiveStudyHallDemo|Steps)/.test(jsx));
  });
});

describe("Homepage long-term value + product accuracy", () => {
  it("habit-building section shows a weekly rhythm without graduating from Study Hall", () => {
    const habits = read("src/components/marketing/habit-building.tsx");
    assert.match(habits, /One night becomes a routine/);
    assert.match(habits, /A routine becomes a habit/);
    assert.match(habits, /WeekRhythm/);
    assert.doesNotMatch(habits, /Independence|graduate|need us less|eventually do it alone|outgrow/i);
    assert.doesNotMatch(habits, /guarantee|GPA|better grades|according to|study of|citation/i);
  });

  it("uses Guide as the normal role name and does not rename the product as the Guide", () => {
    assert.doesNotMatch(home, /Accountability Guide/);
    assert.match(read("src/components/marketing/how-study-hall-works.tsx"), /join Study Hall/);
    assert.doesNotMatch(read("src/components/marketing/how-study-hall-works.tsx"), /They join their Guide/);
  });

  it("Study Hall Hour sits after the parent-problem section", () => {
    const page = read("src/app/(marketing)/page.tsx");
    const jsx = page.slice(page.indexOf("return"));
    const hero = jsx.indexOf("SiteHero");
    const why = jsx.indexOf("WhyStudyHall");
    const hour = jsx.indexOf("StudyHallHourSection");
    const method = jsx.indexOf("StudyHallMethod");
    assert.ok(hero > -1 && hero < why && why < hour && hour < method);
  });

  it("homepage marketing does not make absolute academic promises", () => {
    assert.doesNotMatch(home, /guarantees better grades|GPA|will become independent|guaranteed memory/i);
  });

  it("infographic uses editorial participant photos, not conferencing chrome", () => {
    const graphic = read("src/components/marketing/how-study-hall-works.tsx");
    assert.match(graphic, /studyhall-hero-desk\.webp/);
    assert.match(graphic, /tutor-portrait\.jpg/);
    assert.doesNotMatch(graphic, /studyhall-focus-close\.webp/);
    assert.doesNotMatch(graphic, /Present on video|mute|raise hand|whiteboard/i);
    assert.doesNotMatch(graphic, /screen share|chat panel|Live badge/i);
  });

  it("parent portal mock matches current nav", () => {
    const portal = read("src/components/marketing/product-showcase.tsx");
    const nav = read("src/lib/parent-portal.mjs");
    assert.match(nav, /Reports & Recordings/);
    assert.match(portal, /Join Study Hall/);
    assert.match(portal, /rounded-\[12px\]/);
    assert.doesNotMatch(portal, /Dashboard \/ Book|America\/Chicago|Matching complete/);
    assert.doesNotMatch(home + read("src/components/marketing/product-visuals.tsx"), /11h 30m/);
  });

  it("signup is a parent account, not a public marketplace", () => {
    const signup = read("src/components/auth/signup-form.tsx");
    const page = read("src/app/(marketing)/signup/page.tsx");
    const apply = read("src/app/(marketing)/apply-to-tutor/page.tsx");
    assert.match(page, /Create your parent account/);
    assert.match(signup, /Full name/);
    assert.match(signup, /name="displayName"/);
    assert.match(signup, /requested_role: role/);
    assert.match(signup, /\/guides\/apply/);
    assert.match(apply, /defaultRole="tutor"/);
    assert.match(apply, /Submit Application/);
    assert.doesNotMatch(signup, /Display name|platform users|I'm a parent|Become a Guide/);
    assert.doesNotMatch(page, /Parents book Study Hall|Guides apply separately|marketplace|browse Guides/i);
    assert.doesNotMatch(signup, /grid-cols-2 gap-3/);
  });

  it("recording copy stays restrained on the homepage body", () => {
    assert.match(read("src/lib/faq.ts"), /60 days after the Study Hall/);
  });
});
