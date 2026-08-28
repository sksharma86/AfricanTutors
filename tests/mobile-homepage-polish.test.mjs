import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const home = [
  "src/app/(marketing)/page.tsx",
  "src/components/marketing/site-hero.tsx",
  "src/components/marketing/trust-row.tsx",
  "src/components/marketing/live-studyhall.tsx",
  "src/components/marketing/habit-building.tsx",
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

  it("homepage section order stays hero → visual → live → habits → steps → portal → why → pricing → trust → faq → cta", () => {
    const page = read("src/app/(marketing)/page.tsx");
    const jsx = page.slice(page.indexOf("return"));
    const order = [
      "SiteHero",
      "TrustRow",
      "LiveStudyHallDemo",
      "HabitBuilding",
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

describe("Homepage long-term value + product accuracy", () => {
  it("habit-building section states developmental positioning without guarantees", () => {
    const habits = read("src/components/marketing/habit-building.tsx");
    assert.match(habits, /More than homework supervision/);
    assert.match(habits, /finish tonight/);
    assert.match(habits, /better student/i);
    assert.match(habits, /Accountability Guide/);
    assert.match(habits, /Tonight/);
    assert.match(habits, /Routine/);
    assert.match(habits, /Independence/);
    assert.match(habits, /habits can last far longer/);
    assert.doesNotMatch(habits, /guarantee|GPA|better grades|according to|study of|citation/i);
    assert.doesNotMatch(habits, /always need an Accountability Guide/i);
  });

  it("uses Accountability Guide selectively, not as a sitewide rename", () => {
    const mentions = home.match(/Accountability Guide/g) ?? [];
    assert.ok(mentions.length >= 1 && mentions.length <= 3, `expected 1–3 uses, got ${mentions.length}`);
    assert.match(read("src/components/marketing/steps.tsx"), /Their Guide/);
    assert.doesNotMatch(read("src/components/marketing/steps.tsx"), /Accountability Guide/);
  });

  it("homepage marketing does not make absolute academic promises", () => {
    assert.doesNotMatch(home, /guarantees better grades|GPA|will become independent|guaranteed memory/i);
  });

  it("live Study Hall makes the Guide the dominant tile and the child a PIP", () => {
    const live = read("src/components/marketing/live-studyhall.tsx");
    const guide = live.indexOf("tutor-portrait.jpg");
    const child = live.indexOf("studyhall-focus-close.webp");
    assert.ok(guide > -1 && child > -1);
    assert.ok(guide < child, "Guide portrait should render as the main stage before the child PIP");
    assert.match(live, /max-w-\[9\.5rem\]|max-w-\[11rem\]/);
    assert.doesNotMatch(live, /sm:grid-cols-\[1\.35fr_0\.85fr\]/);
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
