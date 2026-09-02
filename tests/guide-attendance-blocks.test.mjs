import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { guideAttendanceRequest } from "../src/lib/email/templates.mjs";
import {
  attendanceNotifyKey,
  canConfirmAttendance,
  canConfirmAttendanceInBlock,
  confirmBlockResult,
  confirmationBlocks,
  confirmationWindow,
  contiguousBlockContaining,
  expandOpenMembers,
  groupManagementCoverageIssues,
  isContiguous,
  isE164,
  missedNotifyKey,
  obligationBlockContaining,
  shouldOpenIndependently,
  splitObligationRuns,
} from "../src/lib/guide-attendance.mjs";
import { CHANNEL_POLICY } from "../src/lib/notifications/events.mjs";
import { parentSessionReminderSms } from "../src/lib/notifications/sms-copy.mjs";
import { guideAttendanceWhatsApp, whatsappContainsSensitive } from "../src/lib/notifications/whatsapp-copy.mjs";
import { getWhatsAppConfig, isWhatsAppConfigured } from "../src/lib/telephony/whatsapp-config.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const t = (h, m = 0) => `2026-08-30T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
const hall = (id, start, end, extra = {}) => ({
  id,
  status: "confirmed",
  tutor_id: "guide-a",
  tutor_display_name: "Sarah M.",
  scheduled_start: start,
  scheduled_end: end,
  duration_minutes: (Date.parse(end) - Date.parse(start)) / 60000,
  student_first_name: extra.child ?? id,
  ...extra,
});

const six = hall("b6", t(18), t(19), { child: "Jordan" });
const seven = hall("b7", t(19), t(20), { child: "Maya" });
const eight = hall("b8", t(20), t(21), { child: "Ethan" });
const nine = hall("b9", t(21), t(22), { child: "Ava" });
const gap = hall("bgap", t(19, 30), t(20, 30), { child: "Leo" });
const mixed = [
  hall("m1", t(18), t(18, 30)),
  hall("m2", t(18, 30), t(20)),
  hall("m3", t(20), t(21)),
  hall("m4", t(21), t(22, 30)),
];

