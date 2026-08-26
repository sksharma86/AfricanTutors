import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import * as T from "../src/lib/email/templates.mjs";
import { CHANNEL_POLICY, NOTIFICATION_EVENTS } from "../src/lib/notifications/events.mjs";
import { packageHoursLabel } from "../src/lib/notifications/package-labels.mjs";
import {
  parentSilentOnSuccessfulReassignment,
  reassignmentOutcome,
  reassignmentRecipients,
} from "../src/lib/notifications/reassignment-policy.mjs";
import {
  REMINDER_1H_WINDOW_MIN,
  REMINDER_EXCLUDED_STATUSES,
  reminder1hWindow,
  shouldSendReminder,
} from "../src/lib/notifications/reminder-policy.mjs";
import {
  parentCancellationSms,
  parentReassignmentSms,
  parentSessionReminderSms,
} from "../src/lib/notifications/sms-copy.mjs";
import { hasSupabaseEnv } from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const APP = "https://app.studyhall.test";
const BID = "8f0be464-665a-49d9-8897-9f15adfe2806";
const ISO = "2026-08-20T19:00:00.000Z";

function assertNoLeaks(rendered) {
  const blob = `${rendered.subject}\n${rendered.html}\n${rendered.text}`.toLowerCase();
  for (const bad of ["daily.co", "token=", "twilio", "resend", "+1555", "phone_e164", "auth_token"]) {
    assert.ok(!blob.includes(bad), `must not leak "${bad}"`);
  }
}

describe("Study Hall PR8 — reminder policy (pure)", () => {
  it("sends 1h for parent and Guide; never 24h", () => {
    assert.equal(shouldSendReminder("customer", "1h"), true);
    assert.equal(shouldSendReminder("tutor", "1h"), true);
    assert.equal(shouldSendReminder("customer", "24h"), false);
    assert.equal(shouldSendReminder("tutor", "24h"), false);
  });

  it("1h window is 50–70 minutes before start", () => {
    assert.equal(REMINDER_1H_WINDOW_MIN.from, 50);
    assert.equal(REMINDER_1H_WINDOW_MIN.to, 70);
    const now = Date.parse("2026-08-20T18:00:00.000Z");
    const { fromISO, toISO } = reminder1hWindow(now);
    assert.equal(fromISO, "2026-08-20T18:50:00.000Z");
    assert.equal(toISO, "2026-08-20T19:10:00.000Z");
  });

  it("excludes cancelled/expired/completed/no_show/pending from reminders", () => {
    for (const s of ["cancelled", "expired", "completed", "no_show", "pending"]) {
      assert.ok(REMINDER_EXCLUDED_STATUSES.includes(s), s);
    }
  });
});

