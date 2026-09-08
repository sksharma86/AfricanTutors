import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import * as T from "../src/lib/email/templates.mjs";
import { CHANNEL_POLICY, NOTIFICATION_EVENTS } from "../src/lib/notifications/events.mjs";
import {
  bookingFundingLine,
  resolveNotificationFunding,
} from "../src/lib/notifications/funding.mjs";
import {
  parentWelcomeEligible,
  welcomeIdempotencyKey,
} from "../src/lib/notifications/parent-welcome.mjs";
import {
  reminderEmailIdempotencyKey,
  reminderStillValid,
  shouldSendReminder,
} from "../src/lib/notifications/reminder-policy.mjs";
import { hasSupabaseEnv } from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const APP = "https://app.studyhall.test";
const BID = "8f0be464-665a-49d9-8897-9f15adfe2806";
const GUIDE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GUIDE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ISO = "2026-08-20T19:00:00.000Z";

function assertNoLeaks(rendered) {
  const blob = `${rendered.subject}\n${rendered.html}\n${rendered.text}`.toLowerCase();
  for (const bad of ["daily.co", "token=", "twilio", "resend", "+1555", "phone_e164", "auth_token"]) {
    assert.ok(!blob.includes(bad), `must not leak "${bad}"`);
  }
}

describe("PR7A — event catalog foundation (unwired)", () => {
  it("defines 365, payment-failure, and customer no-show identifiers", () => {
    assert.equal(NOTIFICATION_EVENTS.STUDY_HALL_365_STARTED, "study_hall_365_started");
    assert.equal(NOTIFICATION_EVENTS.STUDY_HALL_365_RENEWED, "study_hall_365_renewed");
    assert.equal(NOTIFICATION_EVENTS.STUDY_HALL_365_CANCELLATION_SCHEDULED, "study_hall_365_cancellation_scheduled");
    assert.equal(NOTIFICATION_EVENTS.STUDY_HALL_365_RESUMED, "study_hall_365_resumed");
    assert.equal(NOTIFICATION_EVENTS.STUDY_HALL_365_ENDED, "study_hall_365_ended");
    assert.equal(NOTIFICATION_EVENTS.PAYMENT_FAILURE, "payment_failure");
    assert.equal(NOTIFICATION_EVENTS.CUSTOMER_NO_SHOW_PARENT, "customer_no_show_parent");
    assert.equal(NOTIFICATION_EVENTS.CUSTOMER_NO_SHOW_GUIDE, "customer_no_show_guide");
  });

  it("365 is parent email only; no-show has no management success channel", () => {
    const life = CHANNEL_POLICY.pr7_lifecycle;
    for (const key of [
      "study_hall_365_started",
      "study_hall_365_renewed",
      "study_hall_365_cancellation_scheduled",
      "study_hall_365_resumed",
      "study_hall_365_ended",
    ]) {
      assert.deepEqual(life[key].parent, ["email"]);
      assert.deepEqual(life[key].guide, []);
      assert.deepEqual(life[key].manager, []);
    }
    assert.deepEqual(life.payment_failure.parent, ["email", "sms"]);
    assert.deepEqual(life.customer_no_show_parent, { parent: ["email", "sms"], guide: [], manager: [] });
    assert.deepEqual(life.customer_no_show_guide, { parent: [], guide: ["email"], manager: [] });
    assert.ok(!CHANNEL_POLICY.sms.includes("customer_no_show_guide"));
    assert.ok(!CHANNEL_POLICY.sms.includes("study_hall_365_started"));
  });

  it("does not wire 365 / payment-failure / no-show sends yet", () => {
    const notify = read("src/lib/notify.ts");
    assert.doesNotMatch(notify, /notifyStudyHall365|notifyCustomerNoShow|notifyPaymentFailure/);
    assert.doesNotMatch(read("src/lib/study-hall-365/stripe-sync.ts"), /from ["']@\/lib\/notify["']/);
    assert.doesNotMatch(read("src/app/api/tutor/customer-no-show/route.ts"), /notify/);
    const stripe = read("src/app/api/stripe/webhook/route.ts");
    assert.doesNotMatch(stripe, /notifyPaymentFailure|notifyStudyHall365|STUDY_HALL_365_STARTED/);
  });

  it("does not add recording-ready, Guide SMS, or extra reminder cadences", () => {
    assert.ok(!Object.values(NOTIFICATION_EVENTS).includes("recording_ready"));
    assert.ok(!CHANNEL_POLICY.sms.includes("guide_session_reminder"));
    assert.equal(shouldSendReminder("customer", "24h"), false);
    assert.equal(shouldSendReminder("tutor", "1h"), true);
    const cron = read("src/app/api/cron/reminders/route.ts");
    assert.doesNotMatch(cron, /weekly|morning-of|kind:\s*["']24h["']/);
  });
});

describe("PR7A — Guide T-1h reminder key", () => {
  it("includes Guide identity; reassignment yields a distinct key", () => {
    const a = reminderEmailIdempotencyKey({ kind: "1h", bookingId: BID, role: "tutor", tutorId: GUIDE_A });
    const b = reminderEmailIdempotencyKey({ kind: "1h", bookingId: BID, role: "tutor", tutorId: GUIDE_B });
    assert.equal(a, `reminder-1h:${BID}:tutor:${GUIDE_A}`);
    assert.equal(b, `reminder-1h:${BID}:tutor:${GUIDE_B}`);
    assert.notEqual(a, b);
    assert.equal(
      reminderEmailIdempotencyKey({ kind: "1h", bookingId: BID, role: "tutor", tutorId: GUIDE_A }),
      a,
      "duplicate cron for the same Guide reuses the same key",
    );
  });

  it("parent reminder key is unchanged and does not include a Guide id", () => {
    assert.equal(
      reminderEmailIdempotencyKey({ kind: "1h", bookingId: BID, role: "customer" }),
      `reminder-1h:${BID}:customer`,
    );
    assert.equal(reminderEmailIdempotencyKey({ kind: "1h", bookingId: BID, role: "tutor", tutorId: null }), null);
  });

  it("stale removed Guide fails revalidation; current Guide is eligible", () => {
    const booking = {
      status: "confirmed",
      payment_status: "paid",
      scheduled_start: ISO,
      tutor_id: GUIDE_B,
    };
    assert.equal(reminderStillValid(booking, { role: "tutor", tutorId: GUIDE_A }), false);
    assert.equal(reminderStillValid(booking, { role: "tutor", tutorId: GUIDE_B }), true);
    assert.equal(reminderStillValid({ ...booking, status: "cancelled" }, { role: "tutor", tutorId: GUIDE_B }), false);
    assert.equal(
      reminderStillValid({ ...booking, payment_status: "awaiting_payment" }, { role: "tutor", tutorId: GUIDE_B }),
      false,
    );
    assert.equal(reminderStillValid(booking, { role: "customer" }), true);
  });

  it("notifyReminder uses the key helper and revalidates current Guide", () => {
    const notify = read("src/lib/notify.ts");
    assert.match(notify, /reminderEmailIdempotencyKey/);
    assert.match(notify, /reminderStillValid/);
    assert.doesNotMatch(notify, /reminder-\$\{kind\}:\$\{bookingId\}:\$\{role\}/);
  });
});

describe("PR7A — authoritative funding copy", () => {
  it("uses funding_source when present and never infers 365 from zero cents", () => {
    assert.equal(resolveNotificationFunding({ fundingSource: "study_hall_365", stripePaidCents: 0, creditAppliedCents: 0, hasPaymentRow: true }), "study_hall_365");
    assert.equal(resolveNotificationFunding({ fundingSource: "prepaid" }), "prepaid");
    assert.equal(resolveNotificationFunding({ fundingSource: "credit" }), "credit");
    assert.equal(resolveNotificationFunding({ fundingSource: "payg" }), "payg");
    assert.equal(resolveNotificationFunding({ fundingSource: "free_trial" }), "free_trial");
    assert.equal(resolveNotificationFunding({ isFreeTrial: true }), "free_trial");
    assert.equal(
      resolveNotificationFunding({ fundingSource: null, stripePaidCents: 0, creditAppliedCents: 0, hasPaymentRow: true }),
      "prepaid",
    );
    assert.notEqual(
      resolveNotificationFunding({ fundingSource: null, stripePaidCents: 0, creditAppliedCents: 0, hasPaymentRow: true }),
      "study_hall_365",
    );
    assert.equal(resolveNotificationFunding({ fundingSource: null, hasPaymentRow: false }), null);
  });

  it("booking confirmation copy matches each funding source", () => {
    const cases = [
      ["free_trial", /used the family's free Study Hall/],
      ["study_hall_365", /included with Study Hall 365/],
      ["prepaid", /used a prepaid Study Hall/],
      ["credit", /used account credit/],
      ["payg", /pay-as-you-go price/],
    ];
    for (const [funding, pattern] of cases) {
      assert.match(bookingFundingLine(funding), pattern);
      const r = T.bookingConfirmed({
        isFreeTrial: funding === "free_trial",
        funding,
        whenISO: ISO,
        tz: "UTC",
        durationMinutes: 60,
        studentName: "Maya",
        appUrl: APP,
        bookingId: BID,
      });
      assert.match(r.text, pattern);
      assertNoLeaks(r);
    }
    assert.equal(bookingFundingLine(null), null);
    const historical = T.bookingConfirmed({
      funding: "package",
      whenISO: ISO,
      tz: "UTC",
      durationMinutes: 60,
      studentName: "Maya",
      appUrl: APP,
      bookingId: BID,
    });
    assert.match(historical.text, /used a prepaid Study Hall/);
  });
});

describe("PR7A — welcome leaves Parent Home", () => {
  it("Parent Home no longer imports or calls notifyWelcome", () => {
    const page = read("src/app/dashboard/student/page.tsx");
    assert.doesNotMatch(page, /notifyWelcome/);
    assert.doesNotMatch(page, /@\/lib\/notify/);
  });

  it("authoritative signup path sends welcome only after successful parent creation", () => {
    const api = read("src/app/api/auth/signup/route.ts");
    const form = read("src/components/auth/signup-form.tsx");
    assert.match(form, /\/api\/auth\/signup/);
    assert.doesNotMatch(form, /notifyWelcome/);
    assert.match(api, /notifyWelcome/);
    assert.match(api, /parentWelcomeEligible/);
    assert.match(api, /best-effort — never undo account creation/);
  });

  it("eligibility rejects failure, Guide applicants, duplicates, and missing user", () => {
    const user = { id: "acct-1", identities: [{ provider: "email" }] };
    assert.equal(parentWelcomeEligible({ requestedRole: "student", user, error: null }), true);
    assert.equal(parentWelcomeEligible({ requestedRole: "student", user, error: { message: "fail" } }), false);
    assert.equal(parentWelcomeEligible({ requestedRole: "tutor", user, error: null }), false);
    assert.equal(parentWelcomeEligible({ requestedRole: "student", user: { id: "acct-1", identities: [] }, error: null }), false);
    assert.equal(parentWelcomeEligible({ requestedRole: "student", user: null, error: null }), false);
    assert.equal(welcomeIdempotencyKey("acct-1"), "welcome:acct-1");
  });

  it("notifyWelcome still uses the per-account idempotency key", () => {
    assert.match(read("src/lib/notify.ts"), /welcome:\$\{accountId\}/);
  });
});

describe("PR7A — reminder policy and privacy regressions", () => {
  it("keeps parent T-1h email+SMS and Guide T-1h email only", () => {
    assert.equal(shouldSendReminder("customer", "1h"), true);
    const notify = read("src/lib/notify.ts");
    assert.match(notify, /reminder-1h-sms:/);
    assert.match(notify, /deliverParentSms/);
    assert.match(read("src/app/api/cron/guide-attendance/route.ts"), /sweep_guide_attendance/);
    assert.match(read("src/lib/notify.ts"), /notifyCancellation/);
    assert.match(read("src/lib/notify.ts"), /notifyReassignment/);
    assert.match(read("src/lib/notify.ts"), /notifySessionReportReady/);
    assert.match(read("src/lib/notify.ts"), /notifyCoverageFailureProtection/);
    assert.match(notify, /never throws|Never throws/i);
  });

  it("templates do not leak Daily tokens or parent phones", () => {
    const r = T.bookingConfirmed({
      funding: "study_hall_365",
      whenISO: ISO,
      tz: "UTC",
      durationMinutes: 60,
      studentName: "Maya",
      appUrl: APP,
      bookingId: BID,
    });
    assertNoLeaks(r);
    assert.doesNotMatch(r.text, /daily\.co|token=/i);
  });
});

describe("PR7A — Guide reminder claim uniqueness (DB, when configured)", () => {
  it("Guide A and Guide B claims are independent; same Guide does not duplicate", async (t) => {
    if (!hasSupabaseEnv) {
      t.skip("Supabase env not configured");
      return;
    }
    const { adminClient, createUser, cleanupAll } = await import("./helpers.mjs");
    const svc = adminClient();
    const guideA = await createUser({ requestedRole: "tutor", displayName: "PR7A Guide A" });
    const guideB = await createUser({ requestedRole: "tutor", displayName: "PR7A Guide B" });
    const bookingId = "00000000-0000-4000-8000-0000000007a1";
    const keyA = reminderEmailIdempotencyKey({ kind: "1h", bookingId, role: "tutor", tutorId: guideA.id });
    const keyB = reminderEmailIdempotencyKey({ kind: "1h", bookingId, role: "tutor", tutorId: guideB.id });
    try {
      assert.equal(
        (await svc.rpc("claim_email_delivery", { p_key: keyA, p_type: "reminder_1h", p_account: guideA.id, p_to: "a@x.test" })).data,
        true,
      );
      assert.equal(
        (await svc.rpc("claim_email_delivery", { p_key: keyA, p_type: "reminder_1h", p_account: guideA.id, p_to: "a@x.test" })).data,
        false,
        "duplicate cron for Guide A",
      );
      assert.equal(
        (await svc.rpc("claim_email_delivery", { p_key: keyB, p_type: "reminder_1h", p_account: guideB.id, p_to: "b@x.test" })).data,
        true,
        "Guide B is independently eligible",
      );
    } finally {
      await svc.from("email_deliveries").delete().in("idempotency_key", [keyA, keyB]);
      await cleanupAll();
    }
  });
});
