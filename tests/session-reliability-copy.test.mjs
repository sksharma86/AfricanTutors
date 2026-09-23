import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { exitCopy } from "../src/lib/session-threshold.mjs";
import { guideStudyHallLists } from "../src/lib/guide-portal.mjs";
import { coverageFailureGuide, coverageFailureProtection } from "../src/lib/email/templates.mjs";
import { parentCoverageFailureProtectionSms } from "../src/lib/notifications/sms-copy.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Session doorway — one status, one way back in", () => {
  it("stepped-out rejoin is the only forward action while the door is open", () => {
    const early = exitCopy("student", "bk", { ended: false, windowOpen: true });
    assert.equal(early.canRejoin, true);
    assert.equal(early.primary, null);
    const room = read("src/components/session/session-room.tsx");
    assert.match(room, /exit\.canRejoin \? \([\s\S]*Rejoin Study Hall[\s\S]*: exit\.primary \?/);
    assert.doesNotMatch(room, /exit\.canRejoin\s*\?\s*"rounded-xl border/);
  });

  it("keeps the screen awake while the call is live and tells the Guide when it cannot", () => {
    const room = read("src/components/session/session-room.tsx");
    assert.match(room, /wakeLock\.request\("screen"\)/);
    assert.match(room, /if \(!inCall \|\| preview\) return/);
    assert.match(room, /data-kind="wake-tip"/);
    assert.match(room, /recording doesn/);
    assert.match(room, /visibilitychange/);
  });
});

describe("Guide Completed list is the past list, not a second Today", () => {
  it("Upcoming is after today in the Guide's timezone", () => {
    const now = Date.parse("2026-09-23T18:00:00Z");
    const lists = guideStudyHallLists(
      [
        {
          id: "today",
          status: "confirmed",
          scheduled_start: "2026-09-23T22:00:00Z",
          scheduled_end: "2026-09-23T23:00:00Z",
        },
        {
          id: "tomorrow",
          status: "confirmed",
          scheduled_start: "2026-09-24T15:00:00Z",
          scheduled_end: "2026-09-24T16:00:00Z",
        },
        {
          id: "done",
          status: "completed",
          scheduled_start: "2026-09-22T15:00:00Z",
          scheduled_end: "2026-09-22T16:00:00Z",
        },
      ],
      now,
      "America/Chicago",
    );
    assert.deepEqual(lists.today.map((b) => b.id), ["today"]);
    assert.deepEqual(lists.later.map((b) => b.id), ["tomorrow"]);
    assert.deepEqual(lists.completed.map((b) => b.id), ["done"]);
    const halls = read("src/components/dashboard/guide-study-halls.tsx");
    assert.match(halls, /view === "upcoming" \? lists\.later/);
  });
});

describe("T-2 coverage — parent and Guide hear the same outcome", () => {
  it("parent mail and SMS name the real time and do not say tonight", () => {
    const mail = coverageFailureProtection({
      whenISO: "2026-09-23T15:00:00Z",
      tz: "America/Chicago",
      restorationLine: "Your booking has been fully restored.",
      appUrl: "https://example.com",
    });
    assert.match(mail.subject, /couldn't provide your Guide/i);
    assert.doesNotMatch(mail.subject + mail.text, /tonight/i);
    assert.match(mail.text, /10:00 AM/);
    assert.match(mail.text, /complimentary Study Hall hour/);
    const sms = parentCoverageFailureProtectionSms({ whenISO: "2026-09-23T15:00:00Z", tz: "America/Chicago" });
    assert.match(sms, /10:00 AM/);
    assert.match(sms, /complimentary hour/);
    const guide = coverageFailureGuide({ whenISO: "2026-09-23T15:00:00Z", tz: "America/Chicago", appUrl: "https://example.com" });
    assert.match(guide.text, /10:00 AM/);
    assert.match(guide.text, /not on your report or your earnings/);
    assert.doesNotMatch(guide.text, /you failed|your fault/i);
  });

  it("a failed cancel or a missed notice is reported, not skipped", () => {
    const cron = read("src/app/api/cron/guide-attendance/route.ts");
    assert.match(cron, /coverage-protect-failed/);
    assert.match(cron, /Parent was not told/);
    assert.match(cron, /Guide was not told/);
    assert.match(cron, /protectFailed/);
    assert.doesNotMatch(cron, /if \(error\) continue/);
    const notify = read("src/lib/notify.ts");
    assert.match(notify, /coverage_failure_guide/);
    assert.match(notify, /whenISO: b\.scheduled_start/);
  });
});

describe("Public copy does not sound like an unfinished ops note", () => {
  it("FAQ, pricing, terms, and privacy drop the sticky notes", () => {
    const blob = [
      "src/lib/faq.ts",
      "src/components/marketing/pricing-section.tsx",
      "src/components/marketing/home/pricing.tsx",
      "src/app/(marketing)/pricing/page.tsx",
      "src/app/(marketing)/terms/page.tsx",
      "src/app/(marketing)/privacy/page.tsx",
    ]
      .map(read)
      .join("\n");
    assert.doesNotMatch(blob, /not live yet|being finalized|attorney review|No purchase buttons|coming next|there is no checkout/i);
    assert.match(read("src/lib/faq.ts"), /\$12/);
    assert.match(read("src/lib/faq.ts"), /\$99/);
    assert.match(read("src/lib/faq.ts"), /\$149\/month/);
    assert.match(read("src/app/(marketing)/terms/page.tsx"), /\$149\/month/);
    assert.match(read("src/components/marketing/home/pricing.tsx"), /\{ctaLabel\}/);
  });

  it("parent-facing payment and alert failures don't say not available yet", () => {
    const blob = [
      "src/lib/checkout-service.ts",
      "src/app/api/billing/portal/route.ts",
      "src/app/api/billing/membership/route.ts",
      "src/app/api/account/sms-preference/route.ts",
      "src/components/booking/study-hall-365-card.tsx",
    ]
      .map(read)
      .join("\n");
    assert.doesNotMatch(blob, /not available yet|not live yet/);
    assert.match(blob, /free Study Hall/);
  });

  it("Guide apply says the review once", () => {
    const page = read("src/app/(marketing)/apply-to-tutor/page.tsx");
    const form = read("src/components/auth/signup-form.tsx");
    assert.match(page, /reviews every application/);
    assert.doesNotMatch(form, /Guide applications are reviewed/);
  });

  it("confirm and magic-link land on the role home or the Study Hall in the link", () => {
    const callback = read("src/app/auth/callback/route.ts");
    const redirect = read("src/lib/auth-redirect.ts");
    const login = read("src/components/auth/login-form.tsx");
    assert.match(callback, /postAuthLanding\(next, home\)/);
    assert.doesNotMatch(callback, /void next/);
    assert.match(redirect, /export function postAuthLanding/);
    assert.match(redirect, /requested === "\/dashboard"\) return roleHome/);
    assert.match(login, /isPortalReturnPath/);
    assert.match(read("src/app/auth/confirmed/page.tsx"), /Sign in to open your Study Hall/);
    assert.doesNotMatch(read("src/app/auth/confirmed/page.tsx"), /parent dashboard/);
  });
});
