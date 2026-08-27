import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  PARENT_PORTAL_NAV,
  childFirstName,
  formatPrepaidHoursLabel,
  lastCompletedStudyHall,
  matchesParentStudyHallView,
  parentGuideLabel,
  parentJoinHint,
  parentPaymentLineLabel,
  parentPaymentPurposeLabel,
  parentPaymentStatusLabel,
  parentPrimaryAction,
  parentStatusLabel,
  parentStudyHallLists,
} from "../src/lib/parent-portal.mjs";
import {
  RECORDING_RETENTION_DAYS,
  recordingAvailabilityLabel,
  recordingDaysRemaining,
} from "../src/lib/recording-retention.mjs";
import { JOIN_CLOSE_GRACE_MIN, JOIN_OPEN_LEAD_MIN } from "../src/lib/session-window.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const START = Date.parse("2026-08-26T23:00:00Z");
const END = Date.parse("2026-08-27T00:00:00Z");
const startISO = new Date(START).toISOString();
const endISO = new Date(END).toISOString();

function booking(overrides = {}) {
  return {
    id: "b1",
    status: "confirmed",
    payment_status: "paid",
    scheduled_start: startISO,
    scheduled_end: endISO,
    tutor_display_name: "Jane Wanjiku",
    students: { full_name: "Sam Rivera", timezone: "America/Chicago" },
    ...overrides,
  };
}

