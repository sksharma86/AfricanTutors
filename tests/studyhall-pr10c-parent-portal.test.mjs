import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("PR10C — parent portal usability (source)", () => {
  const dash = read("src/app/dashboard/student/page.tsx");
  const next = read("src/components/dashboard/parent-next-study-hall.tsx");
  const helpers = read("src/lib/parent-portal.mjs");
  const shell = read("src/components/dashboard/customer-shell.tsx");
  const balance = read("src/components/dashboard/balance-cards.tsx");
  const packages = read("src/app/dashboard/student/packages/page.tsx");
  const wizard = read("src/components/booking/booking-wizard.tsx");
  const phone = read("src/components/dashboard/parent-phone-form.tsx");

  it("nav is parent-simple: Home, Study Halls, Reports & Recordings, Hours, Account", () => {
    assert.match(helpers, /label:\s*"Home"/);
    assert.match(helpers, /label:\s*"Study Halls"/);
    assert.match(helpers, /label:\s*"Reports & Recordings"/);
    assert.match(helpers, /label:\s*"Hours"/);
    assert.match(helpers, /label:\s*"Account"/);
    assert.match(helpers, /\/dashboard\/student\/packages/);
    assert.match(shell, /PARENT_PORTAL_NAV/);
    assert.match(shell, /Book a Study Hall/);
    assert.doesNotMatch(helpers, /label:\s*"Packages"/);
    assert.doesNotMatch(helpers, /label:\s*"Dashboard"/);
  });

  it("dashboard hierarchy emphasizes Next Study Hall and Book CTA", () => {
    assert.match(dash, /ParentNextStudyHall/);
    assert.match(next, /Next Study Hall/);
    assert.match(next, /Book a Study Hall/);
    assert.match(balance, /Prepaid Hours/);
    assert.match(helpers, /Ready to join 5 minutes before start/);
    assert.doesNotMatch(next, /Join opens 5 minutes/);
    assert.doesNotMatch(next, /Opens at /);
    assert.doesNotMatch(dash, /Join opens 5 minutes/);
    assert.doesNotMatch(dash, /Opens at /);
  });

  it("free session offer only renders when eligible", () => {
    assert.match(dash, /freeTrialAvailable/);
    assert.match(dash, /Your first Study Hall is on us/);
    assert.match(dash, /Book free session/);
  });

  it("Prepaid Hours + Buy hours & save deep-links to prepaid packages", () => {
    assert.match(balance, /Prepaid Hours/);
    assert.match(balance, /0 hours/);
    assert.match(balance, /remaining/);
    assert.match(balance, /Buy hours &amp; save|Buy hours & save/);
    assert.match(balance, /packages#prepaid/);
    assert.match(packages, /id="prepaid"/);
    assert.match(packages, /Save with prepaid hours/);
  });

  it("booking date/time uses day strip without nested max-h scroll list", () => {
    assert.match(wizard, /Date & time|date &amp; time/);
    assert.match(wizard, /Available dates/);
    assert.doesNotMatch(wizard, /max-h-96/);
  });

  it("phone copy explains purpose without requiring portal open", () => {
    assert.match(phone, /never shared with Guides/i);
    assert.match(phone, /don.t need to keep this portal open/i);
    assert.doesNotMatch(phone, /Call Parent cannot reach you/);
  });

  it("customer-facing copy avoids tutoring booking language", () => {
    assert.doesNotMatch(dash, /Book a tutor|Book tutoring|Tutoring Balance/i);
    assert.doesNotMatch(shell, /Book a tutor|Tutoring Balance/i);
    assert.doesNotMatch(balance, /Tutoring Balance/i);
  });
});
