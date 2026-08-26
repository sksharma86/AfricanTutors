import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Portal navigation — Management (admin)", () => {
  const shell = read("src/components/dashboard/dashboard-shell.tsx");
  const sideNav = read("src/components/dashboard/dashboard-side-nav.tsx");
  const admin = read("src/app/dashboard/admin/page.tsx");
  const finance = read("src/app/dashboard/admin/finance/page.tsx");

  it("ADMIN_PORTAL_NAV exposes real Overview, Approvals, Sessions, Finance destinations", () => {
    assert.match(shell, /ADMIN_PORTAL_NAV/);
    assert.match(shell, /label: "Overview".*href: "\/dashboard\/admin#overview"/s);
    assert.match(shell, /label: "Guide Approvals".*href: "\/dashboard\/admin#guide-approvals"/s);
    assert.match(shell, /label: "Sessions".*href: "\/dashboard\/admin#sessions"/s);
    assert.match(shell, /label: "Finance".*href: "\/dashboard\/admin\/finance"/s);
    assert.doesNotMatch(shell, /Settings/);
    assert.doesNotMatch(shell, /Soon|SOON|available:\s*false/);
  });

  it("admin page wires section anchors and uses ADMIN_PORTAL_NAV", () => {
    assert.match(admin, /navItems=\{ADMIN_PORTAL_NAV\}/);
    assert.match(admin, /id="overview"/);
    assert.match(admin, /id="guide-approvals"/);
    assert.match(admin, /id="sessions"/);
    assert.doesNotMatch(admin, /Settings|available:\s*false|Soon/);
  });

  it("finance console shares Management nav and stays requireRole admin", () => {
    assert.match(finance, /navItems=\{ADMIN_PORTAL_NAV\}/);
    assert.match(finance, /requireRole\("admin"/);
    assert.match(finance, /DashboardShell/);
  });

  it("side nav uses Link semantics with aria-current and no inert Soon badges", () => {
    assert.match(sideNav, /from "next\/link"/);
    assert.match(sideNav, /<Link/);
    assert.match(sideNav, /aria-current/);
    assert.match(sideNav, /IntersectionObserver/);
    assert.doesNotMatch(sideNav, />\s*Soon\s*</);
    assert.doesNotMatch(sideNav, /available/);
  });
});

describe("Portal navigation — Guide", () => {
  const shell = read("src/components/dashboard/dashboard-shell.tsx");
  const guide = read("src/app/dashboard/tutor/page.tsx");
  const applicant = read("src/app/dashboard/applicant/page.tsx");

  it("GUIDE_PORTAL_NAV exposes Study Halls, Earnings, Availability — no Messages", () => {
    assert.match(shell, /GUIDE_PORTAL_NAV/);
    assert.match(shell, /label: "Study Halls".*href: "\/dashboard\/tutor#study-halls"/s);
    assert.match(shell, /label: "Earnings".*href: "\/dashboard\/tutor#earnings"/s);
    assert.match(shell, /label: "Availability".*href: "\/dashboard\/tutor#availability"/s);
    assert.doesNotMatch(shell, /Messages/);
  });

  it("Guide page sections match nav hashes and use GUIDE_PORTAL_NAV", () => {
    assert.match(guide, /navItems=\{GUIDE_PORTAL_NAV\}/);
    assert.match(guide, /id="study-halls"/);
    assert.match(guide, /id="earnings"/);
    assert.match(guide, /id="availability"/);
    assert.match(guide, /requireRole\("tutor"/);
    assert.doesNotMatch(guide, /Messages|available:\s*false|Soon/);
  });

  it("applicant portal removes SOON workspace/earnings stubs", () => {
    assert.match(applicant, /label: "Application"/);
    assert.match(applicant, /href: "\/dashboard\/applicant"/);
    assert.doesNotMatch(applicant, /Guide workspace|available:\s*false|Soon|Earnings/);
  });
});

describe("Portal navigation — mobile + a11y surface", () => {
  const sideNav = read("src/components/dashboard/dashboard-side-nav.tsx");
  const shell = read("src/components/dashboard/dashboard-shell.tsx");

  it("mobile strip remains reachable without disappearing", () => {
    assert.match(sideNav, /overflow-x-auto/);
    assert.match(sideNav, /lg:flex-col/);
    assert.match(shell, /lg:sticky/);
    assert.match(sideNav, /focus-visible:outline/);
  });
});
