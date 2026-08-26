import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Pre-launch functional UX — brand + confirmation", () => {
  it("SITE_NAME and lockup use Study Hall (at home)", () => {
    const constants = read("src/lib/constants.ts");
    const lockup = read("src/components/brand/brand-lockup.tsx");
    const card = read("src/components/auth/auth-card.tsx");
    assert.match(constants, /SITE_NAME = "Study Hall \(at home\)"/);
    assert.match(lockup, /Study Hall[\s\S]*\(at home\)/);
    assert.match(card, /Study Hall[\s\S]*\(at home\)/);
    assert.doesNotMatch(constants, /Study Hall at Home/);
  });

  it("FAQ brand question matches homepage filter", () => {
    const faq = read("src/lib/faq.ts");
    const home = read("src/app/(marketing)/page.tsx");
    assert.match(faq, /What is Study Hall \(at home\)\?/);
    assert.match(home, /What is Study Hall \(at home\)\?/);
    assert.doesNotMatch(faq, /What is Study Hall at Home\?/);
  });

  it("auth callback prefers role home; confirmed fallback has Sign in", () => {
    const callback = read("src/app/auth/callback/route.ts");
    const confirmed = read("src/app/auth/confirmed/page.tsx");
    assert.match(callback, /resolvePostAuthHome/);
    assert.match(callback, /status=confirmed/);
    assert.doesNotMatch(callback, /redirect\(new URL\("\/"/);
    assert.match(confirmed, /Email confirmed/);
    assert.match(confirmed, /Study Hall \(at home\)/);
    assert.match(confirmed, /LinkButton href="\/login"/);
  });
});

describe("Pre-launch functional UX — phone + packages + applicant gates", () => {
  it("phone form explains Call Parent, privacy, and no third-party sale", () => {
    const phone = read("src/components/dashboard/parent-phone-form.tsx");
    assert.match(phone, /Call Parent/);
    assert.match(phone, /never shared with Guides/i);
    assert.match(phone, /sell or release/i);
    assert.match(phone, /third parties/i);
    assert.match(phone, /router\.refresh\(\)/);
  });

  it("package credit redeem refreshes balance; checkout return deep-links prepaid", () => {
    const store = read("src/components/booking/package-store.tsx");
    const ret = read("src/app/checkout/return/return-view.tsx");
    const shell = read("src/components/dashboard/customer-shell.tsx");
    assert.match(store, /router\.refresh\(\)/);
    assert.match(store, /never expire/);
    assert.match(ret, /packages#prepaid/);
    assert.match(shell, /packages#prepaid/);
  });

  it("checkout service blocks Guide applicants from booking and packages", () => {
    const checkout = read("src/lib/checkout-service.ts");
    assert.match(checkout, /assertNotGuideApplicant/);
    assert.match(checkout, /getGuideApplicantInfo/);
    assert.match(checkout, /Guide application is under review/);
  });

  it("homepage and pricing gate applicants away from parent Book CTAs", () => {
    const home = read("src/app/(marketing)/page.tsx");
    const pricing = read("src/app/(marketing)/pricing/page.tsx");
    assert.match(home, /getGuideApplicantInfo/);
    assert.match(home, /View application status/);
    assert.match(home, /\/dashboard\/applicant/);
    assert.match(pricing, /getGuideApplicantInfo/);
    assert.match(pricing, /packages#prepaid/);
    assert.match(pricing, /View application status/);
  });
});

describe("Pre-launch functional UX — booking picker", () => {
  it("date strip keeps Continue sticky and avoids hidden scrollbars", () => {
    const wizard = read("src/components/booking/booking-wizard.tsx");
    assert.match(wizard, /showAllDates/);
    assert.match(wizard, /Show more dates/);
    assert.match(wizard, /Scroll sideways for more dates/);
    assert.match(wizard, /sticky bottom-0/);
    assert.match(wizard, /Select a date and time, then tap Continue/);
    assert.doesNotMatch(wizard, /\[scrollbar-width:none\]/);
    assert.doesNotMatch(wizard, /\[&::-webkit-scrollbar\]:hidden/);
    assert.match(wizard, /MIN_BOOKING_NOTICE_MINUTES/);
  });
});
