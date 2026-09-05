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
  "src/app/(marketing)/the-study-hall-hour/page.tsx",
  "src/components/marketing/site-hero.tsx",
  "src/components/marketing/household-value.tsx",
  "src/components/marketing/how-study-hall-works.tsx",
  "src/components/marketing/pricing-section.tsx",
  "src/components/marketing/why-african-tutors.tsx",
  "src/components/marketing/habit-building.tsx",
  "src/components/marketing/study-hall-365.tsx",
  "src/components/marketing/cta-section.tsx",
  "src/lib/faq.ts",
  "src/lib/household-pricing-copy.mjs",
];

function marketingText() {
  return PUBLIC_MARKETING.map(read).join("\n");
}

function dollarContexts(text, re) {
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    out.push(text.slice(Math.max(0, m.index - 90), Math.min(text.length, m.index + 90)));
  }
  return out;
}

describe("Household marketing — homepage placement and compact value", () => {
  it("hero keeps the habit headline and the restrained sibling cue", () => {
    const hero = read("src/components/marketing/site-hero.tsx");
    const page = read("src/app/(marketing)/page.tsx");
    assert.match(hero, /Make studying a habit/);
    assert.match(hero, /HERO_HOUSEHOLD_CUE/);
    assert.equal(HERO_HOUSEHOLD_CUE, "Up to 3 siblings can join one Study Hall.");
    assert.match(page, /<SiteHero/);
    assert.match(page, /<StudyHall365/);
    const heroIdx = page.indexOf("<SiteHero");
    const whyIdx = page.indexOf("<WhyStudyHall");
    const hourIdx = page.indexOf("<StudyHallHourSection");
    assert.ok(heroIdx < whyIdx, "Parent problem follows the hero");
    assert.ok(whyIdx < hourIdx, "Study Hall Hour follows the parent problem");
  });

  it("household copy emphasizes up to 3 siblings, not a second hero", () => {
    const band = read("src/components/marketing/household-value.tsx");
    assert.equal(HOUSEHOLD_VALUE_EYEBROW, "One Study Hall. One price.");
    assert.equal(HOUSEHOLD_VALUE_HEADLINE, "Up to 3 siblings can join together.");
    assert.match(HOUSEHOLD_VALUE_BODY, /You pay for the Study Hall, not per child/);
    assert.match(HOUSEHOLD_VALUE_BODY, /one live Guide/);
    assert.match(band, /HOUSEHOLD_VALUE_HEADLINE/);
    assert.match(band, /HOUSEHOLD_VALUE_BODY/);
    assert.match(band, /HOUSEHOLD_VALUE_EYEBROW/);
    assert.doesNotMatch(band, /HOUSEHOLD_VALUE_STEPS/);
    assert.doesNotMatch(band, /ChildMarks|1 child|2 siblings|3 siblings/);
    assert.doesNotMatch(band, /Same Study Hall price/);
    assert.doesNotMatch(band, /<Image|grid-cols-3|rounded-\[22px\]|shadow-/);
    assert.doesNotMatch(band, /\$3|\$3\/hour|per child\/hour/);
    assert.deepEqual(
      HOUSEHOLD_VALUE_STEPS.map((s) => s.count),
      ["1 child", "2 siblings", "3 siblings"],
    );
    assert.ok(HOUSEHOLD_VALUE_STEPS.every((s) => s.price === "Same Study Hall price"));
  });
});

