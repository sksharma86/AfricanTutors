import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { formatAdminSessionWhen, formatTime } from "../src/lib/timezone-format.mjs";
import * as T from "../src/lib/email/templates.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** 6:00 PM America/Chicago on Wed Aug 26, 2026 = 23:00 UTC (CDT = UTC−5). */
const CHICAGO_6PM = "2026-08-26T23:00:00.000Z";

describe("Admin timezone display", () => {
  it("Chicago admin sees 6:00 PM CDT — not 11:00 PM — for a 6 PM CDT booking", () => {
    const { primary, secondary } = formatAdminSessionWhen(CHICAGO_6PM, "America/Chicago", "America/Chicago");
    assert.match(primary, /6:00\s*PM/);
    assert.match(primary, /CDT|GMT-5|UTC-5/i);
    assert.doesNotMatch(primary, /11:00\s*PM/);
    assert.equal(secondary, null);
    assert.equal(formatTime(CHICAGO_6PM, "UTC"), "11:00 PM");
  });

  it("Nairobi admin sees EAT primary and parent CDT secondary", () => {
    const { primary, secondary } = formatAdminSessionWhen(CHICAGO_6PM, "Africa/Nairobi", "America/Chicago");
    assert.match(primary, /2:00\s*AM/);
    assert.match(primary, /EAT|GMT\+3|UTC\+3/i);
    assert.ok(secondary);
    assert.match(secondary, /Parent:/);
    assert.match(secondary, /6:00\s*PM/);
    assert.match(secondary, /CDT|GMT-5|UTC-5/i);
  });

  it("admin console no longer hardcodes When (UTC) / formatTime UTC", () => {
    const src = read("src/components/dashboard/admin-console.tsx");
    assert.doesNotMatch(src, /When \(UTC\)/);
    assert.doesNotMatch(src, /formatTime\([^,]+,\s*["']UTC["']\)/);
    assert.match(src, /AdminWhen/);
    assert.match(src, /student_timezone/);
  });

  it("release-expired cron is registered every 5 minutes", () => {
    const v = JSON.parse(read("vercel.json"));
    const entry = v.crons.find((c) => c.path === "/api/admin/cron/release-expired");
    assert.ok(entry);
    assert.equal(entry.schedule, "*/5 * * * *");
  });
});

describe("Welcome + balance notification wiring", () => {
  it("student dashboard wires notifyWelcome; applicants redirected first", () => {
    const page = read("src/app/dashboard/student/page.tsx");
    assert.match(page, /getGuideApplicantInfo/);
    assert.match(page, /redirect\("\/dashboard\/applicant"\)/);
    assert.match(page, /notifyWelcome/);
  });

  it("welcome + balance templates use Study Hall (at home); no Study Hall at Home", () => {
    for (const fn of [T.welcome, T.packageBalanceLow, T.packageBalanceDepleted, T.accountCreditApplied]) {
      const r =
        fn === T.welcome
          ? T.welcome({ name: "Alex", appUrl: "https://app.test" })
          : fn === T.packageBalanceLow
            ? T.packageBalanceLow({ balanceMinutes: 30, appUrl: "https://app.test" })
            : fn === T.packageBalanceDepleted
              ? T.packageBalanceDepleted({ appUrl: "https://app.test" })
              : T.accountCreditApplied({ amountCents: 1200, reason: "courtesy", appUrl: "https://app.test" });
      assert.doesNotMatch(`${r.subject}\n${r.html}\n${r.text}`, /Study Hall at Home/);
      if (fn === T.welcome || fn === T.accountCreditApplied) {
        assert.match(`${r.html}\n${r.text}`, /Study Hall \(at home\)/);
      }
    }
  });

  it("notifyBookingConfirmed triggers package balance helpers; credit API notifies", () => {
    const notify = read("src/lib/notify.ts");
    assert.match(notify, /maybeNotifyPackageBalanceAfterBooking/);
    assert.match(notify, /package-depleted-after:/);
    assert.match(notify, /package-low-after:/);
    assert.match(notify, /notifyAccountCreditApplied/);
    assert.match(notify, /credit-applied:/);
    const api = read("src/app/api/admin/adjust-balance/route.ts");
    assert.match(api, /notifyAccountCreditApplied/);
    assert.match(api, /admin_adjust_dollar_credit/);
  });

  it("no schedule-change notify invented; no T-5 reminder send path", () => {
    const notify = read("src/lib/notify.ts");
    assert.doesNotMatch(notify, /notifyScheduleChange|notifyReschedule|reminder_5m|reminder-5m/);
    const cron = read("src/app/api/cron/reminders/route.ts");
    // Cron documents that T−5 pings are intentionally absent; must not send them.
    assert.match(cron, /No T−5/);
    assert.doesNotMatch(cron, /notifyReminder\([^)]*5m|kind:\s*["']5m["']/);
  });
});