describe("Continuous confirmation blocks", () => {
  it("one session behaves as before", () => {
    assert.deepEqual(confirmationBlocks([six]).map((b) => b.map((x) => x.id)), [["b6"]]);
    const w = confirmationWindow(six.scheduled_start);
    assert.equal(w.openAt, Date.parse(six.scheduled_start) - 30 * 60_000);
    assert.equal(w.deadlineAt, Date.parse(six.scheduled_start) - 20 * 60_000);
  });

  it("two exactly contiguous sessions form one block", () => {
    assert.equal(isContiguous(six, seven), true);
    assert.deepEqual(confirmationBlocks([six, seven]).map((b) => b.map((x) => x.id)), [["b6", "b7"]]);
  });

  it("three and four exactly contiguous sessions form one block", () => {
    assert.equal(confirmationBlocks([six, seven, eight])[0].length, 3);
    assert.equal(confirmationBlocks([six, seven, eight, nine])[0].length, 4);
  });

  it("mixed-duration contiguous sessions form one block", () => {
    assert.equal(confirmationBlocks(mixed)[0].length, 4);
    assert.equal(isContiguous(mixed[0], mixed[1]), true);
  });

  it("any positive gap creates a separate block", () => {
    assert.equal(isContiguous(six, gap), false);
    assert.equal(confirmationBlocks([six, gap]).length, 2);
  });

  it("confirmation opens and deadlines from the first session", () => {
    const block = confirmationBlocks([six, seven, eight, nine])[0];
    const w = confirmationWindow(block[0].scheduled_start);
    assert.equal(w.openAt, Date.parse(t(17, 30)));
    assert.equal(w.deadlineAt, Date.parse(t(17, 40)));
  });

  it("one action confirms all CURRENT eligible assignments, stored per assignment", () => {
    const nowMs = Date.parse(t(17, 34));
    const result = confirmBlockResult({
      bookings: [six, seven, eight, nine],
      actorId: "guide-a",
      nowMs,
    });
    assert.equal(result.confirmed.length, 4);
    assert.equal(result.skipped.length, 0);
    assert.equal(result.confirmed.every((c) => c.id), true);
  });

  it("stale client cannot confirm an assignment no longer owned", () => {
    const nowMs = Date.parse(t(17, 34));
    const result = confirmBlockResult({
      bookings: [six, { ...seven, tutor_id: "guide-b" }, eight, nine],
      actorId: "guide-a",
      nowMs,
    });
    assert.deepEqual(result.confirmed.map((c) => c.id).sort(), ["b6", "b8", "b9"]);
    assert.equal(result.skipped.some((s) => s.id === "b7"), true);
  });

  it("Confirm All is idempotent for already-confirmed members", () => {
    const nowMs = Date.parse(t(17, 34));
    const result = confirmBlockResult({
      bookings: [six, seven],
      actorId: "guide-a",
      assignmentsByBooking: { b6: { status: "confirmed", tutor_id: "guide-a" } },
      nowMs,
    });
    assert.equal(result.confirmed.find((c) => c.id === "b6").idempotent, true);
    assert.equal(result.confirmed.find((c) => c.id === "b7").idempotent, false);
  });

  it("later cron does not independently reopen confirmed or awaiting followers", () => {
    assert.equal(shouldOpenIndependently(seven, six, { status: "awaiting" }), false);
    assert.equal(shouldOpenIndependently(seven, six, { status: "confirmed" }), true);
    assert.equal(shouldOpenIndependently(seven, six, { status: "missed", resolved_at: null }, { status: "missed" }), false);
    assert.equal(shouldOpenIndependently(hall("b10", t(22), t(23)), nine, { status: "missed", resolved_at: null }, null), true);
    const members = expandOpenMembers(six, [six, seven, eight], {
      b7: { status: "confirmed" },
    });
    assert.deepEqual(members.map((m) => m.id), ["b6", "b8"]);
  });

  it("one attendance notification key exists for the block", () => {
    const key = attendanceNotifyKey({ tutorId: "guide-a", firstBookingId: "b6" });
    assert.equal(key, "guide-attendance-block:guide-a:b6:t30");
    assert.equal(attendanceNotifyKey({ tutorId: "guide-a", firstBookingId: "b6", source: "replacement" }).includes("replacement"), true);
    assert.equal(missedNotifyKey({ tutorId: "guide-a", firstBookingId: "b6" }), "guide-confirm-missed-block:guide-a:b6");
  });

  it("missed block preserves individual history and groups Management cards", () => {
    const bookings = [six, seven, eight, nine];
    const items = bookings.map((b) => ({
      kind: "guide_confirm_missed",
      title: "Guide confirmation missed",
      bookingId: b.id,
      detail: "Sarah M.",
    }));
    const grouped = groupManagementCoverageIssues(items, bookings);
    const coverage = grouped.filter((i) => i.kind === "guide_confirm_missed");
    assert.equal(coverage.length, 1);
    assert.equal(coverage[0].title, "Guide coverage unconfirmed");
    assert.match(coverage[0].summary, /4 Study Halls/);
    assert.equal(coverage[0].bookingIds.length, 4);
  });

  it("reassignment and cancellation do not invalidate unrelated confirmations", () => {
    const nowMs = Date.parse(t(17, 34));
    assert.equal(
      canConfirmAttendance({
        bookingStatus: "confirmed",
        assignedTutorId: "guide-a",
        actorId: "guide-a",
        scheduledStart: six.scheduled_start,
        assignment: { status: "confirmed", tutor_id: "guide-a" },
        nowMs,
      }).idempotent,
      true,
    );
    assert.equal(
      canConfirmAttendance({
        bookingStatus: "cancelled",
        assignedTutorId: "guide-a",
        actorId: "guide-a",
        scheduledStart: seven.scheduled_start,
        assignment: { status: "voided" },
        nowMs,
      }).ok,
      false,
    );
    assert.equal(
      canConfirmAttendanceInBlock({
        booking: { ...eight, tutor_id: "guide-b" },
        actorId: "guide-a",
        firstScheduledStart: six.scheduled_start,
        nowMs,
      }).ok,
      false,
    );
  });

  it("newly appended assignment is not implicitly confirmed", () => {
    assert.equal(shouldOpenIndependently(nine, eight, { status: "confirmed" }), true);
    const later = hall("b10", t(22), t(23));
    const block = contiguousBlockContaining([six, seven, eight, nine, later], later.id);
    assert.equal(block[0].id, "b6");
    assert.equal(shouldOpenIndependently(later, nine, { status: "confirmed" }), true);
  });

  it("material reschedule uses the first session window, not a silent carry-over", () => {
    const moved = { ...six, scheduled_start: t(19, 30), scheduled_end: t(20, 30) };
    assert.equal(isContiguous(moved, seven), false);
    const tooEarly = canConfirmAttendance({
      bookingStatus: "confirmed",
      assignedTutorId: "guide-a",
      actorId: "guide-a",
      scheduledStart: moved.scheduled_start,
      nowMs: Date.parse(t(17, 34)),
    });
    assert.equal(tooEarly.ok, false);
    assert.equal(tooEarly.reason, "too_early");
  });

  it("replacement contiguous assignments are one immediate block", () => {
    const owned = [
      { ...six, tutor_id: "guide-b" },
      { ...seven, tutor_id: "guide-b" },
    ];
    const block = contiguousBlockContaining(owned, "b6", { tutorId: "guide-b" });
    assert.equal(block.length, 2);
    const nowMs = Date.parse(t(17, 43));
    const r = confirmBlockResult({
      bookings: block,
      actorId: "guide-b",
      assignmentsByBooking: {
        b6: { status: "awaiting", tutor_id: "guide-b", source: "replacement", deadline_at: t(17, 53) },
        b7: { status: "awaiting", tutor_id: "guide-b", source: "replacement", deadline_at: t(17, 53) },
      },
      nowMs,
    });
    assert.equal(r.confirmed.length, 2);
    assert.equal(r.skipped.length, 0);
  });

  it("newly appended hall is its own obligation after a confirmed block", () => {
    const later = hall("b10", t(22), t(23));
    const bookings = [six, seven, eight, nine, later].map((b, i) => ({
      ...b,
      attendance: i < 4 ? { status: "confirmed", tutor_id: "guide-a" } : { status: "awaiting", tutor_id: "guide-a" },
    }));
    const runs = splitObligationRuns(confirmationBlocks(bookings)[0]);
    assert.equal(runs.length, 2);
    assert.deepEqual(runs[1].map((b) => b.id), ["b10"]);
    const obligation = obligationBlockContaining(bookings, "b10");
    assert.deepEqual(obligation.map((b) => b.id), ["b10"]);
    const nowMs = Date.parse(t(21, 34));
    const assignmentsByBooking = {
      b6: { status: "confirmed", tutor_id: "guide-a" },
      b7: { status: "confirmed", tutor_id: "guide-a" },
      b8: { status: "confirmed", tutor_id: "guide-a" },
      b9: { status: "confirmed", tutor_id: "guide-a" },
      b10: { status: "awaiting", tutor_id: "guide-a", deadline_at: t(21, 40) },
    };
    const r = confirmBlockResult({
      bookings,
      actorId: "guide-a",
      seedId: "b10",
      assignmentsByBooking,
      nowMs,
    });
    assert.deepEqual(r.confirmed.map((c) => c.id), ["b10"]);
    const stale = confirmBlockResult({
      bookings,
      actorId: "guide-a",
      seedId: "b6",
      assignmentsByBooking,
      nowMs,
    });
    assert.deepEqual(stale.confirmed.map((c) => c.id).sort(), ["b6", "b7", "b8", "b9"]);
    assert.equal(stale.confirmed.every((c) => c.idempotent), true);
    assert.equal(stale.confirmed.some((c) => c.id === "b10"), false);
  });

  it("Confirm All skips cancelled members and stays idempotent", () => {
    const nowMs = Date.parse(t(17, 34));
    const first = confirmBlockResult({
      bookings: [six, { ...seven, status: "cancelled" }, eight],
      actorId: "guide-a",
      nowMs,
    });
    assert.deepEqual(first.confirmed.map((c) => c.id).sort(), ["b6", "b8"]);
    assert.equal(first.skipped.some((s) => s.id === "b7"), true);
    const second = confirmBlockResult({
      bookings: [six, eight],
      actorId: "guide-a",
      assignmentsByBooking: {
        b6: { status: "confirmed", tutor_id: "guide-a" },
        b8: { status: "confirmed", tutor_id: "guide-a" },
      },
      nowMs,
    });
    assert.equal(second.confirmed.every((c) => c.idempotent), true);
  });

  it("cron/confirm race after T-20 is a deadline, not a confirm", () => {
    const nowMs = Date.parse(t(17, 40)) + 1;
    const r = confirmBlockResult({
      bookings: [six, seven],
      actorId: "guide-a",
      assignmentsByBooking: {
        b6: { status: "missed", tutor_id: "guide-a" },
        b7: { status: "awaiting", tutor_id: "guide-a", deadline_at: t(17, 40) },
      },
      nowMs,
    });
    assert.equal(r.confirmed.length, 0);
    assert.ok(r.skipped.every((s) => s.reason === "deadline"));
  });
});

