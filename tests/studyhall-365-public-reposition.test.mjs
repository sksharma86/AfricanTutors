import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const PUBLIC_SURFACES = [
  "src/app/(marketing)/page.tsx",
  "src/app/(marketing)/the-study-hall-hour/page.tsx",
  "src/app/(marketing)/how-it-works/page.tsx",
  "src/app/(marketing)/about/page.tsx",
  "src/app/(marketing)/pricing/page.tsx",
  "src/app/(marketing)/faq/page.tsx",
  "src/components/marketing/site-hero.tsx",
  "src/components/marketing/why-african-tutors.tsx",
  "src/components/marketing/study-hall-hour-section.tsx",
  "src/components/marketing/study-hall-method.tsx",
  "src/components/marketing/parent-relief.tsx",
  "src/components/marketing/habit-building.tsx",
  "src/components/marketing/study-hall-365.tsx",
  "src/components/marketing/pricing-section.tsx",
  "src/components/marketing/human-difference.tsx",
  "src/components/marketing/trust-safety.tsx",
  "src/components/marketing/product-showcase.tsx",
  "src/components/marketing/how-study-hall-works.tsx",
  "src/components/layout/footer.tsx",
  "src/lib/faq.ts",
  "src/lib/constants.ts",
];

function publicText() {
  return PUBLIC_SURFACES.map(read).join("\n");
}

describe("Study Hall 365 public reposition — route, nav, terminology", () => {
  it("adds The Study Hall Hour as a public route and nav item", () => {
    const page = read("src/app/(marketing)/the-study-hall-hour/page.tsx");
    const nav = read("src/lib/constants.ts");
    assert.match(page, /One dedicated hour for your child’s academic life/);
    assert.match(page, /What if there’s nothing due tomorrow/);
    assert.match(page, /StudyHallMethod/);
    assert.match(page, /FREE_TRIAL_CTA/);
    assert.match(nav, /label: "The Study Hall Hour", href: "\/the-study-hall-hour"/);
    assert.match(nav, /label: "How it works", href: "\/how-it-works"/);
    assert.match(nav, /label: "Pricing", href: "\/pricing"/);
    assert.match(nav, /label: "FAQ", href: "\/faq"/);
  });

  it("homepage links to the dedicated hour page and keeps signup as the anonymous CTA", () => {
    const home = read("src/app/(marketing)/page.tsx");
    assert.match(home, /href:\s*"\/signup"/);
    assert.match(home, /FREE_TRIAL_CTA/);
    assert.match(home, /StudyHallHourSection/);
    assert.match(read("src/components/marketing/study-hall-hour-section.tsx"), /href="\/the-study-hall-hour"/);
  });

  it("reduces homework-as-umbrella language on public marketing", () => {
    const text = publicText();
    assert.doesNotMatch(text, /homework supervision/i);
    assert.doesNotMatch(text, /Homework gets done/);
    assert.doesNotMatch(text, /finish your homework/i);
    assert.doesNotMatch(text, /child with homework/i);
    assert.match(text, /Make studying a habit/);
    assert.match(read("src/lib/constants.ts"), /consistent academic habits/);
  });

  it("does not revive African Tutors customer-facing branding", () => {
    assert.doesNotMatch(publicText(), /African Tutors/);
    assert.doesNotMatch(read("src/components/marketing/site-hero.tsx"), /BrandMark|legacy/);
  });

  it("does not invent broken Study Hall 365 checkout", () => {
    const offers = read("src/lib/public-offers.ts");
    const pricing = read("src/components/marketing/pricing-section.tsx");
    const flagship = read("src/components/marketing/study-hall-365.tsx");
    assert.match(offers, /PUBLIC_OFFER_CTA_HREF = "\/signup"/);
    assert.match(offers, /STUDY_HALL_HOUR_MINUTES = 60/);
    assert.match(offers, /STUDY_HALL_365_MONTHLY_USD = 149/);
    assert.match(offers, /id: "study-hall-365"/);
    assert.match(offers, /Do NOT add checkout hrefs/);
    assert.match(pricing, /PUBLIC_OFFER_CTA_HREF|ctaHref/);
    assert.doesNotMatch(pricing + flagship + offers, /\/api\/checkout|mode:\s*"subscription"|customer\.subscription/);
    assert.doesNotMatch(read("src/app/(marketing)/pricing/page.tsx"), /Buy Study Hall 365|Subscribe now|Start membership/i);
  });
});

describe("Study Hall 365 public reposition — FAQ and method", () => {
  it("includes flexibility, homework-is-one-use, and not-just-struggling FAQs", () => {
    const faq = read("src/lib/faq.ts");
    assert.match(faq, /Do I have to book a Study Hall every day\?/);
    assert.match(faq, /Do I have to book at the same time every day\?/);
    assert.match(faq, /What if my child doesn’t have homework\?/);
    assert.match(faq, /Does my child need to be struggling in school\?/);
    assert.match(faq, /available every day/);
    assert.match(faq, /doesn’t mean required every day/);
    assert.match(faq, /There may not be homework every day/);
  });

  it("defines the Study Hall Hour uses and Plan → Focus → Finish", () => {
    const hour = read("src/lib/study-hall-hour.ts");
    assert.match(hour, /"Homework"/);
    assert.match(hour, /"Reading"/);
    assert.match(hour, /"School organization"/);
    assert.match(hour, /title: "Plan"/);
    assert.match(hour, /title: "Focus"/);
    assert.match(hour, /title: "Finish"/);
    assert.match(read("src/components/marketing/study-hall-method.tsx"), /The subject changes/);
  });

  it("keeps Sign in and the free-trial CTA in public chrome", () => {
    const nav = read("src/components/layout/navbar.tsx");
    const mobile = read("src/components/layout/mobile-menu.tsx");
    assert.match(nav, /Sign in/);
    assert.match(nav, /FREE_TRIAL_CTA/);
    assert.match(mobile, /FREE_TRIAL_CTA/);
    assert.match(mobile, /PUBLIC_NAV_LINKS/);
  });
});

describe("Study Hall 365 public reposition — no stray portal files", () => {
  it("does not add subscriber portal or weekly scheduler routes", () => {
    const marketingDirs = readdirSync(new URL("../src/app/(marketing)", import.meta.url));
    assert.ok(marketingDirs.includes("the-study-hall-hour"));
    assert.ok(!marketingDirs.includes("plan-my-week"));
    assert.ok(!marketingDirs.includes("subscribe"));
  });
});
