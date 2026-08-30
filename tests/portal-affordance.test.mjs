import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { GUIDE_PORTAL_NAV } from "../src/lib/guide-portal.mjs";
import { PARENT_PORTAL_NAV } from "../src/lib/parent-portal.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Portal affordance — shared primitives", () => {
  const segmented = read("src/components/ui/portal-segmented-control.tsx");
  const button = read("src/components/ui/button.tsx");
  const textLink = read("src/components/ui/portal-text-link.tsx");

  it("segmented control is a real tablist with selected, hover, and focus-visible states", () => {
    assert.match(segmented, /role="tablist"/);
    assert.match(segmented, /role="tab"/);
    assert.match(segmented, /aria-selected=\{selected\}/);
    assert.match(segmented, /aria-label=\{ariaLabel\}/);
    assert.match(segmented, /min-h-11/);
    assert.match(segmented, /focus-visible:outline/);
    assert.match(segmented, /bg-ink-900 text-white/);
    assert.match(segmented, /hover:bg-white hover:text-ink-900/);
    assert.match(segmented, /border border-ink-200 bg-ink-50/);
    assert.match(segmented, /ArrowRight/);
    assert.doesNotMatch(segmented, /border-b-2/);
    assert.doesNotMatch(segmented, /bg-gold-400/);
  });

  it("button hierarchy includes primary, secondary, outline, and destructive", () => {
    assert.match(button, /"primary" \| "secondary" \| "outline" \| "ghost" \| "destructive"/);
    assert.match(button, /destructive:/);
    assert.match(button, /border-red-300/);
    assert.match(button, /bg-ink-900 text-white/);
    assert.match(button, /bg-gold-400 text-ink-900/);
    assert.match(button, /disabled:bg-ink-100/);
    assert.match(button, /disabled:text-ink-400/);
    assert.match(button, /min-h-11/);
    assert.doesNotMatch(button, /disabled:opacity-50/);
  });

  it("tertiary text links stay reserved for low-priority hops", () => {
    assert.match(textLink, /Tertiary navigation only/);
    assert.match(textLink, /from "next\/link"/);
    assert.match(textLink, /focus-visible:outline/);
  });
});

describe("Portal affordance — view switchers", () => {
  it("Parent Study Halls use Upcoming / Past / Cancelled segmented controls", () => {
    const src = read("src/components/dashboard/parent-study-halls.tsx");
    assert.match(src, /PortalSegmentedControl/);
    assert.match(src, /Study Hall views/);
    assert.match(src, /Upcoming/);
    assert.match(src, /Past/);
    assert.match(src, /Cancelled/);
    assert.doesNotMatch(src, /border-b-2 border-ink-900/);
  });

  it("Guide Study Halls use Today / Upcoming / Completed segmented controls", () => {
    const src = read("src/components/dashboard/guide-study-halls.tsx");
    assert.match(src, /PortalSegmentedControl/);
    assert.match(src, /Today/);
    assert.match(src, /Upcoming/);
    assert.match(src, /Completed/);
    assert.doesNotMatch(src, /border-b-2 border-ink-900/);
  });

  it("Management Study Halls use Today / Upcoming / Needs Attention / Completed / Cancelled", () => {
    const src = read("src/components/dashboard/management-study-halls.tsx");
    assert.match(src, /PortalSegmentedControl/);
    assert.match(src, /Today/);
    assert.match(src, /Upcoming/);
    assert.match(src, /Needs Attention/);
    assert.match(src, /Completed/);
    assert.match(src, /Cancelled/);
    assert.doesNotMatch(src, /border-b-2 border-ink-900/);
  });

  it("Guide workforce uses Pending / Active / Suspended / Rejected controls", () => {
    const src = read("src/components/dashboard/admin-guides-directory.tsx");
    assert.match(src, /PortalSegmentedControl/);
    assert.match(src, /Guide workforce views/);
    assert.match(src, /Pending/);
    assert.match(src, /Active/);
    assert.match(src, /Suspended/);
    assert.match(src, /Rejected/);
    assert.match(src, /Pending applicants/);
    assert.match(src, /Guide workforce views/);
    assert.match(src, /ariaLabel/);
  });

  it("Finance uses Guide compensation / Customer money / Customer balances / Disputes controls", () => {
    const src = read("src/components/dashboard/admin-finance-console.tsx");
    assert.match(src, /ManagementSubnav/);
    assert.match(src, /Finance views/);
    assert.match(src, /Guide compensation/);
    assert.match(src, /Customer money/);
    assert.match(src, /Customer balances/);
    assert.match(src, /Disputes/);
    assert.doesNotMatch(src, /border-b-2 border-ink-900/);
    assert.doesNotMatch(src, /PortalSegmentedControl/);
  });
});

