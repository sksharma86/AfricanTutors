import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  PACKAGE_10SH_PRICE_CENTS,
  STUDY_HALL_365_MONTHLY_USD,
  STUDY_HALL_365_PRODUCT_NAME,
} from "../src/lib/study-hall-365/catalog.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const HOME_FILES = [
  "src/app/(marketing)/page.tsx",
  "src/components/marketing/home/hero.tsx",
  "src/components/marketing/home/explainer.tsx",
  "src/components/marketing/home/evening.tsx",
  "src/components/marketing/home/portal.tsx",
  "src/components/marketing/home/portal-reveal.tsx",
  "src/components/marketing/home/portal-stage.tsx",
  "src/components/marketing/home/pricing.tsx",
];
const home = HOME_FILES.map(read).join("\n");

describe("Galaxy 2 homepage — one continuous story with the approved copy", () => {
  it("keeps the five moments in narrative order: family → child → parent → product → routine", () => {
    const page = read("src/app/(marketing)/page.tsx");
    const jsx = page.slice(page.indexOf("return"));
    const order = ["HomeHero", "HomeExplainer", "HomeEvening", "HomePortal", "HomePricing"];
    let last = -1;
    for (const name of order) {
      const i = jsx.indexOf(name);
      assert.ok(i > last, `${name} must follow previous section`);
      last = i;
    }
    assert.match(page, /HomeHeaderScroll/);
    assert.match(page, /export const metadata/);
  });

  it("anchors every moment on the approved messaging, verbatim", () => {
    const hero = read("src/components/marketing/home/hero.tsx");
    assert.match(hero, /HOME_HERO_HEADLINE = "Give your child an edge\."/);
    assert.match(hero, /Private, one on one Study Halls\. Right at home\./);
    assert.match(hero, /No credit card required/);
    assert.match(hero, /FREE_TRIAL_CTA/);

    const hour = read("src/components/marketing/home/explainer.tsx");
    assert.match(hour, /A dedicated hour for getting things done\./);
    assert.match(hour, /keeps them focused, organized, and on task, whether they have work to finish or want to get ahead\./);
    for (const use of ["Homework", "Studying", "Test prep", "Reviewing", "Reading", "Organizing"]) {
      assert.match(hour, new RegExp(`"${use}"`));
    }

    const evening = read("src/components/marketing/home/evening.tsx");
    assert.match(evening, /HOME_EVENING_HEADLINE = "Get an hour of your evening back\."/);
    assert.match(evening, /Homework time\? We got this\./);
    assert.match(evening, /Did you start your homework\?/);
    assert.match(evening, /Put your phone away\./);
    assert.match(evening, /What are you supposed to be working on\?/);
    assert.match(evening, /Please focus\./);
    assert.match(evening, /Did you finish everything\?/);
    assert.match(evening, /Homework started\./);
    assert.match(evening, /Phone away\./);
    assert.match(evening, /Tonight’s work organized\./);
    assert.match(evening, /Focused and working\./);
    assert.match(evening, /Study Hall complete\./);

    assert.match(read("src/components/marketing/home/portal.tsx"), /Everything in one place\./);

    const pricing = read("src/components/marketing/home/pricing.tsx");
    assert.match(pricing, /Unlimited Study Halls, one per day, every day of the year\./);
    assert.match(pricing, /Use them when you want, at the times that work for your family\./);
    assert.match(pricing, /Make it a routine\./);
    assert.match(pricing, /HOME_ROUTINE_HEADLINE = "It becomes part of the week\."/);
    assert.match(
      pricing,
      /Study Hall has a time\. Your child knows when to sit down, get started, and get the work done\./,
    );
    assert.doesNotMatch(pricing, /The hour becomes expected|It’s Study Hall time/);
  });

  it("sets every editorial statement whole: no arbitrary single-word italics", () => {
    assert.doesNotMatch(home, /<em>|EditorialLine|accent=/);
    assert.doesNotMatch(read("src/app/globals.css"), /\.sh-home-display em\b/);
  });

  it("tells parent relief as before adoption versus the established routine, not two clocks in one evening", () => {
    const evening = read("src/components/marketing/home/evening.tsx");
    assert.match(evening, /HOME_EVENING_BEFORE_LABEL = "Before Study Hall"/);
    assert.match(evening, /HOME_EVENING_AFTER_LABEL = "With Study Hall"/);
    assert.match(evening, /routine/i);
    assert.doesNotMatch(evening, /\b6:47\b|\b7:00\b|PM<\/span>|__clock|__meridiem/);
    const before = evening.indexOf("sh-home-evening__before");
    const after = evening.indexOf("sh-home-evening__after");
    const land = evening.indexOf("sh-home-evening__land");
    assert.ok(before > 0 && after > before && land > after, "before → with → statement");
    assert.match(evening, /sh-home-evening__land-media[\s\S]*sh-home-evening__land-shade[\s\S]*sh-home-evening__land-rule/);
  });

  it("never swaps the specific brand voice for generic marketing language", () => {
    assert.doesNotMatch(
      home,
      /unlock your child|empowering students|personalized learning|academic journey|transform their|potential\b/i,
    );
    assert.doesNotMatch(home, /Study Hall Unlimited|Unlimited plan|Try it once/i);
    assert.doesNotMatch(home, /not tutoring|do not tutor|do not teach/i);
    assert.doesNotMatch(home, /sibling/i);
  });

  it("keeps the header restrained: four links, Sign In, Try It Free", () => {
    const constants = read("src/lib/constants.ts");
    const navBlock = constants.slice(constants.indexOf("PUBLIC_NAV_LINKS"), constants.indexOf("] as const;"));
    assert.deepEqual(
      [...navBlock.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]),
      ["How It Works", "Why It Works", "Pricing", "FAQ"],
    );
    const nav = read("src/components/layout/navbar.tsx");
    const mobile = read("src/components/layout/mobile-menu.tsx");
    assert.match(read("src/lib/public-offers.ts"), /NAV_TRIAL_CTA = "Try It Free"/);
    assert.match(nav, /Sign In/);
    assert.match(nav, /NAV_TRIAL_CTA/);
    assert.match(mobile, /Sign In/);
    assert.match(mobile, /NAV_TRIAL_CTA/);
  });
});

