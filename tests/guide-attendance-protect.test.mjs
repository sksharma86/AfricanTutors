import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { coverageFailureProtection } from "../src/lib/email/templates.mjs";
import {
  complimentaryHourReference,
  COMPLIMENTARY_RECOVERY_MINUTES,
  CRITICAL_LEAD_MIN,
  PROTECT_LEAD_MIN,
  confirmBlockResult,
  confirmationBlocks,
  criticalNotifyKey,
  groupManagementCoverageIssues,
  hasCurrentConfirmedCoverage,
  isAtCriticalWindow,
  isAtProtectWindow,
  managementAttendanceIssue,
  protectNotifyKey,
  shouldProtectCustomer,
} from "../src/lib/guide-attendance.mjs";
import { collectNeedsAttention, presentNeedsAttention } from "../src/lib/management-ops.mjs";
import { CHANNEL_POLICY } from "../src/lib/notifications/events.mjs";
import { parentCoverageFailureProtectionSms, parentSessionReminderSms } from "../src/lib/notifications/sms-copy.mjs";
import { parentStudyHallLists } from "../src/lib/parent-portal.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const t = (h, m = 0) => `2026-08-30T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
const hall = (id, start, extra = {}) => ({
  id,
  status: extra.status ?? "confirmed",
  tutor_id: extra.tutor_id ?? "guide-a",
  tutor_display_name: extra.name ?? "Sarah M.",
  scheduled_start: start,
  scheduled_end: extra.end ?? t(Number(start.slice(11, 13)) + 1, Number(start.slice(14, 16))),
  student_first_name: extra.child ?? "Jordan",
  ...extra,
});

const six = hall("b6", t(18), { child: "Jordan" });
const seven = hall("b7", t(19), { child: "Maya" });
const eight = hall("b8", t(20), { child: "Ethan" });
const nine = hall("b9", t(21), { child: "Ava" });

