import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const home = [
  "src/app/(marketing)/page.tsx",
  "src/components/marketing/site-hero.tsx",
  "src/components/marketing/hour-chapter.tsx",
  "src/components/marketing/method-chapter.tsx",
  "src/components/marketing/routine-365.tsx",
  "src/components/marketing/why-african-tutors.tsx",
  "src/components/marketing/pricing-section.tsx",
  "src/components/marketing/trust-safety.tsx",
  "src/components/marketing/cta-section.tsx",
]
  .map(read)
  .join("\n");

describe("Mobile homepage polish", () => {
  it("preserves a short hero and a short nav CTA", () => {
    const hero = read("src/components/marketing/site-hero.tsx");
    const nav = read("src/components/layout/navbar.tsx");
    const mobile = read("src/components/layout/mobile-menu.tsx");
    assert.match(hero, /Make studying a habit\./);
    assert.match(hero, /Start free|primaryLabel/);
    assert.match(nav, /START_FREE_CTA/);
    assert.match(mobile, /START_FREE_CTA/);
    assert.match(mobile, /lg:hidden/);
    assert.doesNotMatch(nav + mobile, /Try your first Study Hall free/);
    assert.doesNotMatch(hero, /ROUTINE_WEEK|grid-cols-7/);
  });

  it("does not restore the rejected under-hero lifestyle photo or fake live room", () => {
    const page = read("src/app/(marketing)/page.tsx");
    assert.doesNotMatch(page, /TrustRow|LiveStudyHallDemo|<Steps/);
    assert.doesNotMatch(home, /Present on video|This is a Study Hall/);
    assert.doesNotMatch(home, /Ready to join 5 minutes|42:18/);
  });

  it("week visual lives in the 365 chapter and adapts on small screens", () => {
    const routine = read("src/components/marketing/routine-365.tsx");
    assert.match(routine, /ROUTINE_WEEK/);
    assert.match(routine, /grid-cols-7/);
    assert.doesNotMatch(routine, /\bSet\b/);
    assert.doesNotMatch(read("src/components/marketing/site-hero.tsx"), /ROUTINE_WEEK/);
  });

  it("parent portal mock uses current destinations, not the old dashboard tabs", () => {
    const portal = read("src/components/marketing/product-showcase.tsx");
    assert.match(portal, /PARENT_PORTAL_NAV/);
    assert.match(portal, /Reports & Recordings|item\.label/);
    assert.match(portal, /11 hours/);
    assert.match(portal, /Buy hours &amp; save/);
    assert.doesNotMatch(portal, /Matching complete/);
    assert.doesNotMatch(portal, /11h 30m|11 hours 30|30m/);
  });

  it("pricing separates try-it from 365 and supporting offers", () => {
    const pricing = read("src/components/marketing/pricing-section.tsx");
    assert.match(pricing, /First Study Hall free/);
    assert.match(pricing, /Then choose what fits|withHeader/);
    assert.match(pricing, /Study Hall 365/);
    assert.match(pricing, /coming next/);
    assert.doesNotMatch(pricing, /Subscribe|Buy now/);
  });

  it("trust is a short list, not six equal cards", () => {
    const trust = read("src/components/marketing/trust-safety.tsx");
    assert.match(trust, /Highly vetted Guides/);
    assert.match(trust, /Live camera presence/);
    assert.match(trust, /AI can help a student find an answer/);
    assert.doesNotMatch(trust, /grid-cols-2|grid-cols-3|sm:grid-cols-2/);
    assert.doesNotMatch(trust, /always reachable/i);
  });

  it("homepage marketing does not repeat negative tutoring framing", () => {
    assert.doesNotMatch(home, /not tutoring|do not tutor|do not teach|do not complete homework/i);
  });
});

describe("Homepage long-term value + product accuracy", () => {
  it("uses Guide as the normal role name", () => {
    assert.doesNotMatch(home, /Accountability Guide/);
    assert.match(home, /Guide/);
  });

  it("homepage marketing does not make absolute academic promises", () => {
    assert.doesNotMatch(home, /guarantees better grades|GPA|will become independent|guaranteed memory/i);
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
    assert.match(read("src/lib/faq.ts"), /60 days after the Study Hall/);
  });
});
