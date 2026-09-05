import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  BOOKING_SAME_PRICE_NOTE,
  FAMILY_VALUE_BODY,
  FAMILY_VALUE_EYEBROW,
  FAMILY_VALUE_MATH,
  FAMILY_VALUE_RATE,
  FREE_STUDY_HALL_HOUSEHOLD,
  HERO_HOUSEHOLD_CUE,
  HOUSEHOLD_VALUE_BODY,
  HOUSEHOLD_VALUE_EYEBROW,
  HOUSEHOLD_VALUE_HEADLINE,
  HOUSEHOLD_VALUE_STEPS,
  HOW_IT_WORKS_HOUSEHOLD,
  INFOGRAPHIC_BOOK_BODY,
  INFOGRAPHIC_REPORT_BODY,
  INFOGRAPHIC_STUDY_BODY,
  MULTI_CHILD_CAMPAIGN,
} from "../src/lib/household-pricing-copy.mjs";
import { PACKAGE_14H_MINUTES, PACKAGE_14H_PRICE_CENTS, PACKAGE_28H_MINUTES, PACKAGE_28H_PRICE_CENTS } from "../src/lib/packages.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const PUBLIC_MARKETING = [
  "src/app/(marketing)/page.tsx",
  "src/app/(marketing)/pricing/page.tsx",
  "src/app/(marketing)/faq/page.tsx",
  "src/app/(marketing)/how-it-works/page.tsx",
  "src/app/(marketing)/about/page.tsx",
  "src/components/marketing/site-hero.tsx",
  "src/components/marketing/routine-365.tsx",
  "src/components/marketing/pricing-section.tsx",
  "src/components/marketing/why-african-tutors.tsx",
  "src/components/marketing/cta-section.tsx",
  "src/lib/faq.ts",
  "src/lib/household-pricing-copy.mjs",
];

function marketingText() {
  return PUBLIC_MARKETING.map(read).join("\n");
}

describe("Household marketing — homepage placement and compact value", () => {
  it("siblings stay out of the hero and appear with 365 / pricing", () => {
    const hero = read("src/components/marketing/site-hero.tsx");
    const page = read("src/app/(marketing)/page.tsx");
    const routine = read("src/components/marketing/routine-365.tsx");
    const pricing = read("src/components/marketing/pricing-section.tsx");
    assert.match(hero, /Make studying a habit\./);
    assert.doesNotMatch(hero, /HERO_HOUSEHOLD_CUE|sibling|365/);
    assert.equal(HERO_HOUSEHOLD_CUE, "Up to 3 siblings can join one Study Hall.");
    assert.match(page, /<Routine365/);
    assert.match(routine, /Up to three siblings/);
    assert.match(pricing, /FAMILY_VALUE_EYEBROW/);
    assert.match(pricing, /FAMILY_VALUE_BODY/);
    const heroIdx = page.indexOf("<SiteHero");
    const routineIdx = page.indexOf("<Routine365");
    assert.ok(heroIdx > -1 && heroIdx < routineIdx);
  });

  it("household headline constants remain sibling-first, not a second hero", () => {
    const band = read("src/components/marketing/household-value.tsx");
    assert.equal(HOUSEHOLD_VALUE_EYEBROW, "One Study Hall. One price.");
    assert.equal(HOUSEHOLD_VALUE_HEADLINE, "Up to 3 siblings can join together.");
    assert.match(HOUSEHOLD_VALUE_BODY, /You pay for the Study Hall, not per child/);
    assert.match(band, /HOUSEHOLD_VALUE_HEADLINE/);
    assert.doesNotMatch(band, /HOUSEHOLD_VALUE_STEPS/);
    assert.deepEqual(
      HOUSEHOLD_VALUE_STEPS.map((s) => s.count),
      ["1 child", "2 siblings", "3 siblings"],
    );
  });
});

