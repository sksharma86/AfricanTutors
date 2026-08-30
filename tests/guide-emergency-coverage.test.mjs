import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";

import {
  ASSIGNMENT_SOURCES,
  hasCurrentConfirmedCoverage,
  managementAttendanceIssue,
  shouldProtectCustomer,
} from "../src/lib/guide-attendance.mjs";
import { CHANNEL_POLICY, NOTIFICATION_EVENTS } from "../src/lib/notifications/events.mjs";
import { reassignmentRecipients, reassignmentOutcome } from "../src/lib/notifications/reassignment-policy.mjs";
import { guideOpenCoverageWhatsApp, whatsappContainsSensitive, WA_TEMPLATES } from "../src/lib/notifications/whatsapp-copy.mjs";
import {
  canStartCoverageSearch,
  claimResultMessage,
  coverageSearchIssue,
  isEligibleEmergencyCandidate,
  isSafeOpenCoveragePath,
  mapClaimRpcReason,
  offerIsClaimable,
  openCoverageNotifyKey,
  openCoveragePath,
} from "../src/lib/open-coverage.mjs";
import { getWhatsAppConfig } from "../src/lib/telephony/whatsapp-config.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const START = "2026-08-30T18:00:00.000Z";
const startMs = Date.parse(START);
const t20 = startMs - 20 * 60_000;
const t10 = startMs - 10 * 60_000;
const t2 = startMs - 2 * 60_000;

const booking = {
  id: "b1",
  status: "confirmed",
  tutor_id: "guide-a",
  tutor_display_name: "Sarah M.",
  scheduled_start: START,
  scheduled_end: "2026-08-30T19:00:00.000Z",
  duration_minutes: 60,
};

const missed = {
  id: "a-miss",
  booking_id: "b1",
  tutor_id: "guide-a",
  source: "t30",
  status: "missed",
};

