import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  CALL_PARENT_PROMPT_MIN,
  CUSTOMER_NO_SHOW_WAIT_MIN,
  customerNoShowEligibleAt,
  customerNoShowGuideCopy,
  customerNoShowUiState,
} from "../src/lib/guide-customer-no-show.mjs";
import {
  GUIDE_METHOD_PHASES,
  NOTHING_TO_DO_LADDER,
  guideMethodCopy,
  guideMethodPhase,
} from "../src/lib/guide-operating-method.mjs";
import { GUIDE_PORTAL_NAV, guideNeedsReport, guideRowStatus } from "../src/lib/guide-portal.mjs";
import { managementCustomerNoShowRecord, managementOperationalStatus } from "../src/lib/management-ops.mjs";
import { parentWeekDayKind, parentWeekDayLabel } from "../src/lib/parent-week.mjs";
import { customerBookingStatus } from "../src/lib/status-labels.mjs";
import { joinMustWithholdToken, joinPresenceRpcName } from "../src/lib/http-session-join.mjs";
import { JOIN_OPEN_LEAD_MIN, JOIN_CLOSE_GRACE_MIN } from "../src/lib/session-window.mjs";
import { guideJoinUiState } from "../src/lib/tutor-schedule.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const START = "2026-09-08T18:00:00.000Z";
const END = "2026-09-08T19:00:00.000Z";
const START_MS = Date.parse(START);

describe("PR6 — Plan → Focus → Finish and nothing-to-do", () => {
  it("1. Plan → Focus → Finish is visible on Home and in the session room", () => {
    const method = read("src/lib/guide-operating-method.mjs");
    const home = read("src/components/dashboard/guide-guidance.tsx");
    const room = read("src/components/session/session-room.tsx");
    assert.deepEqual(
      GUIDE_METHOD_PHASES.map((p) => p.title),
      ["Plan", "Focus", "Finish"],
    );
    assert.match(method, /What are you working on today/);
    assert.match(method, /Stay on task/);
    assert.match(method, /What was completed/);
    assert.match(home, /GuideOperatingMethod/);
    assert.match(room, /GuideOperatingMethod/);
    assert.equal(guideMethodPhase(START, END, START_MS + 2 * 60000), "plan");
    assert.equal(guideMethodPhase(START, END, START_MS + 25 * 60000), "focus");
    assert.equal(guideMethodPhase(START, END, START_MS + 55 * 60000), "finish");
  });

  it("2. nothing-to-do ladder is visible in the required order", () => {
    assert.equal(NOTHING_TO_DO_LADDER.length, 3);
    assert.match(NOTHING_TO_DO_LADDER[0].items.join(" "), /School portal/);
    assert.match(NOTHING_TO_DO_LADDER[1].items.join(" "), /Review notes/);
    assert.match(NOTHING_TO_DO_LADDER[2].items.join(" "), /quiet, productive study activity/);
    const ui = read("src/components/dashboard/guide-operating-method.tsx");
    assert.match(ui, /If they say there is no homework/);
    assert.match(ui, /NOTHING_TO_DO_LADDER/);
  });

  it("3. does not imply tutoring or subject matching", () => {
    const copy = guideMethodCopy();
    assert.match(copy.role, /not tutoring/);
    assert.doesNotMatch(copy.role, /teach the lesson|answer the homework|subject match/i);
    const blob =
      read("src/lib/guide-operating-method.mjs") + read("src/components/dashboard/guide-operating-method.tsx");
    assert.match(blob, /Do not tutor, teach lessons, or give homework answers/);
    assert.doesNotMatch(blob, /subject-matching|answer this worksheet for them/i);
    assert.match(copy.stay, /not a reason to end early/);
  });

  it("4. normal completed session still requires the existing Guide report", () => {
    assert.equal(
      guideNeedsReport({ status: "completed", scheduled_start: START, scheduled_end: END }, false, Date.parse(END) + 1000),
      true,
    );
    assert.equal(
      guideNeedsReport({ status: "no_show", scheduled_start: START, scheduled_end: END }, false, Date.parse(END) + 1000),
      false,
    );
    const report = read("src/app/dashboard/tutor/study-halls/[bookingId]/report/page.tsx");
    assert.match(report, /GuideSessionReport/);
    assert.match(report, /status === "no_show"/);
    assert.match(report, /does not need a completion report/);
  });
});