describe("Portal affordance — status vs control", () => {
  it("status labels are informational spans, not buttons", () => {
    const status = read("src/components/dashboard/management-status-pill.tsx");
    const finance = read("src/components/dashboard/admin-finance-console.tsx");
    const parentRow = read("src/components/dashboard/parent-study-hall-row.tsx");
    assert.match(status, /data-kind="status"/);
    assert.match(status, /cursor-default/);
    assert.doesNotMatch(status, /<button/);
    assert.doesNotMatch(status, /hover:underline/);
    assert.match(finance, /data-kind="status"/);
    assert.match(parentRow, /data-kind="status"/);
  });

  it("filter Completed lives in the segmented control, status Completed stays a label", () => {
    const halls = read("src/components/dashboard/management-study-halls.tsx");
    const status = read("src/components/dashboard/management-status-pill.tsx");
    assert.match(halls, /id: "completed", label: "Completed"/);
    assert.match(halls, /PortalSegmentedControl/);
    assert.match(status, /ManagementStatusLabel/);
    assert.match(status, /data-kind="status"/);
    assert.doesNotMatch(status, /role="tab"/);
  });
});

describe("Portal affordance — action hierarchy", () => {
  it("primary actions use filled Button / LinkButton", () => {
    const parentNext = read("src/components/dashboard/parent-next-study-hall.tsx");
    const join = read("src/components/dashboard/guide-join-control.tsx");
    const guideHalls = read("src/components/dashboard/guide-study-halls.tsx");
    const parentHalls = read("src/components/dashboard/parent-study-halls.tsx");
    const actions = read("src/components/dashboard/management-study-hall-actions.tsx");
    assert.match(parentNext, /LinkButton/);
    assert.match(parentNext, /variant="secondary"/);
    assert.match(parentNext, /Join Study Hall|Book a Study Hall/);
    assert.match(join, /LinkButton/);
    assert.match(join, /variant="secondary"/);
    assert.match(guideHalls, /Finish report/);
    assert.match(guideHalls, /variant="primary"/);
    assert.match(parentHalls, /Book a Study Hall/);
    assert.match(actions, /Assign Guide/);
    assert.match(actions, /variant="primary"/);
  });

  it("secondary View / Watch / Read actions are outlined buttons, not gold text", () => {
    const row = read("src/components/dashboard/parent-study-hall-row.tsx");
    const recent = read("src/components/dashboard/parent-recent-activity.tsx");
    const watch = read("src/components/dashboard/watch-recording-button.tsx");
    const reports = read("src/app/dashboard/student/reports/page.tsx");
    assert.match(row, /LinkButton/);
    assert.match(row, /variant="outline"/);
    assert.match(row, />\s*View\s*</);
    assert.match(recent, /Read report/);
    assert.match(recent, /variant="outline"/);
    assert.match(watch, /variant="outline"/);
    assert.match(watch, /Watch recording/);
    assert.match(reports, /Read report/);
    assert.match(reports, /variant="outline"/);
    assert.doesNotMatch(row, /text-gold-700 hover:underline/);
    assert.doesNotMatch(watch, /hover:underline/);
  });

  it("destructive actions use the restrained destructive variant", () => {
    const cancel = read("src/components/dashboard/customer-booking-actions.tsx");
    const workforce = read("src/components/dashboard/guide-workforce-actions.tsx");
    const adminActions = read("src/components/dashboard/management-study-hall-actions.tsx");
    const finance = read("src/components/dashboard/admin-finance-console.tsx");
    assert.match(cancel, /variant="destructive"/);
    assert.match(cancel, /Cancel session/);
    assert.match(workforce, /variant="destructive"/);
    assert.match(workforce, /Suspend Guide/);
    assert.match(workforce, /Reject Application/);
    assert.match(adminActions, /Cancel Study Hall/);
    assert.match(adminActions, /variant="destructive"/);
    assert.match(finance, /variant="destructive"/);
    assert.doesNotMatch(cancel, /linkBtn/);
  });
});