describe("Emergency replacement — policy", () => {
  it("T-20 missed confirmation can start one search cycle keyed to the assignment", () => {
    const r = canStartCoverageSearch({ booking, assignment: missed });
    assert.equal(r.ok, true);
    assert.equal(r.searchKey, "a-miss");
  });

  it("does not start search when coverage is already confirmed", () => {
    const r = canStartCoverageSearch({
      booking,
      assignment: { ...missed, status: "confirmed", tutor_id: "guide-a" },
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "covered");
  });

  it("excludes the current failed Guide and inactive/suspended/unavailable Guides", () => {
    assert.equal(
      isEligibleEmergencyCandidate({
        candidateId: "guide-a",
        currentTutorId: "guide-a",
        approved: true,
        timezone: "America/Chicago",
        available: true,
      }),
      false,
    );
    assert.equal(
      isEligibleEmergencyCandidate({
        candidateId: "guide-b",
        currentTutorId: "guide-a",
        approved: false,
        timezone: "America/Chicago",
        available: true,
      }),
      false,
    );
    assert.equal(
      isEligibleEmergencyCandidate({
        candidateId: "guide-b",
        currentTutorId: "guide-a",
        approved: true,
        role: "student",
        timezone: "America/Chicago",
        available: true,
      }),
      false,
    );
    assert.equal(
      isEligibleEmergencyCandidate({
        candidateId: "guide-b",
        currentTutorId: "guide-a",
        approved: true,
        timezone: "",
        available: true,
      }),
      false,
    );
    assert.equal(
      isEligibleEmergencyCandidate({
        candidateId: "guide-b",
        currentTutorId: "guide-a",
        approved: true,
        timezone: "America/Chicago",
        available: false,
      }),
      false,
    );
    assert.equal(
      isEligibleEmergencyCandidate({
        candidateId: "guide-b",
        currentTutorId: "guide-a",
        approved: true,
        timezone: "America/Chicago",
        available: true,
      }),
      true,
    );
  });

  it("one Guide gets one notify key per booking and search cycle", () => {
    const a = openCoverageNotifyKey({ bookingId: "b1", tutorId: "g2", searchKey: "a-miss" });
    const b = openCoverageNotifyKey({ bookingId: "b1", tutorId: "g2", searchKey: "a-miss" });
    const c = openCoverageNotifyKey({ bookingId: "b1", tutorId: "g3", searchKey: "a-miss" });
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.equal(a, "open-coverage:g2:b1:a-miss");
  });

  it("first valid claim wins; late claims read as already covered", () => {
    assert.equal(claimResultMessage("won"), "You've accepted this Study Hall.");
    assert.equal(claimResultMessage("already_covered"), "This Study Hall has already been covered.");
    assert.equal(mapClaimRpcReason("already_covered"), "already_covered");
    assert.equal(mapClaimRpcReason("overlap"), "overlap");
    assert.equal(mapClaimRpcReason("not_eligible"), "ineligible");
  });

  it("stale offers cannot be claimed after cancel, start, or close", () => {
    const offer = { status: "open" };
    assert.equal(offerIsClaimable(offer, { booking }).ok, true);
    assert.equal(offerIsClaimable({ status: "closed" }, { booking }).ok, false);
    assert.equal(offerIsClaimable(offer, { booking: { ...booking, status: "cancelled" } }).reason, "cancelled");
    assert.equal(offerIsClaimable(offer, { booking, nowMs: startMs }).reason, "expired");
  });

  it("acceptance confirms the winner and preserves the original miss", () => {
    const winner = { status: "confirmed", tutor_id: "guide-b", source: "emergency" };
    assert.equal(hasCurrentConfirmedCoverage({ ...booking, tutor_id: "guide-b" }, winner), true);
    assert.equal(hasCurrentConfirmedCoverage(booking, missed), false);
    assert.equal(ASSIGNMENT_SOURCES.includes("emergency"), true);
  });

  it("Management search copy appears only when eligible Guides were notified", () => {
    const plain = managementAttendanceIssue({ booking, assignment: missed, nowMs: t20 + 1 });
    assert.equal(plain.title, "Guide confirmation missed");
    const search = managementAttendanceIssue({
      booking,
      assignment: missed,
      nowMs: t20 + 1,
      offerCount: 8,
    });
    assert.equal(search.title, "Guide coverage unconfirmed");
    assert.match(search.summary, /Replacement search active/);
    assert.equal(search.detail, "8 eligible Guides notified");
    const issue = coverageSearchIssue({ offerCount: 8 });
    assert.equal(issue.detail, "8 eligible Guides notified");
  });

  it("successful claim clears the Management exception", () => {
    const winner = { status: "confirmed", tutor_id: "guide-b", source: "emergency" };
    assert.equal(
      managementAttendanceIssue({
        booking: { ...booking, tutor_id: "guide-b", tutor_display_name: "James M." },
        assignment: winner,
        nowMs: t20 + 1,
        offerCount: 8,
      }),
      null,
    );
  });

  it("T-10 critical remains if nobody accepts", () => {
    const issue = managementAttendanceIssue({ booking, assignment: missed, nowMs: t10, offerCount: 8 });
    assert.equal(issue.kind, "guide_confirm_critical");
    assert.equal(issue.title, "Critical coverage failure");
  });

  it("T-2 protection remains if nobody accepts; covered bookings skip it", () => {
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

  it("parent stays silent on successful internal replacement", () => {
    assert.equal(reassignmentOutcome(true), "successful_internal");
    const rec = reassignmentRecipients("successful_internal");
    assert.equal(rec.parentEmail, false);
    assert.equal(rec.parentSms, false);
    assert.ok(!CHANNEL_POLICY.sms.includes("guide_open_coverage"));
    assert.ok(!CHANNEL_POLICY.email.includes("guide_open_coverage"));
  });

  it("WhatsApp offer is private, timezone-labeled, and PII-safe", () => {
    const wa = guideOpenCoverageWhatsApp({
      startISO: START,
      endISO: booking.scheduled_end,
      tz: "America/Chicago",
      durationMinutes: 60,
      appUrl: "https://example.com",
      acceptPath: openCoveragePath("b1"),
    });
    assert.equal(wa.template, "guide_open_coverage_offer");
    assert.equal(WA_TEMPLATES.openCoverage, "guide_open_coverage_offer");
    assert.match(wa.body, /OPEN STUDY HALL/);
    assert.match(wa.body, /ACCEPT SESSION/);
    assert.match(wa.body, /CDT|CST|CT|GMT|UTC/);
    assert.match(wa.body, /60 minutes/);
    assert.match(wa.url, /\/dashboard\/tutor\/open-coverage\/b1/);
    assert.equal(whatsappContainsSensitive(wa.body), false);
    assert.doesNotMatch(wa.body, /parent|phone|\+|@|address|stripe|Sarah|James/i);
  });

  it("deep link is an authenticated portal path, not a privileged token", () => {
    assert.equal(openCoveragePath("b1"), "/dashboard/tutor/open-coverage/b1");
    assert.equal(isSafeOpenCoveragePath("/dashboard/tutor/open-coverage/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"), true);
    assert.equal(isSafeOpenCoveragePath("/dashboard/tutor?token=abc"), false);
    assert.equal(isSafeOpenCoveragePath("https://evil.example/dashboard/tutor/open-coverage/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"), false);
  });
});

describe("Emergency replacement — architecture", () => {
  const sql = read("supabase/migrations/0035_guide_emergency_coverage.sql");
  const cron = read("src/app/api/cron/guide-attendance/route.ts");
  const notify = read("src/lib/notify.ts");
  const claim = read("src/app/api/tutor/open-coverage/claim/route.ts");
  const page = read("src/app/dashboard/tutor/open-coverage/[bookingId]/page.tsx");

  it("adds 0035 without editing installed 0034", () => {
    const names = readdirSync(new URL("../supabase/migrations", import.meta.url)).filter((f) => f.endsWith(".sql"));
    assert.ok(names.includes("0035_guide_emergency_coverage.sql"));
    assert.ok(names.includes("0034_guide_pre_session_confirmation.sql"));
    const att34 = read("supabase/migrations/0034_guide_pre_session_confirmation.sql");
    assert.doesNotMatch(att34, /guide_open_coverage_offers|claim_open_coverage|emergency/);
    assert.match(sql, /source in \('t30', 'replacement', 'short_notice', 'emergency'\)/);
  });

  it("reuses 0026 eligibility instead of inventing a parallel engine", () => {
    assert.match(sql, /list_reassignment_candidates/);
    assert.match(sql, /tutor_profiles tp/);
    assert.match(sql, /tp.status = 'approved'/);
    assert.match(sql, /tutor_is_available\(/);
    assert.match(sql, /tp.profile_id is distinct from v_bk.tutor_id/);
    assert.doesNotMatch(sql, /try_auto_reassign_booking/);
    const matching = read("supabase/migrations/0026_studyhall_pr10d_auto_reassign.sql");
    assert.match(matching, /tutor_is_available\(/);
  });

  it("search is per booking, idempotent, and starts from the attendance cron after T-20 miss", () => {
    assert.match(cron, /open_emergency_coverage_search/);
    assert.match(cron, /notifyOpenCoverageOffer/);
    assert.match(cron, /search_key|p_search_key/);
    assert.match(sql, /unique \(booking_id, tutor_id, search_key\)/);
    assert.match(sql, /on conflict \(booking_id, tutor_id, search_key\) do nothing/);
    assert.match(notify, /openCoverageNotifyKey/);
    assert.match(notify, /type: "guide_open_coverage"/);
    assert.doesNotMatch(notify.slice(notify.indexOf("export async function notifyOpenCoverageOffer")), /deliverParentSms|coverage_cancellation/);
  });

  it("claim is atomic, revalidates eligibility, and confirms emergency attendance", () => {
    assert.match(sql, /for update/);
    assert.match(sql, /tutor_is_available\(/);
    assert.match(sql, /source = 'emergency'/);
    assert.match(sql, /status = 'confirmed'/);
    assert.match(sql, /exclusion_violation/);
    assert.match(sql, /already_covered/);
    assert.match(claim, /claim_open_coverage/);
    assert.match(claim, /This Study Hall has already been covered/);
    assert.doesNotMatch(claim, /I'll be there/);
    assert.doesNotMatch(page, /I'll be there/);
    assert.match(page, /requireRole\("tutor"/);
  });

  it("stale offers close on cancel, T-2 protection, and Management reassignment", () => {
    assert.match(sql, /sync_open_coverage_offers/);
    assert.match(sql, /booking_cancelled/);
    assert.match(sql, /coverage_restored/);
    assert.match(sql, /after update of tutor_id, status/);
    const protect = read("src/app/api/cron/guide-attendance/route.ts");
    assert.match(protect, /protect_unconfirmed_booking/);
  });

  it("does not introduce emergency bonus pay or Guide SMS", () => {
    assert.doesNotMatch(sql, /bonus|comp_rate|record_full_earning|emergency_pay/);
    assert.ok(CHANNEL_POLICY.whatsapp.includes("guide_open_coverage"));
    assert.ok(!CHANNEL_POLICY.sms.includes("guide_open_coverage"));
    assert.equal(NOTIFICATION_EVENTS.GUIDE_OPEN_COVERAGE, "guide_open_coverage");
    assert.match(read(".env.example"), /TWILIO_WA_CONTENT_SID_OPEN_COVERAGE/);
    process.env.TWILIO_WA_CONTENT_SID_OPEN_COVERAGE = "HXtest";
    assert.equal(getWhatsAppConfig().openCoverageContentSid, "HXtest");
    delete process.env.TWILIO_WA_CONTENT_SID_OPEN_COVERAGE;
  });

  it("v1 offers one booking at a time — no grouped ACCEPT ALL 3", () => {
    assert.doesNotMatch(sql, /accept_all|grouped_block|claim_open_coverage_block/);
    assert.doesNotMatch(page, /Accept all 3|ACCEPT ALL/);
    assert.doesNotMatch(read("src/lib/notifications/whatsapp-copy.mjs"), /ACCEPT ALL/);
  });

  it("visual-review fixtures stay gated and unused by production pages", () => {
    assert.doesNotMatch(read("src/app/dashboard/tutor/page.tsx"), /guideHomeVisualFixture|visual-review/);
    assert.doesNotMatch(read("src/app/dashboard/admin/page.tsx"), /managementHomeVisualFixture|visual-review/);
    assert.match(read("src/app/dashboard/tutor/visual-review/page.tsx"), /opencoverage|GUIDE_HOME_VISUAL_REVIEW/);
    assert.match(read("src/lib/management-visual-fixture.mjs"), /scene === "search"/);
    assert.match(read("src/lib/management-visual-fixture.mjs"), /scene === "restored"/);
  });

  it("login preserves only the open-coverage deep link", () => {
    const login = read("src/components/auth/login-form.tsx");
    assert.match(login, /isSafeOpenCoveragePath/);
    assert.match(login, /startsWith\("\/dashboard"\)/);
  });
});
