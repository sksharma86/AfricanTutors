import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Portal navigation — Management (admin)", () => {
  const shell = read("src/components/dashboard/dashboard-shell.tsx");
  const sideNav = read("src/components/dashboard/dashboard-side-nav.tsx");
  const admin = read("src/app/dashboard/admin/page.tsx");
  const studyHalls = read("src/app/dashboard/admin/study-halls/page.tsx");
  const guides = read("src/app/dashboard/admin/guides/page.tsx");
  const customers = read("src/app/dashboard/admin/customers/page.tsx");
  const finance = read("src/app/dashboard/admin/finance/page.tsx");

  it("ADMIN_PORTAL_NAV exposes real Overview, Study Halls, Guides, Customers, Finance destinations", () => {
    assert.match(shell, /ADMIN_PORTAL_NAV/);
    assert.match(shell, /label: "Overview".*href: "\/dashboard\/admin"/s);
    assert.match(shell, /label: "Study Halls".*href: "\/dashboard\/admin\/study-halls"/s);
    assert.match(shell, /label: "Guides".*href: "\/dashboard\/admin\/guides"/s);
    assert.match(shell, /label: "Customers".*href: "\/dashboard\/admin\/customers"/s);
    assert.match(shell, /label: "Finance".*href: "\/dashboard\/admin\/finance"/s);
    assert.doesNotMatch(shell, /#overview|#guide-approvals|#sessions/);
    assert.doesNotMatch(shell, /Settings/);
    assert.doesNotMatch(shell, /Soon|SOON|available:\s*false/);
  });

  it("each Management destination is its own authorized page", () => {
    assert.match(admin, /navItems=\{ADMIN_PORTAL_NAV\}/);
    assert.match(admin, /requireRole\("admin"/);
    assert.match(studyHalls, /requireRole\("admin"/);
    assert.match(guides, /requireRole\("admin"/);
    assert.match(customers, /requireRole\("admin"/);
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

  it("GUIDE_PORTAL_NAV exposes Home, Study Halls, Availability, Earnings — no Messages", () => {
    const nav = read("src/lib/guide-portal.mjs");
    assert.match(shell, /GUIDE_PORTAL_NAV/);
    assert.match(nav, /label: "Home".*href: "\/dashboard\/tutor"/s);
    assert.match(nav, /label: "Study Halls".*href: "\/dashboard\/tutor\/study-halls"/s);
    assert.match(nav, /label: "Availability".*href: "\/dashboard\/tutor\/availability"/s);
    assert.match(nav, /label: "Earnings".*href: "\/dashboard\/tutor\/earnings"/s);
    assert.doesNotMatch(nav, /Messages|#study-halls|#earnings|#availability/);
  });

  it("Guide destinations are real authorized routes", () => {
    const halls = read("src/app/dashboard/tutor/study-halls/page.tsx");
    const avail = read("src/app/dashboard/tutor/availability/page.tsx");
    const earn = read("src/app/dashboard/tutor/earnings/page.tsx");
    assert.match(guide, /requireRole\("tutor"/);
    assert.match(halls, /requireRole\("tutor"/);
    assert.match(avail, /requireRole\("tutor"/);
    assert.match(earn, /requireRole\("tutor"/);
    assert.match(guide, /GuidePage|GuideShell/);
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
    assert.match(sideNav, /whitespace-nowrap/);
    assert.match(sideNav, /snap-x/);
    assert.match(shell, /lg:sticky/);
    assert.match(sideNav, /focus-visible:outline/);
    assert.match(shell, /label: "Overview"/);
    assert.match(shell, /label: "Study Halls"/);
    assert.match(shell, /label: "Guides"/);
    assert.match(shell, /label: "Customers"/);
    assert.match(shell, /label: "Finance"/);
  });
});