describe("T-10 / T-2 customer protection policy", () => {
  it("confirmed Guide at T-10 does not create critical state", () => {
    const nowMs = Date.parse(t(17, 52));
    assert.equal(isAtCriticalWindow(six.scheduled_start, nowMs), true);
    const issue = managementAttendanceIssue({
      booking: six,
      assignment: { status: "confirmed", tutor_id: "guide-a" },
      nowMs,
    });
    assert.equal(issue, null);
    assert.equal(hasCurrentConfirmedCoverage(six, { status: "confirmed", tutor_id: "guide-a" }), true);
  });

  it("unconfirmed current Guide at T-10 creates critical state", () => {
    const nowMs = Date.parse(t(17, 50));
    const issue = managementAttendanceIssue({
      booking: six,
      assignment: { status: "missed", tutor_id: "guide-a" },
      nowMs,
    });
    assert.equal(issue.kind, "guide_confirm_critical");
    assert.match(issue.title, /OPERATIONAL EMERGENCY|Critical coverage failure/i);
    assert.equal(issue.action, "Reassign now");
    assert.equal(issue.severity, "critical");
  });

  it("historical confirmation from a reassigned Guide does not satisfy current coverage", () => {
    const nowMs = Date.parse(t(17, 50));
    assert.equal(
      hasCurrentConfirmedCoverage({ ...six, tutor_id: "guide-b" }, { status: "confirmed", tutor_id: "guide-a" }),
      false,
    );
    const issue = managementAttendanceIssue({
      booking: { ...six, tutor_id: "guide-b", tutor_display_name: "James O." },
      assignment: { status: "awaiting", tutor_id: "guide-b", source: "replacement" },
      nowMs,
    });
    assert.equal(issue.kind, "guide_confirm_critical");
  });

  it("replacement confirmation resolves critical state and does not stay stale", () => {
    const nowMs = Date.parse(t(17, 53));
    const issue = managementAttendanceIssue({
      booking: { ...six, tutor_id: "guide-b", tutor_display_name: "James O." },
      assignment: { status: "confirmed", tutor_id: "guide-b", source: "replacement" },
      nowMs,
    });
    assert.equal(issue, null);
    assert.equal(hasCurrentConfirmedCoverage({ ...six, tutor_id: "guide-b" }, { status: "confirmed", tutor_id: "guide-b" }), true);
  });

  it("confirmed current Guide at T-2 prevents cancellation", () => {
    const nowMs = Date.parse(t(17, 58));
    assert.equal(isAtProtectWindow(six.scheduled_start, nowMs), true);
    const gate = shouldProtectCustomer({
      booking: six,
      assignment: { status: "confirmed", tutor_id: "guide-a" },
      nowMs,
    });
    assert.equal(gate.ok, false);
    assert.equal(gate.reason, "covered");
  });

  it("unconfirmed current Guide at T-2 triggers customer protection", () => {
    const nowMs = Date.parse(t(17, 58));
    const gate = shouldProtectCustomer({
      booking: six,
      assignment: { status: "missed", tutor_id: "guide-a" },
      nowMs,
    });
    assert.equal(gate.ok, true);
  });

  it("already-cancelled protection is idempotent", () => {
    const nowMs = Date.parse(t(17, 58));
    const gate = shouldProtectCustomer({
      booking: { ...six, status: "cancelled" },
      assignment: { status: "missed", resolution: "customer_protected" },
      nowMs,
    });
    assert.equal(gate.ok, false);
    assert.equal(gate.reason, "already_cancelled");
    assert.equal(gate.idempotent, true);
  });

  it("complimentary hour is one service-recovery hour, not purchased revenue", () => {
    assert.equal(COMPLIMENTARY_RECOVERY_MINUTES, 60);
    assert.equal(complimentaryHourReference("b6"), "comp-hour:b6");
    const sql = read("supabase/migrations/0034_guide_pre_session_confirmation.sql");
    assert.match(sql, /comp-hour:' \|\| p_booking/);
    assert.match(sql, /admin_adjustment/);
    assert.match(sql, /complimentary service-recovery hour/);
    assert.doesNotMatch(sql.slice(sql.indexOf("protect_unconfirmed_booking"), sql.indexOf("protect_unconfirmed_booking") + 2500), /entry_type, 'purchase'|try_full_earning/);
  });

  it("parent notification copy is accountable and does not blame the Guide", () => {
    const mail = coverageFailureProtection({
      restorationLine: "Your booking has been fully restored.",
      appUrl: "https://example.com",
    });
    assert.match(mail.subject, /couldn't provide your Guide/i);
    assert.match(mail.text, /weren't able to confirm Guide coverage/);
    assert.match(mail.text, /complimentary Study Hall hour/);
    assert.doesNotMatch(mail.text, /Guide failed|staffing crisis|unsafe/i);
    const sms = parentCoverageFailureProtectionSms();
    assert.match(sms, /complimentary hour/);
    assert.equal(protectNotifyKey("b6"), "coverage-protect:b6");
    assert.equal(criticalNotifyKey("b6"), "guide-critical-coverage:b6");
  });

  it("customer-protected Management card and Parent Home drop cancelled Next Study Hall", () => {
    const nowMs = Date.parse(t(17, 59));
    const issue = managementAttendanceIssue({
      booking: { ...six, status: "cancelled" },
      assignment: { status: "missed", tutor_id: "guide-a", resolution: "customer_protected", customer_protected_at: t(17, 58) },
      nowMs,
    });
    assert.equal(issue.kind, "guide_customer_protected");
    assert.match(issue.summary, /complimentary hour/i);
    const lists = parentStudyHallLists([
      { ...six, status: "cancelled" },
      { ...seven, status: "confirmed" },
    ]);
    assert.equal(lists.next?.id, "b7");
    assert.equal(lists.cancelled.some((b) => b.id === "b6"), true);
  });

  it("wrong Guide is not attributed; current assignment owns the impact", () => {
    const nowMs = Date.parse(t(17, 58));
    const gate = shouldProtectCustomer({
      booking: { ...six, tutor_id: "guide-b" },
      assignment: { status: "awaiting", tutor_id: "guide-b", source: "replacement" },
      nowMs,
    });
    assert.equal(gate.ok, true);
    assert.equal(
      hasCurrentConfirmedCoverage({ ...six, tutor_id: "guide-b" }, { status: "confirmed", tutor_id: "guide-a" }),
      false,
    );
  });

  it("four-session missed block does not cancel later halls at the first T-2", () => {
    const nowMs = Date.parse(t(17, 58));
    assert.equal(shouldProtectCustomer({ booking: six, assignment: { status: "missed", tutor_id: "guide-a" }, nowMs }).ok, true);
    assert.equal(shouldProtectCustomer({ booking: seven, assignment: { status: "missed", tutor_id: "guide-a" }, nowMs }).ok, false);
    assert.equal(shouldProtectCustomer({ booking: eight, assignment: { status: "confirmed", tutor_id: "guide-c" }, nowMs }).ok, false);
    assert.equal(shouldProtectCustomer({ booking: nine, assignment: { status: "missed", tutor_id: "guide-a" }, nowMs }).ok, false);
    assert.equal(confirmationBlocks([six, seven, eight, nine])[0].length, 4);
  });

  it("each booking has its own T-10 and T-2 boundary", () => {
    assert.equal(CRITICAL_LEAD_MIN, 10);
    assert.equal(PROTECT_LEAD_MIN, 2);
    assert.equal(isAtCriticalWindow(six.scheduled_start, Date.parse(t(17, 50))), true);
    assert.equal(isAtCriticalWindow(nine.scheduled_start, Date.parse(t(17, 50))), false);
    assert.equal(isAtProtectWindow(nine.scheduled_start, Date.parse(t(20, 58))), true);
    const t10First = managementAttendanceIssue({
      booking: six,
      assignment: { status: "missed", tutor_id: "guide-a" },
      nowMs: Date.parse(t(17, 50)),
    });
    const t10Last = managementAttendanceIssue({
      booking: nine,
      assignment: { status: "missed", tutor_id: "guide-a" },
      nowMs: Date.parse(t(17, 50)),
    });
    assert.equal(t10First.kind, "guide_confirm_critical");
    assert.equal(t10Last.kind, "guide_confirm_missed");
  });

  it("resolved later block member proceeds; unresolved later member protects at its own T-2", () => {
    const late = Date.parse(t(20, 58));
    assert.equal(
      shouldProtectCustomer({
        booking: { ...eight, tutor_id: "guide-c" },
        assignment: { status: "confirmed", tutor_id: "guide-c" },
        nowMs: late,
      }).ok,
      false,
    );
    assert.equal(
      shouldProtectCustomer({
        booking: nine,
        assignment: { status: "missed", tutor_id: "guide-a" },
        nowMs: late,
      }).ok,
      true,
    );
  });

  it("Management groups T-20 misses but keeps T-10 critical booking-specific", () => {
    const nowMs = Date.parse(t(17, 50));
    const bookings = [six, seven, eight, nine];
    const items = bookings.map((b) => {
      const issue = managementAttendanceIssue({
        booking: b,
        assignment: { status: "missed", tutor_id: "guide-a" },
        nowMs,
      });
      return { ...issue, bookingId: b.id };
    });
    const grouped = groupManagementCoverageIssues(items, bookings);
    const critical = grouped.filter((i) => i.kind === "guide_confirm_critical");
    const missed = grouped.filter((i) => i.kind === "guide_confirm_missed");
    assert.equal(critical.length, 1);
    assert.equal(critical[0].bookingId, "b6");
    assert.equal(missed.length, 1);
    assert.equal(missed[0].issueCount, 3);
    const presented = presentNeedsAttention(
      collectNeedsAttention({
        bookings,
        attendanceByBooking: Object.fromEntries(bookings.map((b) => [b.id, { status: "missed", tutor_id: "guide-a" }])),
        nowMs,
      }),
    );
    assert.ok(presented.some((p) => /OPERATIONAL EMERGENCY|Critical coverage failure/i.test(p.title)));
  });

  it("confirm-at-T-2 and reassign-at-T-2 races resolve from CURRENT coverage", () => {
    const nowMs = Date.parse(t(17, 58));
    assert.equal(
      confirmBlockResult({
        bookings: [six],
        actorId: "guide-a",
        assignmentsByBooking: { b6: { status: "awaiting", tutor_id: "guide-a", deadline_at: t(17, 40) } },
        nowMs,
      }).confirmed.length,
      0,
    );
    assert.equal(
      shouldProtectCustomer({
        booking: { ...six, tutor_id: "guide-b" },
        assignment: { status: "awaiting", tutor_id: "guide-b", source: "replacement" },
        nowMs,
      }).ok,
      true,
    );
    assert.equal(
      shouldProtectCustomer({
        booking: { ...six, status: "cancelled" },
        nowMs,
      }).reason,
      "already_cancelled",
    );
  });

  it("T-2 architecture is idempotent and T-20 still does not cancel", () => {
    const sql = read("supabase/migrations/0034_guide_pre_session_confirmation.sql");
    assert.match(sql, /protect_unconfirmed_booking/);
    assert.match(sql, /customer_protected/);
    assert.match(sql, /interval '10 minutes'/);
    assert.match(sql, /interval '2 minutes'/);
    assert.match(sql, /on conflict \(reference\) do nothing/);
    const cron = read("src/app/api/cron/guide-attendance/route.ts");
    assert.match(cron, /protect_unconfirmed_booking/);
    assert.match(cron, /notifyCoverageFailureProtection/);
    assert.match(cron, /criticalNotifyKey/);
    assert.doesNotMatch(cron, /sendGuideWhatsApp/);
    assert.ok(CHANNEL_POLICY.email.includes("coverage_failure_protection"));
    assert.ok(CHANNEL_POLICY.sms.includes("coverage_failure_protection"));
    assert.ok(!CHANNEL_POLICY.whatsapp.includes("coverage_failure_protection"));
    assert.ok(CHANNEL_POLICY.sms.includes("session_reminder_1h"));
    const sms = parentSessionReminderSms({ studentName: "Jordan", whenISO: t(18), tz: "America/Chicago" });
    assert.match(sms, /Jordan's Study Hall/);
  });

  it("free-trial failure does not consume the trial; protect cancels the booking", () => {
    const sql = read("supabase/migrations/0034_guide_pre_session_confirmation.sql");
    const protect = sql.slice(sql.indexOf("protect_unconfirmed_booking"));
    assert.match(protect, /is_free_trial/);
    assert.match(protect, /status = 'cancelled'/);
    assert.doesNotMatch(protect, /is_free_trial = false|consumed/);
    const trial = read("supabase/migrations/0019_phase8_free_trial_per_account.sql");
    assert.match(trial, /status <> 'cancelled'/);
  });
});
