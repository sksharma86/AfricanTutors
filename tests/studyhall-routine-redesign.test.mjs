import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const PUBLIC = [
  "src/app/(marketing)/page.tsx",
  "src/app/(marketing)/the-study-hall-hour/page.tsx",
  "src/app/(marketing)/how-it-works/page.tsx",
  "src/app/(marketing)/pricing/page.tsx",
  "src/app/(marketing)/faq/page.tsx",
  "src/app/(marketing)/about/page.tsx",
  "src/components/marketing/site-hero.tsx",
  "src/components/marketing/hour-chapter.tsx",
  "src/components/marketing/method-chapter.tsx",
  "src/components/marketing/routine-365.tsx",
  "src/components/marketing/why-african-tutors.tsx",
  "src/components/marketing/pricing-section.tsx",
  "src/components/marketing/trust-safety.tsx",
  "src/components/layout/navbar.tsx",
  "src/components/layout/mobile-menu.tsx",
  "src/components/layout/footer.tsx",
  "src/lib/constants.ts",
  "src/lib/faq.ts",
  "src/lib/public-offers.ts",
]
  .map(read)
  .join("\n");

describe("Study Hall routine redesign — public positioning", () => {
  it("adds The Study Hall Hour route and nav link", () => {
    const page = read("src/app/(marketing)/the-study-hall-hour/page.tsx");
    const nav = read("src/lib/constants.ts");
    assert.match(page, /One dedicated hour for your child’s academic life/);
    assert.match(page, /No homework tonight\? Good/);
    assert.match(page, /What the Guide does not do/);
    assert.match(nav, /href: "\/the-study-hall-hour"/);
    assert.match(nav, /The Study Hall Hour/);
  });

  it("keeps navigation short and uses Start free", () => {
    const constants = read("src/lib/constants.ts");
    const nav = read("src/components/layout/navbar.tsx");
    const mobile = read("src/components/layout/mobile-menu.tsx");
    assert.match(constants, /How it works/);
    assert.match(constants, /Pricing/);
    assert.match(constants, /FAQ/);
    assert.match(nav, /START_FREE_CTA/);
    assert.match(mobile, /START_FREE_CTA/);
    assert.doesNotMatch(nav + mobile, /Try your first Study Hall free/);
  });

  it("replaces homework-supervision as the primary public promise", () => {
    assert.match(read("src/components/marketing/site-hero.tsx"), /Make studying a habit\./);
    assert.doesNotMatch(PUBLIC, /Homework gets done/);
    assert.doesNotMatch(PUBLIC, /homework supervision/i);
    assert.doesNotMatch(read("src/app/(marketing)/page.tsx"), /African Tutors/);
    assert.doesNotMatch(read("src/components/marketing/site-hero.tsx"), /African Tutors/);
    assert.doesNotMatch(read("src/components/layout/footer.tsx"), /African Tutors/);
    assert.match(read("src/app/(marketing)/about/page.tsx"), /we are not African Tutors/);
  });

  it("public CTAs still route through the free-first funnel", () => {
    const home = read("src/app/(marketing)/page.tsx");
    const offers = read("src/lib/public-offers.ts");
    assert.match(offers, /PUBLIC_OFFER_CTA_HREF = "\/signup"/);
    assert.match(home, /href: "\/signup"/);
    assert.match(home, /START_FREE_CTA/);
    assert.match(home, /\/dashboard\/student\/book/);
    assert.match(home, /getGuideApplicantInfo/);
  });

  it("does not invent 365 checkout or authenticated portal features", () => {
    const pricing = read("src/components/marketing/pricing-section.tsx");
    const offers = read("src/lib/public-offers.ts");
    assert.match(pricing, /coming next/);
    assert.doesNotMatch(pricing, /Subscribe|Buy Study Hall 365|href=.*\/checkout/);
    assert.doesNotMatch(offers, /href: "\/checkout"|stripe|subscription/);
    assert.doesNotMatch(PUBLIC, /Plan My Week|entitlement|Daily unit|Available state/);
    assert.doesNotMatch(read("src/app/dashboard/student/page.tsx"), /Routine365|HourChapter/);
  });

  it("FAQ covers the required questions without duplicate free-trial answers", () => {
    const faq = read("src/lib/faq.ts");
    for (const q of [
      "What is Study Hall (at home)?",
      "Is this tutoring?",
      "What if my child doesn’t have homework?",
      "Does my child need to be struggling in school?",
      "What can they work on?",
      "Do I have to use Study Hall every day?",
      "Do I have to book the same time every day?",
      "Can siblings join the same Study Hall?",
      "How are Guides vetted?",
      "Are sessions recorded?",
      "How does the first free Study Hall work?",
    ]) {
      assert.match(faq, new RegExp(q.replace(/[?()]/g, "\\$&")));
    }
    assert.equal((faq.match(/q: "Is the first session really free\?"/g) || []).length, 0);
    assert.equal((faq.match(/q: "Who are the Guides\?"/g) || []).length, 0);
  });
});
