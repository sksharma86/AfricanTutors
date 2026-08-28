import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const home = [
  "src/app/(marketing)/page.tsx",
  "src/components/marketing/site-hero.tsx",
  "src/components/marketing/how-study-hall-works.tsx",
  "src/components/marketing/habit-building.tsx",
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

  it("does not restore the rejected under-hero lifestyle photo or fake live room", () => {
    const page = read("src/app/(marketing)/page.tsx");
    assert.doesNotMatch(page, /TrustRow|LiveStudyHallDemo|<Steps/);
    assert.doesNotMatch(home, /Present on video|This is a Study Hall/);
    assert.doesNotMatch(home, /Ready to join 5 minutes|42:18/);
    assert.doesNotMatch(home, /Pick a time\.|Get the recap\./);
  });

  it("how Study Hall works is the BOOK → STUDY HALL → REPORT infographic", () => {
    const graphic = read("src/components/marketing/how-study-hall-works.tsx");
    assert.match(graphic, /Book\. Study Hall\. Done\./);
    assert.match(graphic, /Choose your time\./);
    assert.match(graphic, /Join from your Parent Portal\./);
    assert.match(graphic, /LIVE GUIDE PRESENCE/);
    assert.match(graphic, /YOUR CHILD/);
    assert.match(graphic, /THEIR GUIDE/);
    assert.match(graphic, /Focused time\. Real progress\./);
    assert.match(graphic, /Session report\./);
    assert.match(graphic, /Recording available\./);
    assert.match(graphic, /View the full session securely in your Parent Portal\./);
    assert.match(graphic, /Safe\. Structured\. Reliable\./);
    assert.doesNotMatch(graphic, /Pick a time\.|Get the recap\./);
    assert.doesNotMatch(graphic, /emailed|email the recording|public (url|link)/i);
    assert.doesNotMatch(graphic, /30-minute|30 minute|30m/);
    assert.doesNotMatch(graphic, /mic|raise hand|whiteboard|webcam frame|Live badge/i);
  });

  it("parent portal mock uses current destinations, not the old dashboard tabs", () => {
    const portal = read("src/components/marketing/product-showcase.tsx");
    assert.match(portal, /PARENT_PORTAL_NAV/);
    assert.match(portal, /Reports & Recordings|item\.label/);
    assert.match(portal, /11 hours/);
    assert.match(portal, /Buy hours &amp; save/);
    assert.doesNotMatch(portal, /Matching complete/);
    assert.doesNotMatch(portal, /Available for 60 days/);
    assert.doesNotMatch(portal, /11h 30m|11 hours 30|30m/);
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
    assert.match(trust, /Parent contact when needed/);
    assert.doesNotMatch(trust, /always reachable/i);
    assert.doesNotMatch(trust, /tutor-portrait|Not stored forever|60 days/);
  });

  it("homepage marketing does not repeat 60-day retention or negative tutoring framing", () => {
    assert.doesNotMatch(home, /60 days/);
    assert.doesNotMatch(home, /not tutoring|do not tutor|do not teach|do not complete homework/i);
  });

  it("homepage section order stays hero → breathing room → infographic → habits → portal → pricing → trust → faq → cta", () => {
    const page = read("src/app/(marketing)/page.tsx");
    const jsx = page.slice(page.indexOf("return"));
    const order = [
      "SiteHero",
      "WhyStudyHall",
      "HowStudyHallWorks",
      "HabitBuilding",
      "ProductShowcase",
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
    assert.ok(!/SiteHero[\s\S]*<(TrustRow|LiveStudyHallDemo|Steps)/.test(jsx));
  });
});

describe("Homepage long-term value + product accuracy", () => {
  it("habit-building section states recurring routine without graduating from Study Hall", () => {
    const habits = read("src/components/marketing/habit-building.tsx");
    assert.match(habits, /More than homework supervision/);
    assert.match(habits, /finish tonight/);
    assert.match(habits, /better student/i);
    assert.match(habits, /dedicated time/);
    assert.match(habits, /their Guide stays\s+present with encouragement and redirection/);
    assert.match(habits, /Tonight/);
    assert.match(habits, /Routine/);
    assert.match(habits, /Progress/);
    assert.match(habits, /Better evenings now/);
    assert.match(habits, /Better study habits over time/);
    assert.doesNotMatch(habits, /Independence|graduate|need us less|eventually do it alone|outgrow|can last far longer/i);
    assert.doesNotMatch(habits, /dedicated hour/);
    assert.doesNotMatch(habits, /Accountability Guide[\s\S]*accountability/i);
    assert.doesNotMatch(habits, /guarantee|GPA|better grades|according to|study of|citation/i);
  });

  it("uses Guide as the normal role name and does not rename the product as the Guide", () => {
    assert.doesNotMatch(home, /Accountability Guide/);
    assert.match(read("src/components/marketing/how-study-hall-works.tsx"), /join Study Hall/);
    assert.doesNotMatch(read("src/components/marketing/how-study-hall-works.tsx"), /They join their Guide/);
  });

  it("breathing-room sits directly after hero and directly before the infographic", () => {
    const page = read("src/app/(marketing)/page.tsx");
    const jsx = page.slice(page.indexOf("return"));
    const hero = jsx.indexOf("SiteHero");
    const why = jsx.indexOf("WhyStudyHall");
    const graphic = jsx.indexOf("HowStudyHallWorks");
    const habits = jsx.indexOf("HabitBuilding");
    assert.ok(hero > -1 && hero < why && why < graphic && graphic < habits);
    const betweenHeroAndWhy = jsx.slice(hero, why);
    const betweenWhyAndGraphic = jsx.slice(why, graphic);
    assert.doesNotMatch(betweenHeroAndWhy, /TrustRow|LiveStudyHallDemo|HabitBuilding|ProductShowcase/);
    assert.doesNotMatch(betweenWhyAndGraphic, /TrustRow|LiveStudyHallDemo|HabitBuilding|ProductShowcase/);
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

  it("parent portal mock matches current nav and whole-hour prepaid copy", () => {
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

  it("recording copy stays restrained on the homepage", () => {
    assert.doesNotMatch(home, /60 days|not stored permanently|recordings deleted/i);
    assert.match(read("src/lib/faq.ts"), /60 days after the Study Hall/);
  });
});
