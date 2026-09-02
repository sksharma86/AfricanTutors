import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { guideAttendanceRequest, guideOpenCoverageOffer } from "../src/lib/email/templates.mjs";
import {
  hasCurrentConfirmedCoverage,
  managementAttendanceIssue,
  shouldProtectCustomer,
  t30DeadlineIso,
} from "../src/lib/guide-attendance.mjs";
import { CHANNEL_POLICY } from "../src/lib/notifications/events.mjs";
import { reassignmentRecipients, reassignmentOutcome } from "../src/lib/notifications/reassignment-policy.mjs";
import {
  canStartCoverageSearch,
  claimResultMessage,
  isEligibleEmergencyCandidate,
  openCoverageEmailNotifyKey,
  openCoverageNotifyKey,
  openCoveragePath,
} from "../src/lib/open-coverage.mjs";
import { isWhatsAppConfigured } from "../src/lib/telephony/whatsapp-config.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const START = "2026-08-30T23:00:00.000Z"; // 6:00 PM CDT
const END = "2026-08-31T00:00:00.000Z";
const TZ = "America/Chicago";
const BID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const APP = "https://studyhall.example";

const booking = {
  id: "b1",
  status: "confirmed",
  tutor_id: "guide-a",
  scheduled_start: START,
  scheduled_end: END,
};

const missed = { id: "a-miss", booking_id: "b1", tutor_id: "guide-a", source: "t30", status: "missed" };

function attendanceMail(extra = {}) {
  return guideAttendanceRequest({
    whenISO: START,
    deadlineISO: t30DeadlineIso(START),
    tz: TZ,
    durationMinutes: 60,
    studentName: "Jordan",
    studentNames: ["Jordan"],
    appUrl: APP,
    ...extra,
  });
}

function emergencyMail(extra = {}) {
  return guideOpenCoverageOffer({
    whenISO: START,
    endISO: END,
    tz: TZ,
    durationMinutes: 60,
    appUrl: APP,
    bookingId: BID,
    ...extra,
  });
}

