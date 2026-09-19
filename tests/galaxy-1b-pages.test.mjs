import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const HOW_FILES = [
  "src/app/(marketing)/how-it-works/page.tsx",
  "src/components/marketing/how-it-works/page-sections.tsx",
  "src/lib/galaxy-1b-copy.ts",
]
  .map(read)
  .join("\n");

const WHY_FILES = [
  "src/app/(marketing)/why-it-works/page.tsx",
  "src/components/marketing/why-it-works/page-sections.tsx",
  "src/lib/galaxy-1b-copy.ts",
]
  .map(read)
  .join("\n");

const NAV = read("src/lib/constants.ts");
const COPY = read("src/lib/galaxy-1b-copy.ts");

describe("Galaxy 1B — public navigation", () => {
  it("adds How It Works, Why It Works, Pricing and FAQ to desktop and mobile nav", () => {
    assert.match(NAV, /label: "How It Works", href: "\/how-it-works"/);
    assert.match(NAV, /label: "Why It Works", href: "\/why-it-works"/);
    assert.match(NAV, /label: "Pricing", href: "\/pricing"/);
    assert.match(NAV, /label: "FAQ", href: "\/faq"/);
    const publicBlock = NAV.slice(NAV.indexOf("PUBLIC_NAV_LINKS"), NAV.indexOf("FOOTER_SECTIONS"));
    assert.doesNotMatch(publicBlock, /The Study Hall Hour/);
    assert.match(read("src/components/layout/navbar.tsx"), /PUBLIC_NAV_LINKS/);
    assert.match(read("src/components/layout/mobile-menu.tsx"), /PUBLIC_NAV_LINKS/);
  });

  it("keeps The Study Hall Hour and FAQ in the footer", () => {
    const footer = NAV.slice(NAV.indexOf("FOOTER_SECTIONS"));
    assert.match(footer, /href: "\/the-study-hall-hour"/);
    assert.match(footer, /href: "\/faq"/);
    assert.match(footer, /Why It Works/);
  });
});