describe("Household marketing — pricing claims", () => {
  it("keeps live package numbers unchanged in the backend modules", () => {
    assert.match(read("src/lib/pricing.ts"), /PAYG_PRICE_USD = 12/);
    assert.match(read("src/lib/pricing.ts"), /PREPAID_FROM_HOURLY_USD = 9/);
    assert.equal(PACKAGE_14H_PRICE_CENTS, 14000);
    assert.equal(PACKAGE_28H_PRICE_CENTS, 25200);
    assert.equal(PACKAGE_14H_MINUTES, 840);
    assert.equal(PACKAGE_28H_MINUTES, 1680);
  });

  it("shows 365 household economics with the 31-day assumption", () => {
    assert.equal(FAMILY_VALUE_EYEBROW, "One price. Up to three siblings.");
    assert.match(FAMILY_VALUE_BODY, /no additional cost per child/);
    assert.deepEqual([...FAMILY_VALUE_MATH], [
      "Study Hall 365 · $149/month · one Study Hall available each calendar day",
      "In a 31-day month at daily use: about $4.81 per Study Hall",
      "With three siblings in that same Study Hall: about $1.60 per child-hour",
    ]);
    assert.match(FAMILY_VALUE_RATE, /31-day month/);
    assert.match(FAMILY_VALUE_RATE, /\$4\.81/);
    assert.match(FAMILY_VALUE_RATE, /\$1\.60/);
    const pricing = read("src/components/marketing/pricing-section.tsx");
    assert.match(pricing, /FAMILY_VALUE_RATE/);
    assert.doesNotMatch(pricing, /From \$3|Study Hall from \$3|Starting at \$3/);
  });

  it("does not imply one free Study Hall per child", () => {
    assert.match(FREE_STUDY_HALL_HOUSEHOLD, /One free Study Hall per account — not one per child/);
    assert.match(FREE_STUDY_HALL_HOUSEHOLD, /Up to three siblings can join/);
    const faq = read("src/lib/faq.ts");
    assert.match(faq, /one per account, not one per child/i);
    assert.doesNotMatch(marketingText(), /one free Study Hall per child|three free hours|three separate free/i);
  });
});

describe("Household marketing — FAQ, How it works, booking", () => {
  it("FAQ explains sibling participation without turning into a price sheet", () => {
    const faq = read("src/lib/faq.ts");
    assert.match(faq, /q: "Can siblings join the same Study Hall\?"/);
    assert.match(faq, /no additional cost per child/);
    assert.match(faq, /remain visible on camera/);
    assert.match(faq, /feedback for each child/);
    const siblingBlock = faq.slice(faq.indexOf("Can siblings join the same Study Hall?"), faq.indexOf("Can I cancel?"));
    assert.doesNotMatch(siblingBlock, /\$3|\$12|\$9\/hour/);
    assert.match(read("src/app/(marketing)/page.tsx"), /Can siblings join the same Study Hall\?/);
  });

  it("How It Works mentions household participation concisely", () => {
    const how = read("src/app/(marketing)/how-it-works/page.tsx");
    assert.match(how, /HOW_IT_WORKS_HOUSEHOLD/);
    assert.equal(
      HOW_IT_WORKS_HOUSEHOLD,
      "Book one Study Hall, select up to three children, join one Guide, and receive feedback for each child. You pay for the Study Hall, not per child.",
    );
    assert.equal(INFOGRAPHIC_BOOK_BODY, "One child or up to three siblings can join.");
    assert.equal(INFOGRAPHIC_STUDY_BODY, "One live Guide keeps the Study Hall focused.");
    assert.equal(INFOGRAPHIC_REPORT_BODY, "Useful feedback for each child who attended.");
    assert.doesNotMatch(how, /separate recordings|group session|classroom|cohort|per-seat/i);
  });

  it("booking adds one same-price reassurance without changing the flow", () => {
    const wiz = read("src/components/booking/booking-wizard.tsx");
    assert.equal(BOOKING_SAME_PRICE_NOTE, "Up to 3 siblings can join for the same Study Hall price.");
    assert.match(wiz, /BOOKING_SAME_PRICE_NOTE/);
    assert.match(wiz, /Who is joining Study Hall\?/);
    assert.match(wiz, /Select up to \{MAX_CHILDREN_PER_STUDY_HALL\} children/);
    assert.match(wiz, /wouldExceedChildLimit/);
  });

  it("avoids public group-class terminology and one-child exclusion", () => {
    const text = marketingText();
    assert.doesNotMatch(text, /group session|classroom|cohort|per-seat|student slot|shared tutor/i);
    assert.doesNotMatch(text, /Built for big families|Study Hall is for families with multiple children/);
    assert.doesNotMatch(read("src/components/marketing/site-hero.tsx"), /Three kids\. Three sets of homework/);
    assert.doesNotMatch(read("src/app/(marketing)/page.tsx"), /MULTI_CHILD_CAMPAIGN/);
    assert.equal(MULTI_CHILD_CAMPAIGN.headline, "Three kids. Three sets of homework. One Study Hall.");
  });
});
