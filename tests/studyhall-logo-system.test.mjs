import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { bookingConfirmed } from "../src/lib/email/templates.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Study Hall logo system — architecture", () => {
  it("exposes StudyHallMark and StudyHallLogo as the production system", () => {
    const mark = read("src/components/brand/study-hall-mark.tsx");
    const logo = read("src/components/brand/study-hall-logo.tsx");
    const lockup = read("src/components/brand/brand-lockup.tsx");
    assert.match(mark, /export function StudyHallMark/);
    assert.match(logo, /export function StudyHallLogo/);
    assert.match(logo, /StudyHallMark/);
    assert.match(lockup, /StudyHallLogo/);
    assert.doesNotMatch(mark, /<image |xlink:href|data:image/);
    assert.doesNotMatch(logo, /<text |font-family=/);
  });

  it("mark SVG uses a viewBox and simple house + desk + lamp geometry", () => {
    const geom = read("src/lib/brand/study-hall-mark.ts");
    const mark = read("src/components/brand/study-hall-mark.tsx");
    assert.match(geom, /MARK_VIEWBOX = "0 0 32 32"/);
    assert.match(geom, /HOUSE_PATH/);
    assert.match(geom, /LAMP_SHADE/);
    assert.match(geom, /DESK_TOP/);
    assert.match(geom, /CHAIR_BACK/);
    assert.match(mark, /viewBox=\{MARK_VIEWBOX\}/);
    assert.match(mark, /compact/);
    assert.match(geom, /size <= 24/);
  });

  it("light / dark / mono variants use the existing gold + ink palette", () => {
    const geom = read("src/lib/brand/study-hall-mark.ts");
    assert.match(geom, /MARK_INK = "#0c0c0b"/);
    assert.match(geom, /MARK_GOLD = "#c98816"/);
    assert.match(geom, /MARK_GOLD_DARK = "#e9b754"/);
    assert.match(geom, /"light" \| "dark" \| "mono"/);
    assert.doesNotMatch(geom, /linearGradient|radialGradient/);
  });

  it("wordmark stays site typography, not SVG text paths", () => {
    const logo = read("src/components/brand/study-hall-logo.tsx");
    assert.match(logo, /Study Hall <span[\s\S]*\(at home\)/);
    assert.doesNotMatch(logo, /<text |<path[^>]+Study/);
  });
});

describe("Study Hall logo system — surfaces", () => {
  it("public header and footer use the product lockup", () => {
    const nav = read("src/components/layout/navbar.tsx");
    const footer = read("src/components/layout/footer.tsx");
    assert.match(nav, /BrandLockup/);
    assert.match(footer, /BrandLockup/);
    assert.match(read("src/components/brand/brand-lockup.tsx"), /StudyHallLogo/);
  });

  it("auth card uses StudyHallLogo", () => {
    assert.match(read("src/components/auth/auth-card.tsx"), /StudyHallLogo href="\/"/);
    assert.match(read("src/app/(marketing)/login/page.tsx"), /AuthCard/);
    assert.match(read("src/app/(marketing)/signup/page.tsx"), /AuthCard/);
    assert.match(read("src/app/(marketing)/apply-to-tutor/page.tsx"), /AuthCard/);
    assert.match(read("src/app/(marketing)/forgot-password/page.tsx"), /AuthCard/);
    assert.match(read("src/app/auth/confirmed/page.tsx"), /AuthCard/);
  });

  it("portals keep BrandLockup chrome and do not flatten role shells", () => {
    const parent = read("src/components/dashboard/customer-shell.tsx");
    const guide = read("src/components/dashboard/guide-shell.tsx");
    const mgmt = read("src/components/dashboard/management-shell.tsx");
    assert.match(parent, /BrandLockup/);
    assert.match(guide, /BrandLockup/);
    assert.match(mgmt, /BrandLockup/);
    assert.match(parent, /parent-app/);
    assert.match(guide, /guide-app/);
    assert.match(mgmt, /management-app/);
    assert.match(guide, /Guide workstation/);
    assert.match(mgmt, /Management/);
  });

  it("live room adds the dark mark without touching Daily, camera, or Call Parent", () => {
    const room = read("src/components/session/session-room.tsx");
    assert.match(room, /StudyHallMark/);
    assert.match(room, /variant="dark"/);
    assert.match(room, /createFrame/);
    assert.match(room, /CallParentControl/);
    assert.match(room, /setLocalVideo\(true\)/);
    assert.match(room, /start_cloud_recording|Recording/);
  });
});

describe("Study Hall logo system — email, favicon, a11y", () => {
  it("email header is styled HTML text, not a remote SVG", () => {
    const templates = read("src/lib/email/templates.mjs");
    assert.match(templates, /const BRAND = "Study Hall \(at home\)"/);
    assert.match(templates, /<span style="font-weight:700[\s\S]*Study Hall/);
    assert.match(templates, /\(at home\)/);
    assert.doesNotMatch(templates, /<svg |<img[^>]+logo|\.svg/);
    const mail = bookingConfirmed({
      whenISO: "2026-09-04T17:00:00.000Z",
      tz: "UTC",
      durationMinutes: 60,
      studentName: "Maya",
      appUrl: "https://studyhallathome.com",
      bookingId: "00000000-0000-0000-0000-000000000001",
    });
    assert.match(mail.html, /Study Hall/);
    assert.match(mail.html, /\(at home\)/);
    assert.match(mail.html, /https:\/\/studyhallathome.com\/dashboard\/session\/00000000-0000-0000-0000-000000000001/);
    assert.doesNotMatch(mail.html, /<svg /);
  });

  it("favicon is the simplified mark, not the wordmark", () => {
    const icon = read("src/app/icon.svg");
    const apple = read("src/app/apple-icon.tsx");
    const layout = read("src/app/layout.tsx");
    assert.match(icon, /viewBox="0 0 32 32"/);
    assert.match(icon, /#0c0c0b/);
    assert.match(icon, /#c98816/);
    assert.match(icon, /aria-label="Study Hall \(at home\)"/);
    assert.doesNotMatch(icon, /<text |<image /);
    assert.match(apple, /width: 180/);
    assert.match(layout, /icon\.svg/);
    assert.match(layout, /applicationName: SITE_NAME/);
  });

  it("decorative marks are hidden; linked logos keep an accessible name", () => {
    const mark = read("src/components/brand/study-hall-mark.tsx");
    const logo = read("src/components/brand/study-hall-logo.tsx");
    assert.match(mark, /aria-hidden=\{labelled \? undefined : true\}/);
    assert.match(logo, /aria-label=\{markOnly \? "Study Hall \(at home\)" : undefined\}/);
    assert.match(logo, /Study Hall <span/);
  });

  it("exposes an isolated /brand visual review outside marketing chrome", () => {
    const page = read("src/app/brand/page.tsx");
    assert.match(page, /StudyHallLogo/);
    assert.match(page, /StudyHallMark/);
    assert.match(page, /CustomerShell/);
    assert.match(page, /GuideShell/);
    assert.match(page, /ManagementShell/);
    assert.match(page, /robots: \{ index: false/);
  });

  it("does not rename AfricanTutors infrastructure identifiers", () => {
    const pkg = read("package.json");
    assert.match(pkg, /"name": "african-tutors"/);
  });
});