describe("PR6 — customer no-show UI and authorization contract", () => {
  it("5-7. cannot mark before T+15; can after; client clock is display-only", () => {
    assert.equal(CUSTOMER_NO_SHOW_WAIT_MIN, 15);
    assert.equal(CALL_PARENT_PROMPT_MIN, 3);
    assert.equal(customerNoShowEligibleAt(START), "2026-09-08T18:15:00.000Z");
    const waiting = customerNoShowUiState({
      status: "confirmed",
      scheduledStart: START,
      nowMs: START_MS + 10 * 60000,
    });
    assert.equal(waiting.kind, "waiting");
    const eligible = customerNoShowUiState({
      status: "confirmed",
      scheduledStart: START,
      nowMs: START_MS + 15 * 60000,
    });
    assert.equal(eligible.kind, "eligible");
    const sql = read("supabase/migrations/0043_guide_customer_no_show.sql");
    assert.match(sql, /now\(\) < v_bk\.scheduled_start \+ interval '15 minutes'/);
    assert.match(sql, /auth\.uid\(\)/);
    assert.doesNotMatch(sql, /p_now|p_client_time|browser/);
  });

  it("8-12. wrong Guide / unrelated / cancelled / completed / awaiting payment are ineligible in UI helpers", () => {
    assert.equal(customerNoShowUiState({ status: "cancelled", scheduledStart: START, nowMs: START_MS + 20 * 60000 }).kind, "cancelled");
    assert.equal(customerNoShowUiState({ status: "completed", scheduledStart: START, nowMs: START_MS + 20 * 60000 }).kind, "completed");
    assert.equal(
      customerNoShowUiState({
        status: "confirmed",
        scheduledStart: START,
        paymentStatus: "awaiting_payment",
        nowMs: START_MS + 20 * 60000,
      }).kind,
      "awaiting_payment",
    );
    assert.equal(customerNoShowUiState({ status: "pending", scheduledStart: START, nowMs: START_MS + 20 * 60000 }).kind, "ineligible");
    const sql = read("supabase/migrations/0043_guide_customer_no_show.sql");
    assert.match(sql, /tutor_id is distinct from v_uid/);
    assert.match(sql, /This Study Hall was cancelled/);
    assert.match(sql, /already completed/);
    assert.match(sql, /awaiting payment/);
  });

  it("13. already no_show is a recorded / idempotent UI state", () => {
    assert.equal(customerNoShowUiState({ status: "no_show", scheduledStart: START, nowMs: START_MS + 20 * 60000 }).kind, "recorded");
    const sql = read("supabase/migrations/0043_guide_customer_no_show.sql");
    assert.match(sql, /idempotent', true/);
    assert.match(sql, /on conflict \(booking_id\) do nothing/);
  });

  it("14. parent joined presence blocks no-show in the UI and SQL", () => {
    const joined = customerNoShowUiState({
      status: "confirmed",
      scheduledStart: START,
      studentJoinedAt: "2026-09-08T18:14:00.000Z",
      nowMs: START_MS + 20 * 60000,
    });
    assert.equal(joined.kind, "child_joined");
    const sql = read("supabase/migrations/0043_guide_customer_no_show.sql");
    assert.match(sql, /student_first_joined_at/);
    assert.match(sql, /The child has already joined this Study Hall/);
    assert.match(sql, /for update/);
  });

  it("Call Parent stays privacy-safe and does not block later no-show", () => {
    const ctrl = read("src/components/session/call-parent-control.tsx");
    const panel = read("src/components/session/guide-customer-no-show-control.tsx");
    assert.match(ctrl, /You will not see their number/);
    assert.doesNotMatch(ctrl, /phone_e164|parent_phone/);
    assert.match(panel, /missing number does not block/);
    assert.match(panel, /Mark customer no-show/);
    assert.equal(customerNoShowUiState({ status: "confirmed", scheduledStart: START, nowMs: START_MS + 4 * 60000 }).callParentPrompt, true);
  });

  it("join window is unchanged: T−5 open, close 15 minutes after end", () => {
    assert.equal(JOIN_OPEN_LEAD_MIN, 5);
    assert.equal(JOIN_CLOSE_GRACE_MIN, 15);
    assert.equal(guideJoinUiState("confirmed", START, END, START_MS - 6 * 60000).kind, "opens_at");
    assert.equal(guideJoinUiState("confirmed", START, END, START_MS - 5 * 60000).kind, "join");
  });
});

describe("PR6 — parent, management, earnings, nav", () => {
  it("24-25. no-show does not require a report; completed still does", () => {
    assert.equal(guideNeedsReport({ status: "no_show" }, false, START_MS + 2 * 3600000), false);
    assert.equal(guideNeedsReport({ status: "completed" }, false, START_MS + 2 * 3600000), true);
    assert.equal(guideRowStatus({ status: "no_show", scheduled_start: START, scheduled_end: END }, START_MS + 2 * 3600000), "Customer no-show");
  });

  it("26-28. parent no-show is Missed Study Hall, not Completed or empty", () => {
    assert.deepEqual(customerBookingStatus("no_show"), { label: "Missed Study Hall", tone: "neutral" });
    const missed = parentWeekDayKind([{ status: "no_show", scheduled_start: START, scheduled_end: END }]);
    assert.equal(missed, "missed");
    assert.notEqual(missed, "completed");
    assert.notEqual(missed, "none");
    assert.equal(parentWeekDayLabel("missed"), "MISSED STUDY HALL");
    assert.equal(parentWeekDayLabel("missed", { compact: true }), "Missed");
    assert.match(customerNoShowGuideCopy("recorded") ?? "", /No session report/);
  });

  it("29. management can identify a customer no-show and its mechanical result", () => {
    const rec = managementCustomerNoShowRecord(
      { status: "no_show" },
      { earning: { status: "earned" }, escalations: [{ status: "sms_sent" }] },
    );
    assert.equal(rec?.title, "Customer no-show");
    assert.equal(rec?.guidePay, "full_pay");
    assert.equal(rec?.funding, "consumed");
    assert.equal(rec?.callParentAttempted, true);
    assert.equal(managementOperationalStatus({ status: "no_show" }), "completed");
    const detail = read("src/app/dashboard/admin/study-halls/[bookingId]/page.tsx");
    assert.match(detail, /managementCustomerNoShowRecord/);
    assert.match(detail, /Consumed — not restored/);
  });

  it("SQL reuses no_show, full pay, and never restores funding", () => {
    const sql = read("supabase/migrations/0043_guide_customer_no_show.sql");
    assert.match(sql, /set status = 'no_show'/);
    assert.match(sql, /try_full_earning/);
    assert.match(sql, /customer no-show — full tutor compensation/);
    assert.match(sql, /Does NOT call restore_booking_value/);
    assert.doesNotMatch(sql, /perform public\.restore_booking_value/);
    assert.match(sql, /revoke all on function public\.guide_mark_customer_no_show\(uuid\) from public/);
    assert.match(sql, /revoke all on function public\.guide_mark_customer_no_show\(uuid\) from anon/);
    assert.match(sql, /grant execute on function public\.guide_mark_customer_no_show\(uuid\) to authenticated, service_role/);
    assert.match(sql, /security definer/);
    assert.match(sql, /set search_path = public/);
    assert.match(sql, /0043/);
  });

  it("36-38. Guide nav, availability, and assignment files are not rewritten", () => {
    assert.deepEqual(
      GUIDE_PORTAL_NAV.map((i) => i.label),
      ["Home", "Study Halls", "Availability", "Earnings"],
    );
    const m43 = read("supabase/migrations/0043_guide_customer_no_show.sql");
    assert.doesNotMatch(sqlSafe(m43), /tutor_availability|try_auto_reassign|book_session|plan_my_week/);
  });
});

describe("PR6 — source regressions", () => {
  it("API is assigned-Guide only and does not trust client time", () => {
    const api = read("src/app/api/tutor/customer-no-show/route.ts");
    assert.match(api, /guide_mark_customer_no_show/);
    assert.match(api, /Not authenticated/);
    assert.doesNotMatch(api, /eligibleAt|clientNow|Date\.now\(\)/);
  });

  it("Guide Home still dominates with Next Study Hall", () => {
    const next = read("src/components/dashboard/guide-next-study-hall.tsx");
    assert.match(next, /Next Study Hall/);
    assert.match(next, /GuideCustomerNoShowControl/);
    assert.doesNotMatch(next, /Book a Study Hall|Prepaid Hours/);
  });

  it("does not add PR7 notification campaigns or PR8 payment gauntlets", () => {
    const m43 = read("supabase/migrations/0043_guide_customer_no_show.sql");
    assert.doesNotMatch(m43, /weekly planning|report-ready|recording-ready|marketing notification/i);
    assert.doesNotMatch(m43, /stripe|webhook replay/i);
  });
});

describe("PR6 — HTTP join vs no-show race gate", () => {
  it("D. joinSession inspects { data, error } and withholds the token on RPC failure", () => {
    const service = read("src/lib/session-service.ts");
    assert.match(service, /joinMustWithholdToken/);
    assert.match(service, /joinPresenceRpcName/);
    assert.match(service, /finalize_http_session_join|joinPresenceRpcName\(\)/);
    assert.match(service, /throw new SessionError\("not_joinable"\)/);
    const joinBody = service.slice(service.indexOf("export async function joinSession"));
    const returnIdx = joinBody.indexOf("return {");
    const withholdIdx = joinBody.indexOf("joinMustWithholdToken");
    assert.ok(withholdIdx >= 0 && returnIdx > withholdIdx, "token return is after the presence gate");
    assert.doesNotMatch(joinBody.slice(0, returnIdx), /await service\.rpc\("record_session_presence"/);
    assert.match(read("src/app/api/session/[bookingId]/join/route.ts"), /not_joinable: 409/);
  });

  it("D. supabase-js error object withholds the token; ok:true does not", () => {
    assert.equal(joinPresenceRpcName(), "finalize_http_session_join");
    assert.equal(joinMustWithholdToken({ error: { message: "This Study Hall is not joinable" } }), true);
    assert.equal(joinMustWithholdToken({ data: null, error: { message: "not joinable" } }), true);
    assert.equal(joinMustWithholdToken({ data: { ok: false } }), true);
    assert.equal(joinMustWithholdToken({ data: {} }), true);
    assert.equal(joinMustWithholdToken(null), true);
    assert.equal(joinMustWithholdToken({ data: { ok: true, status: "confirmed" }, error: null }), false);
  });

  it("C. impossible outcome is no_show plus a returned student token", () => {
    assert.equal(
      joinMustWithholdToken({ error: { message: "This Study Hall is not joinable" }, data: null }),
      true,
    );
    const sql = read("supabase/migrations/0043_guide_customer_no_show.sql");
    assert.match(sql, /finalize_http_session_join/);
    assert.match(sql, /This Study Hall is not joinable/);
    assert.match(sql, /v_bk\.status is distinct from 'confirmed'/);
    assert.match(sql, /from public\.bookings/);
    assert.match(sql, /for update/);
  });

  it("E. webhook still uses silent record_session_presence, not HTTP finalize", () => {
    const hook = read("src/app/api/daily/webhook/route.ts");
    assert.match(hook, /record_session_presence/);
    assert.doesNotMatch(hook, /finalize_http_session_join/);
    const sql = read("supabase/migrations/0043_guide_customer_no_show.sql");
    assert.match(sql, /if v_status is null or v_status not in \('pending', 'confirmed'\) then\s+return;/);
    assert.match(sql, /Webhooks must keep using record_session_presence/);
  });

  it("F. Guide room is not torn down on no-show", () => {
    const service = read("src/lib/session-service.ts");
    const sql = read("supabase/migrations/0043_guide_customer_no_show.sql");
    assert.doesNotMatch(service, /deleteRoom\(|kickFromRoom/);
    assert.doesNotMatch(sql, /deleteRoom|kickFromRoom/);
    assert.match(service, /unreturned token is inert/);
  });
});

function sqlSafe(sql) {
  return sql;
}