describe("Galaxy 2 homepage — product truth", () => {
  it("reveals the real Parent Portal Home, not a fictional dashboard", () => {
    const stage = read("src/components/marketing/home/portal-stage.tsx");
    const reveal = read("src/components/marketing/home/portal-reveal.tsx");
    assert.match(stage, /PARENT_PORTAL_NAV/);
    assert.match(stage, /Next Study Hall/);
    assert.match(stage, /Join Study Hall →/);
    assert.match(stage, /Your Study Hall Week/);
    assert.match(stage, /Plan my week/);
    assert.match(stage, /Book a Study Hall/);
    assert.match(stage, /Household/);
    assert.match(stage, /Recent Study Hall/);
    assert.match(stage, /Report ready/);
    assert.match(stage, /Recording ready/);
    assert.match(stage, /Read report/);
    assert.match(stage, /Watch recording/);
    assert.match(stage, /Study Halls remaining/);
    for (const region of ["plan", "next", "join", "review"]) {
      assert.match(stage, new RegExp(`data-region="${region}"`));
    }
    assert.doesNotMatch(stage, /Matching|AI tutor|live chat|leaderboard|streak|grade tracker|messages|chat/i);

    for (const title of ["Plan the week.", "Join when it’s time.", "See what happened.", "Keep everything in one place."]) {
      assert.ok(reveal.includes(title), `reveal step "${title}"`);
    }
    assert.equal([...reveal.matchAll(/^\s+id: "(plan|join|review|all)",$/gm)].length, 4, "exactly four steps");
    assert.match(reveal, /IntersectionObserver/);
    assert.match(reveal, /min-width: 1024px/);
    assert.match(read("src/components/marketing/home/portal.tsx"), /PortalReveal[\s\S]*PortalStage/);
  });

  it("composes the week as a compact day list with the real strip states, not seven crushed columns", () => {
    const stage = read("src/components/marketing/home/portal-stage.tsx");
    const css = read("src/app/globals.css");
    assert.doesNotMatch(stage, /pp-week-strip|pp-week-day/);
    assert.match(stage, /sh-home-portal__days/);
    for (const kind of ["completed", "none", "today", "scheduled"]) {
      assert.match(stage, new RegExp(`kind: "${kind}"`));
    }
    assert.match(stage, /mark: "✓"/);
    assert.match(stage, /mark: "—"/);
    assert.match(stage, /mark: "Today"/);
    assert.match(stage, /mark: "•"/);
    assert.equal([...stage.matchAll(/\{ day: "(Mon|Tue|Wed|Thu|Fri|Sat|Sun)"/g)].length, 7);
    assert.match(css, /\.sh-home-portal__day \{[\s\S]*grid-template-columns: 2\.4rem 1\.6rem minmax\(0, 1fr\) auto;/);
    assert.match(css, /\.sh-home-portal__day-label \{[\s\S]*white-space: nowrap;/);
    assert.match(css, /\.sh-home-portal__stage\[data-step="all"\] \[data-region\] \{[\s\S]*opacity: 1;/);
  });

  it("keeps homepage prices truthful to the catalog and the savings math", () => {
    const pricing = read("src/components/marketing/home/pricing.tsx");
    assert.equal(PACKAGE_10SH_PRICE_CENTS, 9900);
    assert.equal(STUDY_HALL_365_MONTHLY_USD, 149);
    assert.match(pricing, /PACKAGE_10SH_PRICE_CENTS/);
    assert.match(pricing, /STUDY_HALL_365_MONTHLY_USD/);
    assert.match(pricing, /PAYG_PRICE_USD/);
    assert.match(pricing, /Save \{formatUsd\(PACK_10_SAVINGS_USD\)\} when you buy ten\./);
    assert.doesNotMatch(pricing, /formatUsd\(99\)|"\$99"|"\$149"|"\$12"/);
  });

  it("names the three offers truthfully and gives Study Hall 365 the culminating weight", () => {
    const pricing = read("src/components/marketing/home/pricing.tsx");
    const payg = pricing.indexOf('data-offer="payg"');
    const pack = pricing.indexOf('data-offer="alacarte"');
    const flagship = pricing.indexOf('data-offer="study-hall-365"');
    assert.ok(payg > 0 && pack > payg && flagship > pack, "options read one → ten → 365");
    assert.match(pricing, /HOME_PAYG_NAME = "One Study Hall"/);
    assert.match(pricing, /HOME_PACK_NAME = `\$\{PACKAGE_10SH_STUDY_HALLS\} Study Halls`/);
    assert.match(pricing, /HOME_365_NAME = STUDY_HALL_365_PRODUCT_NAME/);
    assert.equal(STUDY_HALL_365_PRODUCT_NAME, "Study Hall 365");
    assert.match(pricing, /sh-home-flagship/);
    assert.match(pricing, /sh-home-option/);
    assert.match(pricing, /\{ctaLabel\}/);
    assert.doesNotMatch(pricing, /Choose \{HOME_365_NAME\}|Get started →/);
    assert.match(pricing, /location="pricing_365"/);
    assert.match(pricing, /location="closing"/);
  });

  it("fits the sticky Parent Portal to the viewport as one scaled object", () => {
    const reveal = read("src/components/marketing/home/portal-reveal.tsx");
    const css = read("src/app/globals.css");
    assert.match(reveal, /PORTAL_DESIGN_WIDTH = 760/);
    assert.match(reveal, /STAGE_MIN_SCALE = 0\.7/);
    assert.match(reveal, /ResizeObserver/);
    assert.match(reveal, /window\.innerHeight - headerH/);
    assert.match(reveal, /Math\.min\(1, widthScale, heightScale\)/);
    assert.match(reveal, /--sh-portal-scale/);
    assert.match(reveal, /--sh-portal-top/);
    assert.match(css, /--sh-portal-design-width: 760px/);
    assert.match(css, /zoom: var\(--sh-portal-scale/);
    assert.match(css, /top: var\(--sh-portal-top/);
    assert.doesNotMatch(css, /max-height: 940px|max-height: 780px|max-height: 680px/);
  });

  it("keeps trust quiet: no badge strip, no invented credentials", () => {
    assert.doesNotMatch(home, /shield|lock icon|certified|background[- ]check|guarantee|COPPA|SOC ?2|encrypted/i);
    assert.doesNotMatch(home, /testimonial|as seen in|featured in|★|5[- ]star/i);
    assert.match(read("src/components/marketing/home/pricing.tsx"), /highly vetted Study Hall Guide/);
  });

  it("uses editorial photography, not the old placeholder plates, for the new moments", () => {
    assert.match(read("src/components/marketing/home/hero.tsx"), /galaxy-hero-evening\.webp/);
    assert.match(read("src/components/marketing/home/explainer.tsx"), /galaxy-hour-intimate\.webp/);
    assert.match(read("src/components/marketing/home/evening.tsx"), /galaxy-evening-647\.webp/);
    assert.match(read("src/components/marketing/home/evening.tsx"), /studyhall-routine-evening\.webp/);
    assert.match(read("src/components/marketing/home/pricing.tsx"), /galaxy-routine-desk\.webp/);
    const readme = read("public/images/README.md");
    for (const plate of ["galaxy-hero-evening", "galaxy-evening-647", "galaxy-hour-intimate", "galaxy-routine-desk"]) {
      assert.match(readme, new RegExp(plate));
    }
  });
});