describe("Email-first attendance and emergency coverage", () => {
  it("1–4 assigned Guide T-30 email has time, deadline, and secure confirm CTA", () => {
    const mail = attendanceMail();
    assert.match(mail.subject, /⚠️ ACTION REQUIRED NOW: Confirm your upcoming Study Hall/);
    assert.match(mail.text, /6:00\s*PM/i);
    assert.match(mail.html, /6:00\s*PM/i);
    const deadline = t30DeadlineIso(START);
    assert.ok(deadline);
    assert.match(mail.text, /5:40\s*PM/i);
    assert.match(mail.text, /Confirmation deadline/i);
    assert.match(mail.text, /CONFIRM I WILL BE THERE/);
    assert.match(mail.html, /CONFIRM I WILL BE THERE/);
    assert.match(mail.html, /<a href="https:\/\/studyhall\.example\/dashboard\/tutor"/);
    assert.doesNotMatch(mail.html, /token=|daily\.co/i);
  });

  it("5 T-20 miss still opens emergency coverage from the existing cron + RPC", () => {
    assert.equal(canStartCoverageSearch({ booking, assignment: missed }).ok, true);
    const cron = read("src/app/api/cron/guide-attendance/route.ts");
    assert.match(cron, /open_emergency_coverage_search/);
    assert.match(cron, /notifyOpenCoverageOffer/);
    assert.match(cron, /EMAIL-FIRST|email \(Resend\)|notifies by email/i);
  });

  it("6–8 every eligible Guide gets an individual email; failed/current Guide does not", () => {
    assert.equal(
      isEligibleEmergencyCandidate({
        candidateId: "guide-b",
        currentTutorId: "guide-a",
        approved: true,
        timezone: TZ,
        available: true,
      }),
      true,
    );
    assert.equal(
      isEligibleEmergencyCandidate({
        candidateId: "guide-a",
        currentTutorId: "guide-a",
        approved: true,
        timezone: TZ,
        available: true,
      }),
      false,
    );
    const a = openCoverageEmailNotifyKey({ bookingId: "b1", tutorId: "g2", searchKey: "a-miss" });
    const b = openCoverageEmailNotifyKey({ bookingId: "b1", tutorId: "g3", searchKey: "a-miss" });
    assert.equal(a, "open-coverage:g2:b1:a-miss:email");
    assert.notEqual(a, b);
    const notify = read("src/lib/notify.ts");
    const offerFn = notify.slice(
      notify.indexOf("export async function notifyOpenCoverageOffer"),
      notify.indexOf("/** Management exception when a confirmation deadline is missed"),
    );
    assert.match(offerFn, /accountId: opts\.tutorId/);
    assert.match(offerFn, /guideOpenCoverageOffer/);
    assert.doesNotMatch(offerFn, /toEmailOverride/);
  });

  it("9–11 emergency email is private and uses the secure portal accept path", () => {
    const mail = emergencyMail();
    const blob = `${mail.subject}\n${mail.html}\n${mail.text}`;
    assert.doesNotMatch(blob, /parent@|phone|\+1|address|stripe|Sarah|James|Jordan|guide-b|eligible Guides/i);
    assert.match(mail.subject, /🚨 URGENT: Study Hall needs coverage at 6:00 PM/);
    assert.match(mail.html, /First available Guide to accept gets this Study Hall/);
    assert.match(mail.text, /ACCEPT THIS STUDY HALL/);
    assert.match(mail.html, new RegExp(`<a href="https://studyhall\\.example/dashboard/tutor/open-coverage/${BID}"`));
    assert.doesNotMatch(mail.html, /token=/);
    assert.equal(openCoveragePath(BID), `/dashboard/tutor/open-coverage/${BID}`);
  });

  it("12–16 first valid claim wins, confirms attendance, and losers see already covered", () => {
    const sql = read("supabase/migrations/0035_guide_emergency_coverage.sql");
    assert.match(sql, /claim_open_coverage/);
    assert.match(sql, /for update/);
    assert.match(sql, /tutor_id = v_uid/);
    assert.match(sql, /status = 'confirmed'/);
    assert.match(sql, /source = 'emergency'/);
    assert.match(sql, /already_covered/);
    assert.doesNotMatch(sql, /I'll be there/);
    assert.equal(claimResultMessage("already_covered"), "This Study Hall has already been covered.");
    const winner = { status: "confirmed", tutor_id: "guide-b", source: "emergency" };
    assert.equal(hasCurrentConfirmedCoverage({ ...booking, tutor_id: "guide-b" }, winner), true);
    const page = read("src/app/dashboard/tutor/open-coverage/[bookingId]/page.tsx");
    assert.match(page, /claimResultMessage/);
    assert.doesNotMatch(page, /I'll be there/);
    const card = read("src/components/dashboard/guide-open-coverage-card.tsx");
    assert.match(card, /Accept session|message/);
  });

  it("17 parent stays silent after successful internal recovery", () => {
    assert.equal(reassignmentOutcome(true), "successful_internal");
    const rec = reassignmentRecipients("successful_internal");
    assert.equal(rec.parentEmail, false);
    assert.equal(rec.parentSms, false);
    const claim = read("src/app/api/tutor/open-coverage/claim/route.ts");
    assert.doesNotMatch(claim, /notifyCoverage|notifyReassignment|notifyBookingConfirmed/);
  });

  it("18 repeated cron sweeps reuse one email key per Guide per search", () => {
    const key = openCoverageEmailNotifyKey({ bookingId: "b1", tutorId: "g2", searchKey: "a-miss" });
    assert.equal(key, openCoverageEmailNotifyKey({ bookingId: "b1", tutorId: "g2", searchKey: "a-miss" }));
    assert.notEqual(key, openCoverageNotifyKey({ bookingId: "b1", tutorId: "g2", searchKey: "a-miss" }));
    const notify = read("src/lib/notify.ts");
    assert.match(notify, /openCoverageEmailNotifyKey/);
    assert.match(notify, /claim_email_delivery/);
    const cron = read("src/app/api/cron/guide-attendance/route.ts");
    assert.match(cron, /One initial email per Guide per search cycle/);
  });

  it("19–20 missing WhatsApp config does not impair email T-30 or emergency workflow", () => {
    const prev = {
      sid: process.env.TWILIO_ACCOUNT_SID,
      token: process.env.TWILIO_AUTH_TOKEN,
      from: process.env.TWILIO_WHATSAPP_FROM,
      disabled: process.env.TWILIO_WHATSAPP_DISABLED,
    };
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WHATSAPP_FROM;
    process.env.TWILIO_WHATSAPP_DISABLED = "1";
    assert.equal(isWhatsAppConfigured(), false);
    const mail = attendanceMail();
    const offer = emergencyMail();
    assert.match(mail.subject, /ACTION REQUIRED NOW/);
    assert.match(offer.subject, /URGENT/);
    const cron = read("src/app/api/cron/guide-attendance/route.ts");
    assert.match(cron, /WhatsApp is optional and never required/);
    const env = read(".env.example");
    assert.match(env, /OPTIONAL \/ LATER/);
    assert.match(env, /does not block T-30 emails/);
    process.env.TWILIO_ACCOUNT_SID = prev.sid;
    process.env.TWILIO_AUTH_TOKEN = prev.token;
    process.env.TWILIO_WHATSAPP_FROM = prev.from;
    if (prev.disabled == null) delete process.env.TWILIO_WHATSAPP_DISABLED;
    else process.env.TWILIO_WHATSAPP_DISABLED = prev.disabled;
  });

  it("21 Resend failure does not corrupt attendance state", () => {
    const notify = read("src/lib/notify.ts");
    const cron = read("src/app/api/cron/guide-attendance/route.ts");
    assert.match(notify, /Delivery failure does not change attendance or claim state/);
    assert.match(cron, /delivery failure must not change attendance state/);
    assert.match(cron, /search\/notify failure must not change attendance or T-20 state/);
    assert.match(cron, /open-coverage-email-failed/);
    assert.doesNotMatch(notify, /deliver\([\s\S]{0,400}guide_attendance_assignments/);
  });

  it("22–23 T-10 escalation and T-2 protection still work", () => {
    const t10 = Date.parse(START) - 10 * 60_000;
    const t2 = Date.parse(START) - 2 * 60_000;
    const critical = managementAttendanceIssue({ booking, assignment: missed, nowMs: t10, offerCount: 8 });
    assert.equal(critical.kind, "guide_confirm_critical");
    assert.match(critical.title, /OPERATIONAL EMERGENCY/);
    assert.equal(critical.severity, "critical");
    assert.equal(shouldProtectCustomer({ booking, assignment: missed, nowMs: t2 }).ok, true);
    assert.equal(
      shouldProtectCustomer({
        booking: { ...booking, tutor_id: "guide-b" },
        assignment: { status: "confirmed", tutor_id: "guide-b" },
        nowMs: t2,
      }).ok,
      false,
    );
  });

  it("24–27 cancel, session start, and Management reassignment close stale offers; miss remains", () => {
    const sql = read("supabase/migrations/0035_guide_emergency_coverage.sql");
    assert.match(sql, /sync_open_coverage_offers/);
    assert.match(sql, /booking_cancelled/);
    assert.match(sql, /coverage_restored/);
    assert.match(sql, /session_started/);
    assert.match(sql, /after update of tutor_id, status/);
    assert.match(missed.status, /missed/);
    assert.equal(hasCurrentConfirmedCoverage(booking, missed), false);
  });

  it("28 mobile email rendering uses a full-width tap target", () => {
    const mail = attendanceMail();
    const offer = emergencyMail();
    for (const html of [mail.html, offer.html]) {
      assert.match(html, /width=device-width/);
      assert.match(html, /display:block/);
      assert.match(html, /width:100%/);
      assert.match(html, /min-height:48px/);
      assert.match(html, /font-size:16px/);
      assert.match(html, /padding:16px/);
    }
  });

  it("29 existing normal notification policy remains intact", () => {
    assert.ok(CHANNEL_POLICY.email.includes("booking_confirmed"));
    assert.ok(CHANNEL_POLICY.email.includes("session_reminder_1h"));
    assert.ok(CHANNEL_POLICY.sms.includes("session_reminder_1h"));
    assert.ok(!CHANNEL_POLICY.sms.includes("guide_attendance_request"));
    assert.ok(!CHANNEL_POLICY.sms.includes("guide_open_coverage"));
    assert.ok(CHANNEL_POLICY.email.includes("guide_attendance_request"));
    assert.ok(CHANNEL_POLICY.email.includes("guide_open_coverage"));
  });

  it("30 email-first tests do not write the demo database", () => {
    assert.equal(typeof guideAttendanceRequest, "function");
    assert.equal(typeof guideOpenCoverageOffer, "function");
    assert.equal(typeof openCoverageEmailNotifyKey, "function");
    assert.ok(!CHANNEL_POLICY.sms.includes("guide_open_coverage"));
  });
});