describe("Household marketing — pricing claims", () => {
  it("keeps authoritative backend package constants unchanged", () => {
    assert.match(read("src/lib/pricing.ts"), /PAYG_PRICE_USD = 12/);
    assert.match(read("src/lib/pricing.ts"), /PREPAID_FROM_HOURLY_USD = 9/);
    assert.equal(PACKAGE_14H_PRICE_CENTS, 14000);
    assert.equal(PACKAGE_28H_PRICE_CENTS, 25200);
    assert.equal(PACKAGE_14H_MINUTES, 840);
    assert.equal(PACKAGE_28H_MINUTES, 1680);
  });

  it("shows Study Hall 365 household economics without making $1.60 the primary price", () => {
    assert.equal(FAMILY_VALUE_EYEBROW, "One price. Up to three siblings.");
    assert.match(FAMILY_VALUE_BODY, /no additional cost per child/);
    assert.deepEqual([...FAMILY_VALUE_MATH], [
      "Study Hall 365 · $149/month · one Study Hall available each calendar day",
      "In a 31-day month at daily use: about $4.81 per Study Hall",
      "With three siblings in that same Study Hall: about $1.60 per child-hour",
    ]);
    assert.match(FAMILY_VALUE_RATE, /three siblings/);
    assert.match(FAMILY_VALUE_RATE, /\$1\.60 per child-hour/);
    const flagship = read("src/components/marketing/study-hall-365.tsx");
    assert.match(flagship, /FAMILY_VALUE_MATH/);
    assert.doesNotMatch(flagship, /From \$1\.60|Starting at \$1\.60/);
  });

  it("every general-site $1.60 / $4.81 claim is qualified by 31-day or three-sibling use", () => {
    const text = marketingText();
    const contexts = [
      ...dollarContexts(text, /\$1\.60/g),
      ...dollarContexts(text, /\$4\.81/g),
    ];
    assert.ok(contexts.length >= 2, "expected qualified 365 household math on the public site");
    for (const ctx of contexts) {
      assert.match(
        ctx,
        /31-day|31 days|three siblings|3 siblings|three children|three kids/i,
        `unqualified rate context: ${ctx}`,
      );
    }
    assert.doesNotMatch(text, /From \$1\.60\/hour|Starting at \$1\.60/);
  });

  it("does not imply one free Study Hall per child", () => {
    assert.match(FREE_STUDY_HALL_HOUSEHOLD, /One free Study Hall per account — not one per child/);
    assert.match(FREE_STUDY_HALL_HOUSEHOLD, /Up to three siblings can join/);
    const faq = read("src/lib/faq.ts");
    assert.match(faq, /one per account, not one per child/);
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

  it("How It Works and the infographic mention household participation concisely", () => {
    const how = read("src/app/(marketing)/how-it-works/page.tsx");
    const graphic = read("src/components/marketing/how-study-hall-works.tsx");
    assert.match(how, /HOW_IT_WORKS_HOUSEHOLD/);
    assert.equal(
      HOW_IT_WORKS_HOUSEHOLD,
      "Book one Study Hall, select up to three children, join one Guide, and receive feedback for each child. You pay for the Study Hall, not per child.",
    );
    assert.equal(INFOGRAPHIC_BOOK_BODY, "One child or up to three siblings can join.");
    assert.equal(INFOGRAPHIC_STUDY_BODY, "One live Guide keeps the Study Hall focused.");
    assert.equal(INFOGRAPHIC_REPORT_BODY, "Useful feedback for each child who attended.");
    assert.match(graphic, /INFOGRAPHIC_BOOK_BODY/);
    assert.match(graphic, /INFOGRAPHIC_REPORT_BODY/);
    assert.doesNotMatch(graphic + how, /separate recordings|group session|classroom|cohort|per-seat/i);
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
    assert.match(read("src/components/marketing/site-hero.tsx"), /HERO_HOUSEHOLD_CUE/);
    assert.match(read("src/components/marketing/why-african-tutors.tsx"), /Academic work now competes/);
  });

  it("campaign copy is reusable and not the homepage hero", () => {
    assert.equal(MULTI_CHILD_CAMPAIGN.headline, "Three kids. One Study Hall. One price.");
    assert.match(MULTI_CHILD_CAMPAIGN.price, /three kids/);
    assert.match(MULTI_CHILD_CAMPAIGN.price, /\$1\.60/);
    assert.doesNotMatch(read("src/components/marketing/site-hero.tsx"), /Three kids\. One Study Hall/);
    assert.doesNotMatch(read("src/app/(marketing)/page.tsx"), /MULTI_CHILD_CAMPAIGN/);
  });
});