describe("Portal affordance — IA and routes stay the same", () => {
  it("does not add, remove, or rename approved destinations", () => {
    assert.deepEqual(
      PARENT_PORTAL_NAV.map((i) => i.label),
      ["Home", "Study Halls", "Reports & Recordings", "Hours", "Account"],
    );
    assert.deepEqual(
      PARENT_PORTAL_NAV.map((i) => i.href),
      [
        "/dashboard/student",
        "/dashboard/student/study-halls",
        "/dashboard/student/reports",
        "/dashboard/student/packages",
        "/dashboard/student/account",
      ],
    );
    assert.deepEqual(
      GUIDE_PORTAL_NAV.map((i) => i.label),
      ["Home", "Study Halls", "Availability", "Earnings"],
    );
    const shell = read("src/components/dashboard/dashboard-shell.tsx");
    assert.match(shell, /label: "Overview".*href: "\/dashboard\/admin"/s);
    assert.match(shell, /label: "Study Halls".*href: "\/dashboard\/admin\/study-halls"/s);
    assert.match(shell, /label: "Guides".*href: "\/dashboard\/admin\/guides"/s);
    assert.match(shell, /label: "Customers".*href: "\/dashboard\/admin\/customers"/s);
    assert.match(shell, /label: "Finance".*href: "\/dashboard\/admin\/finance"/s);
    assert.doesNotMatch(shell, /Settings|#sessions/);
  });

  it("top nav keeps aria-current and makes inactive destinations look clickable", () => {
    const parent = read("src/components/dashboard/customer-shell.tsx");
    const guide = read("src/components/dashboard/guide-shell.tsx");
    const side = read("src/components/dashboard/dashboard-side-nav.tsx");
    assert.match(parent, /aria-current=\{isActive\(item\.href\) \? "page"/);
    assert.match(guide, /aria-current=\{isActive\(item\.href\) \? "page"/);
    assert.match(side, /aria-current=\{active \? "page"/);
    assert.match(parent, /hover:bg-\[#ebe4d6\]|bg-white\/60/);
    assert.match(guide, /hover:bg-\[#ebe4d6\]|bg-white\/60/);
    assert.match(side, /border border-ink-200 bg-white/);
    assert.match(parent, /overflow-x-auto/);
    assert.match(guide, /overflow-x-auto/);
  });

  it("does not change booking, compensation, or report logic files", () => {
    const parentHalls = read("src/components/dashboard/parent-study-halls.tsx");
    const guideHalls = read("src/components/dashboard/guide-study-halls.tsx");
    assert.match(parentHalls, /parentStudyHallLists/);
    assert.match(guideHalls, /guideStudyHallLists/);
    assert.match(guideHalls, /guideNeedsReport/);
    assert.doesNotMatch(parentHalls, /book_session|session_list_price_cents|authorize_session_join/);
    assert.doesNotMatch(guideHalls, /comp_rate_cents_per_hour|stripe|rpc\(/);
  });

  it("keeps the existing student_id booking embed explicit so status rows can load", () => {
    assert.match(read("src/lib/parent-portal-data.ts"), /students!student_id\(/);
    assert.match(read("src/lib/management-data.ts"), /students!student_id\(/);
    assert.match(read("src/lib/parent-portal-data.ts"), /booking_children|session_report_children/);
  });
});