describe("Galaxy 1B — How It Works", () => {
  it("uses the approved product hero and personal-Guide journey", () => {
    assert.match(COPY, /A personal Study Hall, right at home\./);
    assert.match(COPY, /A live Guide stays with your child throughout Study Hall/);
    assert.match(COPY, /No credit card required/);
    assert.match(COPY, /label: "Book"/);
    assert.match(COPY, /label: "Join"/);
    assert.match(COPY, /label: "Focus"/);
    assert.match(COPY, /label: "Finish"/);
    assert.match(read("src/app/(marketing)/how-it-works/page.tsx"), /HOW_IT_WORKS_HOUSEHOLD/);
    assert.match(HOW_FILES, /ParentPortalPreview/);
    assert.match(HOW_FILES, /how_it_works_hero/);
  });

  it("positions the Guide as presence, not tutoring", () => {
    assert.match(COPY, /does not tutor a subject/);
    assert.match(HOW_FILES, /Plan My Week/);
    assert.match(HOW_FILES, /60 days/);
    assert.doesNotMatch(HOW_FILES, /only one child can ever|only one child may participate/i);
  });

  it("presents the good-fit section as a structured editorial list, not raw fragments", () => {
    assert.match(COPY, /HOW_IT_WORKS_WHO_KICKER = "A good fit"/);
    assert.match(COPY, /For the nights when getting started is the hard part\./);
    assert.match(COPY, /a dedicated hour, a live Guide, and a clear place to get the work done\./);
    for (const line of [
      "Homework gets pushed off.",
      "Distractions keep winning.",
      "A child needs reminders to keep moving.",
      "Parents are tired of managing every step.",
      "Having someone present helps them stay with the work.",
      "A consistent time makes homework easier to begin.",
    ]) {
      assert.ok(COPY.includes(`"${line}"`), line);
    }
    assert.doesNotMatch(COPY, /Study Hall can be useful when a child|simply works better with a consistent/);
    const css = read("src/app/globals.css");
    assert.match(css, /\.sh-galaxy-who__list \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  });

  it("moves the FAQ off How It Works and onto /faq, sourced from the canonical FAQ_ITEMS", () => {
    assert.doesNotMatch(HOW_FILES, /HowItWorksFaq|HOW_IT_WORKS_FAQ\b|The short answers\./);
    const faqPage = read("src/app/(marketing)/faq/page.tsx");
    const faqSections = read("src/components/marketing/faq/page-sections.tsx");
    assert.match(faqPage, /FAQ_ITEMS/);
    assert.match(faqPage, /className="sh-home sh-galaxy sh-faq"/);
    assert.match(faqPage, /HomeHeaderScroll/);
    assert.match(faqPage, /FAQPage/);
    assert.match(faqSections, /from "@\/lib\/faq"/);
    assert.doesNotMatch(faqSections, /q: "/);
    assert.match(faqSections, /<details className="sh-faq-item">/);
    assert.match(faqSections, /Try your first Study Hall free/);
    assert.match(faqSections, /No credit card required/);
  });

  it("uses light-on-dark and dark-on-light typography with no undefined tokens", () => {
    const css = read("src/app/globals.css");
    assert.doesNotMatch(css, /var\(--sh-navy\)|var\(--sh-canvas\)/);
    assert.match(css, /\.sh-galaxy-trust \{[\s\S]*background: var\(--sh-charcoal\);[\s\S]*color: #f3eee5;/);
    assert.match(css, /\.sh-galaxy-cta \{[\s\S]*background: var\(--sh-charcoal\);[\s\S]*color: #f3eee5;/);
    assert.match(css, /\.sh-galaxy-rhythm \{[\s\S]*background: var\(--sh-paper\);[\s\S]*color: var\(--sh-ink\);/);
    assert.match(css, /\.sh-galaxy-section-title \{[\s\S]*color: var\(--sh-ink\);/);
    assert.match(css, /\.sh-galaxy-week__day\.is-on span \{[\s\S]*color: var\(--sh-accent\);/);
    assert.match(css, /\.sh-galaxy-week__day strong \{[\s\S]*color: var\(--sh-muted\);/);
  });

  it("avoids banned claims and group-classroom language", () => {
    assert.doesNotMatch(HOW_FILES, /Plan → Focus → Finish|You don't need another tutor/);
    assert.doesNotMatch(HOW_FILES, /improve(?:d)? grades|scientifically proven|ADHD|diagnos/i);
    assert.doesNotMatch(HOW_FILES, /background check|certified|100% safe|guaranteed/i);
    assert.doesNotMatch(HOW_FILES, /group session|classroom|cohort|student grid/i);
    assert.doesNotMatch(HOW_FILES, /Stripe|Daily\.co|Twilio|entitlement/i);
  });
});

describe("Galaxy 1B — Why It Works", () => {
  it("sells the routine instead of repeating the product explainer", () => {
    assert.match(COPY, /Better evenings start with a better routine\./);
    assert.match(COPY, /predictable place in the week/);
    assert.match(COPY, /household rhythm around getting schoolwork done/);
    assert.match(COPY, /Make Study Hall part of the week\./);
    assert.match(COPY, /WHY_IT_WORKS_WEEK_HEADLINE = "Study Hall finds its place in the week\."/);
    assert.match(COPY, /Not every family uses Study Hall every day/);
    assert.doesNotMatch(COPY, /The hour becomes expected/);
    assert.match(WHY_FILES, /Study Hall 365/);
    assert.doesNotMatch(WHY_FILES, /Study Hall Unlimited/);
    assert.match(WHY_FILES, /View pricing/);
    assert.doesNotMatch(WHY_FILES, /won't need Study Hall|graduate from Study Hall/i);
    assert.match(COPY, /does not need to graduate from having structure/);
  });

  it("does not promise grades or turn the page into a subscription ad", () => {
    assert.doesNotMatch(WHY_FILES, /better grades|scientifically proven|ADHD/i);
    assert.doesNotMatch(WHY_FILES, /subscription plan|recurring billing subscription/i);
    assert.doesNotMatch(WHY_FILES, /group session|classroom|cohort/i);
    assert.doesNotMatch(WHY_FILES, /Plan → Focus → Finish|You don't need another tutor/);
  });
});

describe("Galaxy 1B — Galaxy 1A reuse, no homepage rewrite", () => {
  it("reuses Galaxy header, portal preview, and tokens without changing the homepage story", () => {
    const home = read("src/app/(marketing)/page.tsx");
    assert.match(home, /HomeHero/);
    assert.match(home, /HomeExplainer/);
    assert.match(home, /HomeEvening/);
    assert.match(home, /HomePortal/);
    assert.match(home, /HomePricing/);
    assert.match(read("src/app/(marketing)/how-it-works/page.tsx"), /className="sh-home sh-galaxy"/);
    assert.match(read("src/app/(marketing)/why-it-works/page.tsx"), /className="sh-home sh-galaxy"/);
    assert.match(read("src/app/(marketing)/how-it-works/page.tsx"), /HomeHeaderScroll/);
    assert.match(read("src/components/marketing/home/hero.tsx"), /Give your child an edge\./);
    assert.match(read("src/lib/pricing.ts"), /FREE_TRIAL_CTA = "Try your first Study Hall free"/);
  });
});
