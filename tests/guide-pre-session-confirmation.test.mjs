import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { coverageCancellation, guideAttendanceRequest } from "../src/lib/email/templates.mjs";
import {
  COVERAGE_CANCEL_REASON,
  canConfirmAttendance,
  chooseOpenSource,
  confirmationWindow,
  coverageRestorationLine,
  guideAttendanceRowLabel,
  guideAttendanceState,
  isCoverageCancellationReason,
  managementAttendanceIssue,
} from "../src/lib/guide-attendance.mjs";
import { parentCoverageCancellationSms } from "../src/lib/notifications/sms-copy.mjs";
import { CHANNEL_POLICY, NOTIFICATION_EVENTS } from "../src/lib/notifications/events.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const START = "2026-08-30T18:00:00.000Z";
const startMs = Date.parse(START);
const t30 = startMs - 30 * 60_000;
const t20 = startMs - 20 * 60_000;
const t25 = startMs - 25 * 60_000;
const t19 = startMs - 19 * 60_000;
const t60 = startMs - 60 * 60_000;

const booking = {
  id: "b1",
  status: "confirmed",
  tutor_id: "guide-a",
  tutor_display_name: "Sarah M.",
  scheduled_start: START,
  duration_minutes: 60,
};

describe("Guide attendance confirmation — policy", () => {
  it("opens at T-30 and deadlines at T-20 (10 minutes)", () => {
    const w = confirmationWindow(START);
    assert.equal(w.openAt, t30);
    assert.equal(w.deadlineAt, t20);
    assert.equal(w.deadlineAt - w.openAt, 10 * 60_000);
  });

  it("Guide confirms exactly at T-30 and during the window", () => {
    assert.equal(canConfirmAttendance({ bookingStatus: "confirmed", assignedTutorId: "guide-a", actorId: "guide-a", scheduledStart: START, nowMs: t30 }).ok, true);
    assert.equal(canConfirmAttendance({ bookingStatus: "confirmed", assignedTutorId: "guide-a", actorId: "guide-a", scheduledStart: START, nowMs: t25 }).ok, true);
  });

  it("rejects confirmation before the window opens", () => {
    const r = canConfirmAttendance({
      bookingStatus: "confirmed",
      assignedTutorId: "guide-a",
      actorId: "guide-a",
      scheduledStart: START,
      nowMs: t60,
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "too_early");
    assert.equal(guideAttendanceState({ status: "confirmed", scheduledStart: START, nowMs: t60 }).kind, "not_yet");
  });

  it("allows confirmation exactly at the deadline and rejects just after", () => {
    assert.equal(canConfirmAttendance({ bookingStatus: "confirmed", assignedTutorId: "guide-a", actorId: "guide-a", scheduledStart: START, nowMs: t20 }).ok, true);
    const late = canConfirmAttendance({
      bookingStatus: "confirmed",
      assignedTutorId: "guide-a",
      actorId: "guide-a",
      scheduledStart: START,
      nowMs: t20 + 1,
    });
    assert.equal(late.ok, false);
    assert.equal(late.reason, "deadline");
  });

  it("is idempotent once confirmed", () => {
    const assignment = { status: "confirmed", tutor_id: "guide-a", confirmed_at: new Date(t25).toISOString() };
    const r = canConfirmAttendance({
      bookingStatus: "confirmed",
      assignedTutorId: "guide-a",
      actorId: "guide-a",
      scheduledStart: START,
      assignment,
      nowMs: t25,
    });
    assert.equal(r.ok, true);
    assert.equal(r.idempotent, true);
    assert.equal(guideAttendanceState({ status: "confirmed", scheduledStart: START, assignment, nowMs: t19 }).kind, "confirmed");
  });

  it("wrong Guide and stale assignment cannot confirm", () => {
    assert.equal(
      canConfirmAttendance({ bookingStatus: "confirmed", assignedTutorId: "guide-a", actorId: "guide-b", scheduledStart: START, nowMs: t25 }).reason,
      "not_assigned",
    );
    assert.equal(
      canConfirmAttendance({
        bookingStatus: "confirmed",
        assignedTutorId: "guide-b",
        actorId: "guide-a",
        scheduledStart: START,
        assignment: { status: "awaiting", tutor_id: "guide-a", deadline_at: new Date(t20).toISOString() },
        nowMs: t25,
      }).reason,
      "not_assigned",
    );
    assert.equal(
      canConfirmAttendance({
        bookingStatus: "confirmed",
        assignedTutorId: "guide-b",
        actorId: "guide-b",
        scheduledStart: START,
        assignment: { status: "superseded", tutor_id: "guide-a" },
        nowMs: t25,
      }).reason,
      "stale",
    );
  });

  it("parent cancellation and finished bookings are ineligible", () => {
    for (const status of ["cancelled", "completed", "no_show", "expired", "pending"]) {
      assert.equal(
        canConfirmAttendance({ bookingStatus: status, assignedTutorId: "guide-a", actorId: "guide-a", scheduledStart: START, nowMs: t25 }).ok,
        false,
      );
    }
  });

  it("confirmed booking does not become a Management miss", () => {
    const issue = managementAttendanceIssue({
      booking,
      assignment: { status: "confirmed", tutor_id: "guide-a", source: "t30" },
      nowMs: t19,
      assignmentsLoaded: true,
    });
    assert.equal(issue, null);
  });

  it("T-20 without confirm becomes a high-priority Management exception", () => {
    const derived = managementAttendanceIssue({ booking, assignment: null, nowMs: t19, assignmentsLoaded: true });
    assert.equal(derived.kind, "guide_confirm_missed");
    const persisted = managementAttendanceIssue({
      booking,
      assignment: { status: "missed", tutor_id: "guide-a", source: "t30" },
      nowMs: t19,
      assignmentsLoaded: true,
    });
    assert.equal(persisted.kind, "guide_confirm_missed");
    assert.equal(persisted.title, "Guide confirmation missed");
  });

  it("does not create a Management exception during the normal T-30 awaiting window", () => {
    assert.equal(
      managementAttendanceIssue({
        booking,
        assignment: { status: "awaiting", source: "t30", deadline_at: new Date(t20).toISOString() },
        nowMs: t25,
        assignmentsLoaded: true,
      }),
      null,
    );
  });

  it("replacement Guide awaiting confirmation is visible to Management", () => {
    const issue = managementAttendanceIssue({
      booking: { ...booking, tutor_id: "guide-b", tutor_display_name: "Grace K." },
      assignment: { status: "awaiting", source: "replacement", tutor_id: "guide-b", deadline_at: new Date(t19 + 10 * 60_000).toISOString() },
      nowMs: t19,
      assignmentsLoaded: true,
    });
    assert.equal(issue.kind, "guide_confirm_awaiting");
  });

  it("reassignment invalidates the previous Guide's confirmability", () => {
    const afterSwap = canConfirmAttendance({
      bookingStatus: "confirmed",
      assignedTutorId: "guide-b",
      actorId: "guide-a",
      scheduledStart: START,
      assignment: { status: "superseded", tutor_id: "guide-a" },
      nowMs: t19,
    });
    assert.equal(afterSwap.ok, false);
    const replacement = canConfirmAttendance({
      bookingStatus: "confirmed",
      assignedTutorId: "guide-b",
      actorId: "guide-b",
      scheduledStart: START,
      assignment: { status: "awaiting", tutor_id: "guide-b", source: "replacement", deadline_at: new Date(t19 + 10 * 60_000).toISOString() },
      nowMs: t19,
    });
    assert.equal(replacement.ok, true);
  });

  it("short-notice / replacement uses an immediate 10-minute window", () => {
    assert.equal(chooseOpenSource({ scheduledStart: START, nowMs: t19, isReplacement: true }), "replacement");
    assert.equal(chooseOpenSource({ scheduledStart: START, nowMs: t19 }), "short_notice");
    assert.equal(chooseOpenSource({ scheduledStart: START, nowMs: t25 }), "t30");
  });

  it("row labels stay restrained", () => {
    assert.equal(guideAttendanceRowLabel({ kind: "not_yet" }), "Not yet required");
    assert.equal(guideAttendanceRowLabel({ kind: "awaiting" }), "Confirmation required");
    assert.equal(guideAttendanceRowLabel({ kind: "confirmed" }), "Confirmed");
    assert.equal(guideAttendanceRowLabel({ kind: "missed" }), "Confirmation missed");
  });

  it("does not derive a miss when assignment rows were not loaded", () => {
    assert.equal(managementAttendanceIssue({ booking, assignment: null, nowMs: t19, assignmentsLoaded: false }), null);
  });
});

describe("Guide attendance confirmation — restoration and copy", () => {
  it("restores prepaid / free / paid language without blaming the Guide", () => {
    assert.match(coverageRestorationLine({ isFreeTrial: true }), /free Study Hall/);
    assert.match(coverageRestorationLine({ restoredMinutes: 60 }), /prepaid hour/);
    assert.match(coverageRestorationLine({ restoredCreditCents: 3500 }), /payment has been restored/);
    const email = coverageCancellation({
      restorationLine: coverageRestorationLine({ restoredMinutes: 60 }),
      compCreditCents: 1000,
    });
    assert.match(email.text, /unable to provide a Guide/i);
    assert.match(email.text, /prepaid hour/);
    assert.match(email.text, /\$10/);
    assert.doesNotMatch(email.text, /failed to confirm|Guide Sarah|misconduct|warning/i);
    const sms = parentCoverageCancellationSms({});
    assert.match(sms, /unable to provide a Guide/);
    assert.doesNotMatch(sms, /failed to confirm/);
  });

  it("Guide request email asks for confirmation and does not notify the parent", () => {
    const mail = guideAttendanceRequest({
      whenISO: START,
      tz: "America/Chicago",
      durationMinutes: 60,
      studentName: "Jordan",
      studentNames: ["Jordan"],
      appUrl: "https://example.com",
    });
    assert.match(mail.subject, /starts in 30 minutes/i);
    assert.match(mail.text, /I'll be there|confirm that you'll be there/i);
    assert.match(mail.text, /Jordan/);
    assert.equal(NOTIFICATION_EVENTS.GUIDE_ATTENDANCE_REQUEST, "guide_attendance_request");
    assert.ok(CHANNEL_POLICY.email.includes("guide_attendance_request"));
    assert.ok(CHANNEL_POLICY.sms.includes("coverage_cancellation"));
    assert.ok(!CHANNEL_POLICY.sms.includes("guide_attendance_request"));
  });

  it("courtesy credit remains manager-chosen, not an automatic amount", () => {
    const actions = read("src/components/dashboard/management-study-hall-actions.tsx");
    assert.match(actions, /Courtesy account credit/);
    assert.match(actions, /study_hall_guide_coverage/);
    assert.doesNotMatch(actions, /compCreditCents:\s*2500|hardcode.*credit/i);
    assert.equal(isCoverageCancellationReason(COVERAGE_CANCEL_REASON), true);
  });
});

describe("Guide attendance confirmation — architecture contracts", () => {
  it("parents cannot currently book inside the T-30 window", () => {
    const cfg = read("src/lib/booking-config.ts");
    assert.match(cfg, /MIN_BOOKING_NOTICE_MINUTES = 120/);
  });

  it("persists assignment-scoped confirmation and does not auto-cancel at T-20", () => {
    const sql = read("supabase/migrations/0034_guide_pre_session_confirmation.sql");
    assert.match(sql, /guide_attendance_assignments/);
    assert.match(sql, /confirm_guide_attendance/);
    assert.match(sql, /sweep_guide_attendance/);
    assert.match(sql, /source/);
    assert.match(sql, /replacement/);
    assert.match(sql, /for update/i);
    assert.match(sql, /idempotent|already/);
    assert.doesNotMatch(sql, /admin_release_booking\(/);
    assert.doesNotMatch(sql, /status = 'cancelled'/);
    const cron = read("src/app/api/cron/guide-attendance/route.ts");
    assert.match(cron, /sweep_guide_attendance/);
    assert.match(cron, /notifyGuideConfirmationMissed/);
    assert.doesNotMatch(cron, /admin_release_booking|cancel/);
  });

  it("Guide Portal surfaces confirmation without redesigning Home", () => {
    const next = read("src/components/dashboard/guide-next-study-hall.tsx");
    assert.match(next, /Attendance confirmation required/);
    assert.match(next, /GuideConfirmAttendance/);
    assert.match(next, /I'll be there|GuideConfirmAttendance/);
    assert.match(next, /Attendance confirmed/);
    assert.match(next, /Join Study Hall/);
    const halls = read("src/components/dashboard/guide-study-halls.tsx");
    assert.match(halls, /guideAttendanceRowLabel/);
    const home = read("src/app/dashboard/tutor/page.tsx");
    assert.doesNotMatch(home, /guideHomeVisualFixture/);
  });

  it("Management shows missed confirmation in Needs Attention without a redesign", () => {
    const ops = read("src/lib/management-ops.mjs");
    assert.match(ops, /guide_confirm_missed/);
    assert.match(ops, /guide_confirm_awaiting/);
    const detail = read("src/app/dashboard/admin/study-halls/[bookingId]/page.tsx");
    assert.match(detail, /guide_confirm_missed/);
    assert.match(detail, /coverageCancel/);
    const overview = read("src/components/dashboard/management-overview.tsx");
    assert.doesNotMatch(overview, /casino|flashing|animate-ping/);
  });

  it("does not invent Stripe refunds or change join-window / pricing / compensation", () => {
    const sql = read("supabase/migrations/0034_guide_pre_session_confirmation.sql");
    assert.doesNotMatch(sql, /stripe|refunds\.create|comp_rate/i);
    const admin = read("src/app/api/admin/booking/route.ts");
    assert.match(admin, /admin_release_booking/);
    assert.match(admin, /notifyCoverageCancellation/);
    assert.match(read("src/lib/session-window.mjs"), /JOIN_OPEN_LEAD_MIN = 5/);
    assert.doesNotMatch(read("src/lib/booking-config.ts"), /MIN_BOOKING_NOTICE_MINUTES = 30/);
  });

  it("notification failure cannot mark the Guide confirmed", () => {
    const cron = read("src/app/api/cron/guide-attendance/route.ts");
    assert.match(cron, /delivery failure must not change attendance state/);
    const api = read("src/app/api/tutor/attendance-confirm/route.ts");
    assert.match(api, /confirm_guide_attendance/);
    assert.doesNotMatch(api, /notifyGuideAttendanceRequest/);
  });

  it("does not rewrite Parent Home, marketing, or Guide workstation chrome", () => {
    assert.doesNotMatch(read("src/app/dashboard/student/page.tsx"), /confirm_guide_attendance|I'll be there/);
    assert.doesNotMatch(read("src/app/(marketing)/page.tsx"), /guide_attendance|I'll be there/);
    assert.doesNotMatch(read("src/components/dashboard/guide-shell.tsx"), /Attendance confirmation required/);
    assert.doesNotMatch(read("src/components/dashboard/management-shell.tsx"), /Attendance confirmation required/);
  });

  it("visual-review fixtures stay gated and unused by production pages", () => {
    assert.doesNotMatch(read("src/app/dashboard/tutor/page.tsx"), /guideHomeVisualFixture|visual-review/);
    assert.doesNotMatch(read("src/app/dashboard/admin/page.tsx"), /managementHomeVisualFixture|visual-review/);
    assert.match(read("src/app/dashboard/tutor/visual-review/page.tsx"), /GUIDE_HOME_VISUAL_REVIEW/);
    assert.match(read("src/app/dashboard/admin/visual-review/page.tsx"), /MANAGEMENT_VISUAL_REVIEW/);
    assert.match(read("src/lib/guide-home-visual-fixture.mjs"), /scene === "required"/);
    assert.match(read("src/lib/management-visual-fixture.mjs"), /scene === "missed"/);
  });
});