describe("Parent portal UX — routes and authorization", () => {
  const pages = [
    ["src/app/dashboard/student/page.tsx", "/dashboard/student"],
    ["src/app/dashboard/student/study-halls/page.tsx", "/dashboard/student/study-halls"],
    ["src/app/dashboard/student/study-halls/[bookingId]/page.tsx", "/dashboard/student/study-halls/"],
    ["src/app/dashboard/student/reports/page.tsx", "/dashboard/student/reports"],
    ["src/app/dashboard/student/packages/page.tsx", "/dashboard/student/packages"],
    ["src/app/dashboard/student/account/page.tsx", "/dashboard/student/account"],
    ["src/app/dashboard/student/book/page.tsx", "/dashboard/student/book"],
  ];

  it("every parent destination is a real route guarded by requireRole(student)", () => {
    for (const [file, path] of pages) {
      const src = read(file);
      assert.match(src, /requireRole\(\s*"student"/, `${file} must require parent role`);
      assert.match(src, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("nav destinations match the five household routes", () => {
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
  });

  it("proxy still protects /dashboard and role-homes; no parent-only hole", () => {
    const proxy = read("src/proxy.ts");
    assert.match(proxy, /PROTECTED_PREFIXES = \["\/dashboard"\]/);
    assert.match(proxy, /DASHBOARD_PATH_BY_ROLE/);
    const roles = read("src/lib/roles.ts");
    assert.match(roles, /student:\s*"\/dashboard\/student"/);
  });

  it("shell marks the active destination and keeps all five labels on mobile", () => {
    const shell = read("src/components/dashboard/customer-shell.tsx");
    assert.match(shell, /aria-current=\{isActive\(item\.href\) \? "page"/);
    assert.match(shell, /hidden items-center gap-1 md:flex/);
    assert.match(shell, /md:hidden/);
    assert.match(shell, /whitespace-nowrap/);
    assert.match(shell, /overflow-x-auto/);
    assert.match(shell, /snap-x/);
    assert.doesNotMatch(shell, /hamburger|Menu2|md:hidden[\s\S]{0,40}hidden/);
  });

  it("legacy hashes redirect to real destinations", () => {
    const redir = read("src/components/dashboard/parent-hash-redirect.tsx");
    assert.match(redir, /hash === "reports"/);
    assert.match(redir, /\/dashboard\/student\/reports/);
    assert.match(redir, /hash === "account"/);
    assert.match(redir, /hash === "sessions"/);
    assert.match(redir, /packages#prepaid/);
  });
});

describe("Parent portal UX — Home, Next Study Hall, primary CTA", () => {
  it("Home is a three-second dashboard: next, hours, last activity, book/join", () => {
    const home = read("src/app/dashboard/student/page.tsx");
    const next = read("src/components/dashboard/parent-next-study-hall.tsx");
    const recent = read("src/components/dashboard/parent-recent-activity.tsx");
    assert.match(home, /ParentNextStudyHall/);
    assert.match(home, /BalanceCards/);
    assert.match(home, /compact/);
    assert.match(home, /ParentRecentActivity/);
    assert.match(next, /Next Study Hall/);
    assert.match(next, /No Study Hall scheduled/);
    assert.match(next, /Book an hour whenever homework needs structure/);
    assert.match(recent, /Last Study Hall/);
    assert.match(recent, /Your completed Study Halls will appear here/);
  });

  it("Join dominates inside T−5 through end+15; Book when nothing is joinable", () => {
    assert.equal(JOIN_OPEN_LEAD_MIN, 5);
    assert.equal(JOIN_CLOSE_GRACE_MIN, 15);

    const row = booking();
    const before = parentPrimaryAction([row], START - 30 * 60000);
    assert.equal(before.kind, "book");
    assert.equal(before.href, "/dashboard/student/book");
    assert.equal(before.label, "Book a Study Hall");

    const atOpen = parentPrimaryAction([row], START - JOIN_OPEN_LEAD_MIN * 60000);
    assert.equal(atOpen.kind, "join");
    assert.equal(atOpen.href, "/dashboard/session/b1");
    assert.equal(atOpen.label, "Join Study Hall");

    const afterStart = parentPrimaryAction([row], START + 20 * 60000);
    assert.equal(afterStart.kind, "join");
    assert.equal(afterStart.label, "Join Study Hall");

    const atGrace = parentPrimaryAction([row], END + JOIN_CLOSE_GRACE_MIN * 60000);
    assert.equal(atGrace.kind, "join");

    const afterGrace = parentPrimaryAction([row], END + JOIN_CLOSE_GRACE_MIN * 60000 + 1);
    assert.equal(afterGrace.kind, "book");

    const empty = parentPrimaryAction([], Date.now());
    assert.equal(empty.kind, "book");
  });

  it("join hint stays parent-facing and never prints Opens at / technical states", () => {
    const row = booking();
    assert.equal(parentJoinHint(row, START - 30 * 60000).label, "Ready to join 5 minutes before start");
    assert.equal(parentJoinHint(row, START - 5 * 60000).label, "Join Study Hall");
    assert.equal(parentJoinHint(row, END + 1).label, "Join Study Hall");
    const next = read("src/components/dashboard/parent-next-study-hall.tsx");
    assert.doesNotMatch(next, /opens_at|JOIN_OPEN|webhook|Daily room|payment_status/);
  });

  it("prepaid hours stay visible but secondary; Buy hours deep-links to #prepaid", () => {
    assert.equal(formatPrepaidHoursLabel(0), "0 hours");
    assert.equal(formatPrepaidHoursLabel(60), "1 hour");
    assert.equal(formatPrepaidHoursLabel(720), "12 hours");
    const balance = read("src/components/dashboard/balance-cards.tsx");
    assert.match(balance, /hours available|available/);
    assert.match(balance, /Buy hours &amp; save|Buy hours & save/);
    assert.match(balance, /packages#prepaid/);
    const home = read("src/app/dashboard/student/page.tsx");
    assert.match(home, /compact/);
    assert.doesNotMatch(home, /PackageStore|SingleSessionCards/);
  });

  it("Recent Activity is one completed Study Hall with report + recording", () => {
    const recent = read("src/components/dashboard/parent-recent-activity.tsx");
    assert.match(recent, /Report ready/);
    assert.match(recent, /View report/);
    assert.match(recent, /Recording processing|Recording unavailable|recordingAvailabilityLabel/);
    const last = lastCompletedStudyHall([
      booking({ id: "old", status: "completed", scheduled_start: "2026-08-20T00:00:00Z" }),
      booking({ id: "new", status: "completed", scheduled_start: "2026-08-25T00:00:00Z" }),
      booking({ id: "up", status: "confirmed", scheduled_start: "2026-09-01T00:00:00Z" }),
    ]);
    assert.equal(last?.id, "new");
  });

  it("free-trial copy stays on Home without becoming a wallet", () => {
    const home = read("src/app/dashboard/student/page.tsx");
    assert.match(home, /Your first Study Hall is on us/);
    assert.match(home, /Book free session/);
    assert.match(home, /After your free session/);
    assert.match(home, /preferFreeSession=\{freeTrialAvailable\}/);
  });
});

describe("Parent portal UX — Study Halls, reports, hours, account", () => {
  it("Study Halls split Upcoming / Past / Cancelled without UUIDs or matching jargon", () => {
    const lists = parentStudyHallLists(
      [
        booking({ id: "up" }),
        booking({
          id: "done",
          status: "completed",
          scheduled_start: "2026-08-20T00:00:00Z",
          scheduled_end: "2026-08-20T01:00:00Z",
        }),
        booking({
          id: "cx",
          status: "cancelled",
          scheduled_start: "2026-08-18T00:00:00Z",
          scheduled_end: "2026-08-18T01:00:00Z",
        }),
      ],
      START - 60 * 60000,
    );
    assert.deepEqual(lists.upcoming.map((b) => b.id), ["up"]);
    assert.deepEqual(lists.past.map((b) => b.id), ["done"]);
    assert.deepEqual(lists.cancelled.map((b) => b.id), ["cx"]);
    assert.equal(matchesParentStudyHallView(booking({ id: "up" }), "upcoming", START - 60 * 60000), true);
    assert.equal(
      matchesParentStudyHallView(
        booking({
          id: "done",
          status: "completed",
          scheduled_start: "2026-08-20T00:00:00Z",
          scheduled_end: "2026-08-20T01:00:00Z",
        }),
        "past",
        START,
      ),
      true,
    );

    const listPage = read("src/app/dashboard/student/study-halls/page.tsx");
    const rows = read("src/components/dashboard/parent-study-halls.tsx");
    const row = read("src/components/dashboard/parent-study-hall-row.tsx");
    assert.match(listPage, /requireRole\(\s*"student"/);
    assert.match(rows, /Upcoming/);
    assert.match(rows, /Past/);
    assert.match(rows, /Cancelled/);
    assert.match(rows, /view/);
    assert.match(row, /View/);
    assert.match(row, /Guide:/);
    assert.doesNotMatch(row, /payment_status|matching state|Daily room|RPC|booking lifecycle/);
    assert.doesNotMatch(rows, /UUID|public_reference/);
  });

  it("Study Hall detail shows parent-relevant facts and cancel/dispute, not admin internals", () => {
    const detail = read("src/app/dashboard/student/study-halls/[bookingId]/page.tsx");
    assert.match(detail, /CustomerBookingActions/);
    assert.match(detail, /Booking reference/);
    assert.match(detail, /parentPaymentLineLabel|Paid or covered by hours|Free session/);
    assert.match(detail, /Join Study Hall/);
    assert.match(detail, /Available for 60 days after the Study Hall/);
    assert.doesNotMatch(detail, /daily_room|share_token|webhook|CRON|comp_rate/);
  });

  it("Reports & Recordings are one destination organized by Study Hall", () => {
    const reports = read("src/app/dashboard/student/reports/page.tsx");
    assert.match(reports, /Reports &amp; Recordings|Reports & Recordings/);
    assert.match(reports, /60 days/);
    assert.match(reports, /Read report/);
    assert.match(reports, /WatchRecordingButton/);
    assert.match(reports, /Recording processing/);
    assert.match(reports, /Your completed Study Halls will appear here/);
    assert.match(reports, /Reports from completed Study Halls will appear here/);
    assert.match(reports, /Recordings from completed Study Halls will appear here/);
  });

  it("60-day recording presentation does not change retention math", () => {
    assert.equal(RECORDING_RETENTION_DAYS, 60);
    const now = Date.parse("2026-08-27T00:00:00Z");
    const until = "2026-10-24T00:00:00.000Z";
    assert.equal(recordingDaysRemaining(until, now), 58);
    assert.equal(recordingAvailabilityLabel(until, now), "Available for 58 more days");
    assert.equal(recordingAvailabilityLabel(null, now), "Available for 60 days after the Study Hall.");
    assert.equal(recordingAvailabilityLabel("2026-08-26T00:00:00.000Z", now), "Recording expired");
  });

  it("Hours keeps package math, PAYG $12, and #prepaid; hides Stripe jargon", () => {
    const hours = read("src/app/dashboard/student/packages/page.tsx");
    assert.match(hours, /Hours never expire/);
    assert.match(hours, /14 hours \/ \$140/);
    assert.match(hours, /28 hours \/ \$252/);
    assert.match(hours, /\$9\/hour/);
    assert.match(hours, /Pay as you go · \$12\/hour/);
    assert.match(hours, /id="prepaid"/);
    assert.match(hours, /SingleSessionCards/);
    assert.match(hours, /PackageStore/);
    assert.equal(parentPaymentPurposeLabel("package"), "Prepaid hours");
    assert.equal(parentPaymentPurposeLabel("booking"), "Study Hall session");
    assert.equal(parentPaymentStatusLabel("requires_payment_method"), "Payment needs attention");
    assert.match(hours, /parentPaymentPurposeLabel/);
    assert.doesNotMatch(hours, /webhook|checkout session/i);
  });

  it("Account holds name, email, phone privacy copy, and children", () => {
    const account = read("src/app/dashboard/student/account/page.tsx");
    const phone = read("src/components/dashboard/parent-phone-form.tsx");
    assert.match(account, /Parent name/);
    assert.match(account, /Email/);
    assert.match(account, /ParentPhoneForm/);
    assert.match(account, /Children/);
    assert.match(account, /Add a child when you book your first Study Hall|One account can book for multiple children/);
    assert.match(phone, /never shared with Guides/i);
    assert.match(phone, /do not sell or release/i);
  });

  it("multiple children stay obvious on Home, lists, and booking", () => {
    assert.equal(childFirstName("Sam Rivera"), "Sam");
    assert.equal(childFirstName("Amara"), "Amara");
    const next = read("src/components/dashboard/parent-next-study-hall.tsx");
    const row = read("src/components/dashboard/parent-study-hall-row.tsx");
    const wizard = read("src/components/booking/booking-wizard.tsx");
    assert.match(next, /childFirstName/);
    assert.match(row, /childFirstName/);
    assert.match(wizard, /Add a child/);
    assert.match(wizard, /full_name/);
  });

  it("booking wizard is preserved inside the parent shell", () => {
    const book = read("src/app/dashboard/student/book/page.tsx");
    const wizard = read("src/components/booking/booking-wizard.tsx");
    assert.match(book, /ParentPage/);
    assert.match(book, /BookingWizard/);
    assert.match(book, /initialDuration=\{initialDuration\}/);
    assert.match(wizard, /Date & time|date &amp; time/);
    assert.doesNotMatch(wizard, /max-h-96/);
  });

  it("cancel/dispute (balance restoration) remains on Study Hall detail", () => {
    const actions = read("src/components/dashboard/customer-booking-actions.tsx");
    const detail = read("src/app/dashboard/student/study-halls/[bookingId]/page.tsx");
    assert.match(detail, /CustomerBookingActions/);
    assert.match(actions, /Cancel session/);
    assert.match(actions, /returned to your Prepaid Hours|returned as account credit/);
    assert.match(actions, /submittingRef/);
  });
});

describe("Parent portal UX — language", () => {
  it("translates matching and payment machinery into family language", () => {
    assert.equal(parentGuideLabel({ status: "confirmed", tutor_display_name: null }), "Guide being assigned");
    assert.equal(parentGuideLabel({ status: "confirmed", tutor_display_name: "Jane Wanjiku" }), "Jane Wanjiku");
    assert.equal(
      parentStatusLabel({ status: "confirmed", payment_status: "awaiting_payment" }),
      "Payment needs attention",
    );
    assert.equal(parentPaymentLineLabel({ is_free_trial: true }), "Free session");
    const surfaces = [
      "src/app/dashboard/student/page.tsx",
      "src/components/dashboard/parent-next-study-hall.tsx",
      "src/components/dashboard/parent-study-hall-row.tsx",
      "src/app/dashboard/student/reports/page.tsx",
    ]
      .map(read)
      .join("\n");
    assert.doesNotMatch(surfaces, /payment_status|matching state|Daily room|RPC|recording webhook|account ledger/);
  });
});