describe("Study Hall PR8 — SMS copy (pure)", () => {
  it("parent 1h reminder matches preferred direction and never exposes phone", () => {
    const sms = parentSessionReminderSms({ studentName: "Maya", whenISO: ISO, tz: "America/New_York" });
    assert.match(sms, /Study Hall at Home reminder: Maya's Study Hall starts at/);
    assert.match(sms, /ready at her workspace/);
    assert.match(sms, /room opens 5 minutes before/i);
    assert.doesNotMatch(sms, /\+1|phone|twilio/i);
  });

  it("cancel SMS is concise; material-impact SMS never says Guide changed for routine swap", () => {
    const c = parentCancellationSms({ studentName: "Maya", whenISO: ISO, tz: "UTC" });
    const r = parentReassignmentSms({ studentName: "Maya", whenISO: ISO, tz: "UTC" });
    assert.match(c, /cancelled/i);
    assert.match(r, /session at .* was updated/i);
    assert.doesNotMatch(r, /Guide changed/i);
    assert.doesNotMatch(c + r, /\+1|phone_e164/i);
  });
});

describe("Study Hall PR8 — successful Guide reassignment is invisible to parents", () => {
  it("policy: successful swap → no parent email/SMS; Guides notified; no manager alert", () => {
    assert.equal(reassignmentOutcome(true), "successful_internal");
    const r = reassignmentRecipients("successful_internal");
    assert.equal(r.parentEmail, false);
    assert.equal(r.parentSms, false);
    assert.equal(r.newGuideAssignment, true);
    assert.equal(r.removedGuide, true);
    assert.equal(r.managerExceptionAlert, false);
    assert.equal(parentSilentOnSuccessfulReassignment(true), true);
  });

  it("policy: session impacted (release/failure) → parent email + manager alert", () => {
    assert.equal(reassignmentOutcome(false), "session_impacted");
    const r = reassignmentRecipients("session_impacted");
    assert.equal(r.parentEmail, true);
    assert.equal(r.parentSms, false);
    assert.equal(r.newGuideAssignment, false);
    assert.equal(r.managerExceptionAlert, true);
    assert.equal(parentSilentOnSuccessfulReassignment(false), false);
  });

  it("notifyReassignment source: successful path has no parent deliver / no reassignment-sms", () => {
    const notify = read("src/lib/notify.ts");
    // Successful branch must not email parent via tutorReassignment(reassigned:true)
    // or SMS via reassignment-sms / parentReassignmentSms.
    assert.match(notify, /reassignmentRecipients/);
    assert.match(notify, /never parent email|parentNotified: false/i);
    assert.doesNotMatch(notify, /reassignment-sms:/);
    assert.doesNotMatch(notify, /parentReassignmentSms/);
    // New Guide uses tutor-new-session key (not booking-confirmed parent path).
    assert.match(notify, /tutor-new-session:\$\{bookingId\}:\$\{b\.tutor_id\}/);
    assert.match(notify, /tutor-removed:\$\{bookingId\}:\$\{info\.removedTutorId\}/);
    // Release / failure still notifies parent.
    assert.match(notify, /guide_reassignment_failed/);
    assert.match(notify, /release:\$\{bookingId\}/);
    assert.match(notify, /tutorReassignment\(\{\s*reassigned:\s*false/);
  });

  it("channel policy: successful guide_reassigned is not a parent SMS/email event", () => {
    assert.ok(!CHANNEL_POLICY.sms.includes("guide_reassigned"));
    assert.ok(!CHANNEL_POLICY.email.includes("guide_reassigned"));
    assert.ok(CHANNEL_POLICY.email.includes("guide_reassignment_failed"));
    assert.ok(CHANNEL_POLICY.guide_reassigned_success);
    assert.deepEqual(CHANNEL_POLICY.guide_reassigned_success.parent, []);
    assert.ok(CHANNEL_POLICY.guide_reassigned_success.newGuide.includes("email"));
    assert.ok(CHANNEL_POLICY.guide_reassigned_success.removedGuide.includes("email"));
  });

  it("cancellation parent notification remains intact", () => {
    const notify = read("src/lib/notify.ts");
    assert.match(notify, /cancellation:\$\{bookingId\}/);
    assert.match(notify, /cancellation-sms:\$\{bookingId\}/);
    assert.match(notify, /parentCancellationSms/);
    const cancel = T.cancellation({ early: true, restoredMinutes: 60 });
    assert.match(cancel.subject, /cancelled/i);
  });

  it("session-impacted parent email template still exists for release", () => {
    const impacted = T.tutorReassignment({
      reassigned: false,
      compCreditCents: 500,
      subject: "Study Hall",
      bookingId: BID,
      appUrl: APP,
    });
    assert.match(impacted.text, /returned to your account|rebook|unavailable/i);
    assertNoLeaks(impacted);

    const successCopy = T.tutorReassignment({
      reassigned: true,
      subject: "Study Hall",
      bookingId: BID,
      appUrl: APP,
    });
    // Template may still exist for historical/admin use, but notify must not send it to parents on success.
    assert.match(successCopy.text, /Guide changed|matched you/i);
  });
});

describe("Study Hall PR8 — email templates", () => {
  it("booking confirmation includes child, duration, funding, T−5; once-shaped copy", () => {
    const prepaid = T.bookingConfirmed({
      whenISO: ISO,
      tz: "America/New_York",
      durationMinutes: 60,
      studentName: "Maya",
      tutorName: "Amina",
      funding: "package",
      appUrl: APP,
      bookingId: BID,
    });
    assert.match(prepaid.text, /Maya/);
    assert.match(prepaid.text, /1 hour/);
    assert.match(prepaid.text, /prepaid Study Hall hours/i);
    assert.match(prepaid.text, /5 minutes before/i);
    assertNoLeaks(prepaid);

    const free = T.bookingConfirmed({
      isFreeTrial: true,
      whenISO: ISO,
      tz: "UTC",
      durationMinutes: 60,
      studentName: "Maya",
      appUrl: APP,
      bookingId: BID,
    });
    assert.match(free.text, /free 1-hour/i);
    assert.match(free.subject, /free Study Hall/i);
  });

  it("package purchase shows package name, amount, hours, balance", () => {
    assert.equal(packageHoursLabel(840), "14 Hour Routine");
    assert.equal(packageHoursLabel(1680), "28 Hour Routine");
    const r = T.packagePurchased({
      minutes: 840,
      amountCents: 14000,
      balanceMinutes: 840,
      packageName: "14 Hour Routine",
      appUrl: APP,
    });
    assert.match(r.text, /14 Hour Routine/);
    assert.match(r.text, /Hours added: 14/);
    assert.match(r.text, /\$140/);
    assert.match(r.text, /New Study Hall balance: 14 hours/);
    assertNoLeaks(r);
  });

  it("parent 1h reminder email; 24h template marked disabled; no T−5-only ping template", () => {
    const r1 = T.reminder({
      role: "customer",
      kind: "1h",
      whenISO: ISO,
      tz: "America/New_York",
      studentName: "Maya",
      durationMinutes: 60,
      appUrl: APP,
      bookingId: BID,
    });
    assert.match(r1.subject, /about an hour/i);
    assert.match(r1.text, /Maya/);
    assert.match(r1.text, /5 minutes before/i);
    assertNoLeaks(r1);

    const r24 = T.reminder({
      role: "customer",
      kind: "24h",
      whenISO: ISO,
      tz: "UTC",
      appUrl: APP,
      bookingId: BID,
    });
    assert.match(r24.text, /disabled/i);
    assert.notEqual(r24.subject, r1.subject);

    const guide = T.reminder({
      role: "tutor",
      kind: "1h",
      whenISO: ISO,
      tz: "UTC",
      studentName: "Maya",
      durationMinutes: 120,
      appUrl: APP,
      bookingId: BID,
    });
    assert.match(guide.text, /Child: Maya/);
    assert.match(guide.text, /2 hours/);
    assert.match(guide.text, /Join opens 5 minutes/i);
    assert.doesNotMatch(guide.text, /phone|\+1/i);
  });

  it("report-ready email remains intact (PR6)", () => {
    const r = T.sessionReportReady({
      studentName: "Maya",
      whenISO: ISO,
      tz: "UTC",
      appUrl: APP,
    });
    assert.match(r.subject, /Study Hall report is ready/i);
    assert.match(r.text, /Maya/);
    assert.match(r.text, /not a grade/i);
  });

  it("Guide report required / overdue templates exist", () => {
    const req = T.guideReportRequired({ studentName: "Maya", whenISO: ISO, tz: "UTC", appUrl: APP });
    const od = T.guideReportOverdue({ studentName: "Maya", whenISO: ISO, tz: "UTC", appUrl: APP });
    assert.match(req.subject, /report required/i);
    assert.match(od.subject, /Overdue/i);
    assertNoLeaks(req);
    assertNoLeaks(od);
  });
});

describe("Study Hall PR8 — architecture source contracts", () => {
  it("central notify.ts owns booking/package/reminder/cancel/reassign/report/admin", () => {
    const notify = read("src/lib/notify.ts");
    assert.match(notify, /notifyBookingConfirmed/);
    assert.match(notify, /notifyPackagePurchased/);
    assert.match(notify, /notifyReminder/);
    assert.match(notify, /notifyCancellation/);
    assert.match(notify, /notifyReassignment/);
    assert.match(notify, /notifySessionReportReady/);
    assert.match(notify, /deliverParentSms/);
    assert.match(notify, /reminder-1h-sms:/);
    assert.match(notify, /claim_email_delivery/);
    assert.match(notify, /shouldSendReminder/);
    assert.match(notify, /awaiting_payment/);
    assert.match(notify, /notifyCallParentFailure/);
    assert.match(notify, /notifyRecordingFailure/);
    assert.match(notify, /notifyGuideReportRequired/);
    assert.match(notify, /notifyGuideReportOverdue/);
    // Never throw / never block
    assert.match(notify, /never throws|Never throws/i);
  });

  it("cron uses 50–70 min window only; no 24h sweep; CRON_SECRET required", () => {
    const cron = read("src/app/api/cron/reminders/route.ts");
    assert.match(cron, /reminder1hWindow/);
    assert.match(cron, /CRON_SECRET/);
    assert.doesNotMatch(cron, /"24h"|kind: "24h"|run\(.*24h/);
    assert.match(cron, /notifyGuideReportRequired/);
    assert.match(cron, /notifyGuideReportOverdue/);
  });

  it("vercel.json schedules /api/cron/reminders every 15 minutes", () => {
    const v = JSON.parse(read("vercel.json"));
    assert.ok(Array.isArray(v.crons));
    const hit = v.crons.find((c) => c.path === "/api/cron/reminders");
    assert.ok(hit, "cron path present");
    assert.equal(hit.schedule, "*/15 * * * *");
  });

  it("checkout/webhook only notify after confirmed/paid paths", () => {
    const checkout = read("src/lib/checkout-service.ts");
    assert.match(checkout, /notifyBookingConfirmed/);
    assert.match(checkout, /stripe_cents_due <= 0/);
    assert.match(checkout, /funding !== "request"/);
    assert.match(checkout, /notifyPackagePurchased/);
    // Launch fix: must await (not void) so Vercel keeps the invocation alive.
    assert.match(checkout, /await\s+notifyBookingConfirmed/);
    assert.match(checkout, /await\s+notifyPackagePurchased/);
    assert.doesNotMatch(checkout, /void\s+notifyBookingConfirmed/);
    assert.doesNotMatch(checkout, /void\s+notifyPackagePurchased/);

    const wh = read("src/app/api/stripe/webhook/route.ts");
    assert.match(wh, /notifyPackagePurchased/);
    assert.match(wh, /notifyBookingConfirmed/);
    assert.match(wh, /result\?\.status === "confirmed"/);
    assert.match(wh, /await\s+notifyBookingConfirmed/);
  });

  it("Call Parent failure and recording.error hook admin alerts without changing PR7 core", () => {
    const cp = read("src/lib/call-parent-service.ts");
    assert.match(cp, /notifyCallParentFailure/);
    assert.match(cp, /placeParentAttentionCall/);
    assert.match(cp, /MachineDetection|DetectMessageEnd|isConfirmedHumanParentContact/);

    const daily = read("src/app/api/daily/webhook/route.ts");
    assert.match(daily, /recording\.error/);
    assert.match(daily, /notifyRecordingFailure/);
  });

  it("parent phone never exposed in Guide session UI or Call Parent control", () => {
    const ctrl = read("src/components/session/call-parent-control.tsx");
    assert.doesNotMatch(ctrl, /phone_e164|TWILIO|toE164/);
    const room = read("src/components/session/session-room.tsx");
    assert.doesNotMatch(room, /phone_e164/);
  });

  it("no new migration 0025 — reuses email_deliveries idempotency", () => {
    try {
      read("supabase/migrations/0025_studyhall_pr8_notifications.sql");
      assert.fail("unexpected 0025 migration");
    } catch (e) {
      assert.equal(e.code, "ENOENT");
    }
    const notify = read("src/lib/notify.ts");
    assert.match(notify, /claim_email_delivery/);
    assert.match(notify, /reminder-1h-sms:/);
  });

  it("event catalog and channel policy cover PR8 surface", () => {
    assert.equal(NOTIFICATION_EVENTS.SESSION_REMINDER_1H, "session_reminder_1h");
    assert.equal(NOTIFICATION_EVENTS.PACKAGE_PURCHASED, "package_purchased");
    assert.equal(NOTIFICATION_EVENTS.GUIDE_REASSIGNMENT_FAILED, "guide_reassignment_failed");
    assert.ok(CHANNEL_POLICY.sms.includes("session_reminder_1h"));
    assert.ok(CHANNEL_POLICY.voice.includes("call_parent_escalation"));
    assert.ok(!CHANNEL_POLICY.sms.includes("package_purchased"));
    assert.ok(!CHANNEL_POLICY.sms.includes("guide_reassigned"));
  });

  it("pricing / free session / Call Parent / prepaid UX files unchanged in spirit", () => {
    const pkg = read("src/lib/packages.mjs");
    assert.match(pkg, /14000|25200|840|1680/);
    const free = read("supabase/migrations/0021_studyhall_pr3_one_hour_free_trial.sql");
    assert.match(free, /free_trial|is_free_trial/);
    const cp = read("supabase/migrations/0024_studyhall_pr7_call_parent.sql");
    assert.match(cp, /parent_escalation_requests/);
    const prepaid = read("src/lib/booking-prepaid-display.mjs");
    assert.match(prepaid, /Uses .* of your balance|prepaidCoversDuration/);
  });
});

describe("Study Hall PR8 — idempotency keys (DB, when configured)", () => {
  it("duplicate reminder email + SMS claims are rejected", async (t) => {
    if (!hasSupabaseEnv) {
      t.skip("Supabase env not configured");
      return;
    }
    const { adminClient, createUser, cleanupAll } = await import("./helpers.mjs");
    const svc = adminClient();
    const cust = await createUser({ requestedRole: "student", displayName: "PR8 Parent" });
    const bookingId = "00000000-0000-4000-8000-000000000801";
    const emailKey = `reminder-1h:${bookingId}:customer`;
    const smsKey = `reminder-1h-sms:${bookingId}`;
    try {
      assert.equal(
        (await svc.rpc("claim_email_delivery", { p_key: emailKey, p_type: "reminder_1h", p_account: cust.id, p_to: "p@x.test" })).data,
        true,
      );
      assert.equal(
        (await svc.rpc("claim_email_delivery", { p_key: emailKey, p_type: "reminder_1h", p_account: cust.id, p_to: "p@x.test" })).data,
        false,
        "duplicate cron does not resend email",
      );
      assert.equal(
        (await svc.rpc("claim_email_delivery", { p_key: smsKey, p_type: "reminder_1h_sms", p_account: cust.id, p_to: "sms:parent", p_text: "hi" })).data,
        true,
      );
      assert.equal(
        (await svc.rpc("claim_email_delivery", { p_key: smsKey, p_type: "reminder_1h_sms", p_account: cust.id, p_to: "sms:parent" })).data,
        false,
        "duplicate cron does not resend SMS",
      );

      const conf = `booking-confirmed:${bookingId}`;
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: conf, p_type: "booking_confirmed", p_account: cust.id, p_to: "p@x.test" })).data, true);
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: conf, p_type: "booking_confirmed", p_account: cust.id, p_to: "p@x.test" })).data, false);

      const pkg = `package-purchased:00000000-0000-4000-8000-000000000802`;
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: pkg, p_type: "package_purchased", p_account: cust.id, p_to: "p@x.test" })).data, true);
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: pkg, p_type: "package_purchased", p_account: cust.id, p_to: "p@x.test" })).data, false);

      const cancelT = `cancellation-tutor:${bookingId}`;
      const cancelParent = `cancellation:${bookingId}`;
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: cancelT, p_type: "tutor_cancellation", p_account: cust.id, p_to: "g@x.test" })).data, true);
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: cancelT, p_type: "tutor_cancellation", p_account: cust.id, p_to: "g@x.test" })).data, false);
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: cancelParent, p_type: "cancellation", p_account: cust.id, p_to: "p@x.test" })).data, true);
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: cancelParent, p_type: "cancellation", p_account: cust.id, p_to: "p@x.test" })).data, false);

      // Successful reassignment: Guide keys only — no parent reassignment:/reassignment-sms: keys.
      const guideA = "00000000-0000-4000-8000-0000000008a1";
      const guideB = "00000000-0000-4000-8000-0000000008a2";
      const newGuideKey = `tutor-new-session:${bookingId}:${guideB}`;
      const removedKey = `tutor-removed:${bookingId}:${guideA}`;
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: newGuideKey, p_type: "tutor_new_session", p_account: cust.id, p_to: "g@x.test" })).data, true);
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: newGuideKey, p_type: "tutor_new_session", p_account: cust.id, p_to: "g@x.test" })).data, false, "duplicate reassignment does not duplicate Guide notify");
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: removedKey, p_type: "tutor_removed", p_account: cust.id, p_to: "g2@x.test" })).data, true);
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: removedKey, p_type: "tutor_removed", p_account: cust.id, p_to: "g2@x.test" })).data, false);

      // Session-impacted release still uses parent release key.
      const releaseKey = `release:${bookingId}`;
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: releaseKey, p_type: "guide_reassignment_failed", p_account: cust.id, p_to: "p@x.test" })).data, true);
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: releaseKey, p_type: "guide_reassignment_failed", p_account: cust.id, p_to: "p@x.test" })).data, false);

      const report = `session-report-ready:00000000-0000-4000-8000-000000000803`;
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: report, p_type: "session_report_ready", p_account: cust.id, p_to: "p@x.test" })).data, true);
      assert.equal((await svc.rpc("claim_email_delivery", { p_key: report, p_type: "session_report_ready", p_account: cust.id, p_to: "p@x.test" })).data, false);
    } finally {
      await svc.from("email_deliveries").delete().eq("recipient_account_id", cust.id);
      await cleanupAll();
    }
  });
});
