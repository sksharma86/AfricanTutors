import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const FAQ_PRIORITY = [
  "Is this tutoring?",
  "What does the Guide actually do?",
  "Can my child ask for homework help?",
  "Who are the Guides?",
  "Are sessions recorded?",
  "How long can I access recordings?",
  "Can siblings participate?",
  "Do prepaid hours expire?",
  "Can I cancel?",
  "What equipment does my child need?",
  "How does the free first session work?",
];

describe("Visual overhaul — brand + composition contracts", () => {
  it("hero is brand-led and does not use fabricated portal imagery", () => {
    const hero = read("src/components/marketing/site-hero.tsx");
    assert.match(hero, /Study Hall \(at home\)/);
    assert.match(hero, /Homework gets done/);
    assert.match(hero, /See how it works/);
    assert.match(hero, /STARTING_AT_LABEL/);
    assert.doesNotMatch(hero, /HeroProductVisual/);
    assert.doesNotMatch(hero, /Kenya/);
  });

  it("homepage composition remains auth-aware and FAQ-branded", () => {
    const home = read("src/app/(marketing)/page.tsx");
    assert.match(home, /FREE_TRIAL_CTA/);
    assert.match(home, /getGuideApplicantInfo/);
    assert.match(home, /What is Study Hall \(at home\)\?/);
    assert.match(home, /Is this tutoring\?/);
  });

  it("customer-facing CTA uses Try your first Study Hall free", () => {
    const pricing = read("src/lib/pricing.ts");
    assert.match(pricing, /FREE_TRIAL_CTA = "Try your first Study Hall free"/);
    assert.match(pricing, /STARTING_AT_LABEL/);
    assert.match(pricing, /PAYG_PRICE_USD = 12/);
  });

  it("how-it-works steps explain supervision, not tutoring", () => {
    const steps = read("src/components/marketing/steps.tsx");
    assert.match(steps, /Book a Study Hall/);
    assert.match(steps, /do not tutor/i);
    assert.match(steps, /session report/i);
    assert.doesNotMatch(steps, /Kenya/);
  });

  it("trust copy stays policy-accurate", () => {
    const trust = read("src/components/marketing/trust-safety.tsx");
    assert.match(trust, /recorded for quality and safety/i);
    assert.match(trust, /approved before they work with families/i);
    assert.match(trust, /60 days/);
    assert.doesNotMatch(trust, /background check|insured|certified|100% safe/i);
    assert.doesNotMatch(trust, /Kenya/);
  });

  it("FAQ covers parent evaluation questions with policy-accurate answers", () => {
    const faq = read("src/lib/faq.ts");
    for (const q of FAQ_PRIORITY) {
      assert.match(faq, new RegExp(q.replace(/[?]/g, "\\?")));
    }
    assert.match(faq, /never expire/i);
    assert.match(faq, /Guides work remotely from Kenya/);
    assert.doesNotMatch(faq, /two weeks|four weeks/i);
  });

  it("pricing presentation is simple and does not imply package weeks", () => {
    const pricing = read("src/components/marketing/pricing-section.tsx");
    assert.match(pricing, /First Study Hall/);
    assert.match(pricing, /Pay as you go/);
    assert.match(pricing, /never expire/);
    assert.doesNotMatch(pricing, /two weeks|four weeks|2-week|4-week/i);
  });

  it("auth surfaces use the product brand lockup", () => {
    const card = read("src/components/auth/auth-card.tsx");
    assert.match(card, /BrandLockup/);
    assert.match(card, /variant="product"/);
  });

  it("parent dashboard keeps Book CTA, hours, and package deep-link", () => {
    const dash = read("src/app/dashboard/student/page.tsx");
    const balance = read("src/components/dashboard/balance-cards.tsx");
    assert.match(dash, /Next Study Hall/);
    assert.match(dash, /Book a Study Hall/);
    assert.match(balance, /Buy hours &amp; save|Buy hours & save/);
    assert.match(balance, /packages#prepaid/);
  });

  it("booking wizard keeps step progression and Continue without nested scroll traps", () => {
    const wizard = read("src/components/booking/booking-wizard.tsx");
    assert.match(wizard, /Who is this Study Hall for/);
    assert.match(wizard, /Choose a date/);
    assert.match(wizard, /Continue/);
    assert.doesNotMatch(wizard, /max-h-96/);
  });

  it("Guide and Management portals keep real PR43 navigation", () => {
    const shell = read("src/components/dashboard/dashboard-shell.tsx");
    assert.match(shell, /Study Halls/);
    assert.match(shell, /Earnings/);
    assert.match(shell, /Availability/);
    assert.match(shell, /Overview/);
    assert.match(shell, /Guide Approvals/);
    assert.match(shell, /Sessions/);
    assert.match(shell, /Finance/);
    assert.doesNotMatch(shell, /Messages SOON|Settings SOON/);
  });

  it("applicant status communicates received / review / next steps", () => {
    const panel = read("src/components/dashboard/guide-applicant-panel.tsx");
    assert.match(panel, /Application received/);
    assert.match(panel, /Under review/);
    assert.match(panel, /What happens next/);
  });

  it("reports distinguish date, Guide, processing, ready, and 60-day access", () => {
    const reports = read("src/components/dashboard/session-reports-list.tsx");
    assert.match(reports, /Guide:/);
    assert.match(reports, /Recording processing/);
    assert.match(reports, /Recording ready/);
    assert.match(reports, /Available for 60 days/);
    assert.match(reports, /WatchRecordingButton/);
  });

  it("session entry chrome states T−5 and Join without rewriting Daily", () => {
    const room = read("src/components/session/session-room.tsx");
    assert.match(room, /Join Study Hall/);
    assert.match(room, /5 minutes before start/);
    assert.match(room, /CallParentControl/);
    assert.match(room, /@daily-co\/daily-js/);
  });

  it("runtime UI avoids Study Hall at Home and African Tutors wordmarks", () => {
    const surfaces = [
      "src/app/(marketing)/page.tsx",
      "src/components/marketing/site-hero.tsx",
      "src/components/auth/auth-card.tsx",
      "src/app/dashboard/student/page.tsx",
      "src/components/dashboard/guide-applicant-panel.tsx",
      "src/components/dashboard/balance-cards.tsx",
      "src/app/(marketing)/login/page.tsx",
      "src/app/(marketing)/signup/page.tsx",
    ]
      .map(read)
      .join("\n");
    assert.doesNotMatch(surfaces, /Study Hall at Home/);
    assert.doesNotMatch(surfaces, /African Tutors/);
    assert.doesNotMatch(surfaces, /Tutoring Balance|Book tutoring/i);
  });
});