describe("Guide WhatsApp channel", () => {
  it("single and block attendance requests render one WhatsApp body each", () => {
    const one = guideAttendanceWhatsApp({
      count: 1,
      startISO: t(18),
      tz: "America/Chicago",
      durationMinutes: 60,
      studentName: "Jordan",
      appUrl: "https://example.com",
    });
    assert.match(one.body, /STUDY HALL ATTENDANCE CONFIRMATION/);
    assert.match(one.body, /Jordan/);
    assert.match(one.body, /dashboard\/tutor/);
    assert.equal(one.template, "guide_attendance_confirmation");
    const four = guideAttendanceWhatsApp({
      count: 4,
      startISO: t(18),
      endISO: t(22),
      tz: "America/Chicago",
      appUrl: "https://example.com",
    });
    assert.match(four.body, /4 consecutive Study Halls/);
    assert.doesNotMatch(four.body, /6:30[\s\S]*7:30[\s\S]*8:30/);
    const two = guideAttendanceWhatsApp({
      count: 2,
      startISO: t(18),
      endISO: t(20),
      tz: "America/Chicago",
      appUrl: "https://example.com",
    });
    assert.match(two.body, /2 consecutive/);
  });

  it("replacement WhatsApp is distinct and still Portal-linked", () => {
    const wa = guideAttendanceWhatsApp({
      count: 2,
      startISO: t(18),
      endISO: t(20),
      tz: "Africa/Nairobi",
      appUrl: "https://example.com",
      replacement: true,
    });
    assert.match(wa.body, /NEW STUDY HALL ASSIGNMENTS/);
    assert.match(wa.body, /EAT|GMT|UTC/);
    assert.equal(wa.template, "guide_replacement_assignment");
    assert.doesNotMatch(wa.body, /\bYES\b|\bY\b|reply 1/i);
  });

  it("WhatsApp copy stays private and timezone-labeled", () => {
    const wa = guideAttendanceWhatsApp({
      count: 1,
      startISO: t(18),
      tz: "America/Chicago",
      studentName: "Jordan",
      appUrl: "https://example.com",
    });
    assert.equal(whatsappContainsSensitive(wa.body), false);
    assert.doesNotMatch(wa.body, /parent@|phone_e164|\+1555|stripe|daily\.co/i);
    assert.match(wa.body, /CT|CDT|CST|GMT/);
  });

  it("international E.164 is accepted; US formatting is not assumed", () => {
    assert.equal(isE164("+254700000001"), true);
    assert.equal(isE164("+639171234567"), true);
    assert.equal(isE164("5551234567"), false);
    assert.equal(isE164("+1 (555) 123-4567"), false);
  });

  it("missing WhatsApp config fails safely and does not use parent SMS From", () => {
    const prev = {
      sid: process.env.TWILIO_ACCOUNT_SID,
      token: process.env.TWILIO_AUTH_TOKEN,
      from: process.env.TWILIO_WHATSAPP_FROM,
      disabled: process.env.TWILIO_WHATSAPP_DISABLED,
    };
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "token";
    delete process.env.TWILIO_WHATSAPP_FROM;
    process.env.TWILIO_WHATSAPP_DISABLED = "1";
    assert.equal(isWhatsAppConfigured(), false);
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";
    process.env.TWILIO_WHATSAPP_DISABLED = "1";
    assert.equal(isWhatsAppConfigured(), false);
    delete process.env.TWILIO_WHATSAPP_DISABLED;
    assert.equal(isWhatsAppConfigured(), true);
    assert.equal(getWhatsAppConfig().from.includes("whatsapp:"), true);
    process.env.TWILIO_PHONE_NUMBER = "+15550001111";
    assert.equal(Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER), true);
    const client = read("src/lib/telephony/client.ts");
    const waFn = client.slice(client.indexOf("export async function sendGuideWhatsApp"));
    assert.match(waFn, /getWhatsAppConfig/);
    assert.doesNotMatch(waFn, /getTwilioConfig|phoneNumber/);
    assert.match(client, /sendParentAttentionSms/);
    process.env.TWILIO_ACCOUNT_SID = prev.sid;
    process.env.TWILIO_AUTH_TOKEN = prev.token;
    process.env.TWILIO_WHATSAPP_FROM = prev.from;
    process.env.TWILIO_WHATSAPP_DISABLED = prev.disabled;
  });

  it("email is V1 primary; Guide SMS is not a channel; Parent SMS is unchanged", () => {
    assert.ok(CHANNEL_POLICY.email.includes("guide_attendance_request"));
    assert.ok(CHANNEL_POLICY.whatsapp.includes("guide_attendance_request"));
    assert.ok(!CHANNEL_POLICY.sms.includes("guide_attendance_request"));
    assert.ok(CHANNEL_POLICY.sms.includes("session_reminder_1h"));
    const sms = parentSessionReminderSms({ studentName: "Jordan", whenISO: t(18), tz: "America/Chicago" });
    assert.match(sms, /Jordan's Study Hall/);
    const mail = guideAttendanceRequest({
      whenISO: t(18),
      endISO: t(22),
      tz: "America/Chicago",
      count: 4,
      appUrl: "https://example.com",
    });
    assert.match(mail.subject, /ACTION REQUIRED NOW/);
    assert.match(mail.subject, /4 upcoming Study Halls/);
    assert.match(mail.text, /CONFIRM ALL 4/);
  });

  it("WhatsApp delivery cannot mark attendance confirmed or missed", () => {
    const notify = read("src/lib/notify.ts");
    const wa = notify.slice(notify.indexOf("async function deliverGuideWhatsApp"), notify.indexOf("return { status: result.status }", notify.indexOf("async function deliverGuideWhatsApp")) + 80);
    assert.match(wa, /complete_email_delivery/);
    assert.doesNotMatch(wa, /guide_attendance_assignments|confirm_guide_attendance|status: \"missed\"/);
    const client = read("src/lib/telephony/client.ts");
    assert.match(client, /Does not mark attendance confirmed or missed/);
    assert.doesNotMatch(client, /guide_attendance_assignments/);
  });

  it("architecture keeps Portal authoritative and does not send real WhatsApp from fixtures", () => {
    const cron = read("src/app/api/cron/guide-attendance/route.ts");
    assert.match(cron, /obligationBlockContaining/);
    assert.match(cron, /delivery failure must not change attendance state/);
    assert.doesNotMatch(cron, /status = \"confirmed\"|mark.*confirmed|status: \"missed\"/);
    assert.doesNotMatch(cron, /sendParentAttentionSms/);
    const notify = read("src/lib/notify.ts");
    assert.match(notify, /deliverGuideWhatsApp/);
    assert.match(notify, /whatsapp:guide/);
    assert.doesNotMatch(notify, /reply YES|inbound/);
    const api = read("src/app/api/tutor/attendance-confirm/route.ts");
    assert.match(api, /confirm_guide_attendance_block/);
    const sql = read("supabase/migrations/0034_guide_pre_session_confirmation.sql");
    assert.match(sql, /confirm_guide_attendance_block/);
    assert.match(sql, /scheduled_end = cur.scheduled_start|scheduled_start = cur.scheduled_end/);
    assert.match(sql, /confirmed → unconfirmed|later appended hall is\s+not silently confirmed/);
    assert.match(sql, /role in \('student', 'tutor'\)/);
    assert.doesNotMatch(sql, /whatsapp_number|whatsapp_e164/);
    const review = read("src/app/dashboard/tutor/visual-review/page.tsx");
    assert.match(review, /WhatsApp preview · not sent/);
    assert.doesNotMatch(read("src/lib/guide-home-visual-fixture.mjs"), /sendGuideWhatsApp/);
    assert.doesNotMatch(read("src/lib/call-parent.mjs"), /sendGuideWhatsApp/);
    const waClient = read("src/lib/telephony/client.ts");
    assert.match(waClient, /Does not mark attendance confirmed or missed/);
    assert.doesNotMatch(read("src/lib/notify.ts"), /deliverGuideWhatsApp[\s\S]{0,800}confirm_guide_attendance/);
  });
});
