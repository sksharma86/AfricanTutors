import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";

import {
  PACKAGE_14H_MINUTES,
  PACKAGE_14H_PRICE_CENTS,
  PACKAGE_28H_MINUTES,
  PACKAGE_28H_PRICE_CENTS,
} from "../src/lib/packages.mjs";
import {
  FOCUS_LABELS,
  FOCUS_RATINGS,
  GUIDE_NOTE_MAX,
  REDIRECTION_LABELS,
  REDIRECTION_LEVELS,
  WORK_SUMMARY_MAX,
  isFocusRating,
  isRedirectionLevel,
} from "../src/lib/session-report.mjs";
import { JOIN_OPEN_LEAD_MIN } from "../src/lib/session-window.mjs";
import * as T from "../src/lib/email/templates.mjs";
import {
  adminClient,
  cleanupAll,
  createUser,
  hasSupabaseEnv,
  makeAdmin,
  signIn,
} from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Study Hall PR6 — session reports (source)", () => {
  it("migration 0023 defines session_reports schema, one-per-booking, and submit RPC", () => {
    const m = read("supabase/migrations/0023_studyhall_pr6_session_reports.sql");
    assert.match(m, /create table if not exists public\.session_reports/);
    assert.match(m, /booking_id\s+uuid not null unique/);
    assert.match(m, /focus_rating/);
    assert.match(m, /great_focus/);
    assert.match(m, /good_focus/);
    assert.match(m, /needed_redirection/);
    assert.match(m, /difficult_session/);
    assert.match(m, /work_summary/);
    assert.match(m, /redirection_level/);
    assert.match(m, /'none'|a_little|several_times/);
    assert.match(m, /guide_note/);
    assert.match(m, /submitted_at/);
    assert.match(m, /create or replace function public\.submit_session_report/);
    assert.match(m, /status is distinct from 'completed'/);
    assert.match(m, /A report has already been submitted/);
    assert.match(m, /enable row level security/);
    assert.match(m, /session_reports_select/);
    assert.match(m, /tutor_id = auth\.uid\(\)/);
    assert.match(m, /account_id = auth\.uid\(\)/);
    assert.match(m, /is_admin\(auth\.uid\(\)\)/);
    assert.match(m, /grant select on public\.session_reports to authenticated/);
    assert.match(m, /grant all on public\.session_reports to service_role/);
    assert.match(m, /grant execute on function public\.submit_session_report/);
    // No client write grants for authenticated
    assert.doesNotMatch(m, /grant insert on public\.session_reports to authenticated/i);
    assert.doesNotMatch(m, /grant update on public\.session_reports to authenticated/i);
    assert.doesNotMatch(m, /grant delete on public\.session_reports to authenticated/i);
  });

  it("report field constants match product copy", () => {
    assert.deepEqual([...FOCUS_RATINGS], [
      "great_focus",
      "good_focus",
      "needed_redirection",
      "difficult_session",
    ]);
    assert.equal(FOCUS_LABELS.great_focus, "Great focus");
    assert.equal(FOCUS_LABELS.needed_redirection, "Needed some redirection");
    assert.deepEqual([...REDIRECTION_LEVELS], ["none", "a_little", "several_times"]);
    assert.equal(REDIRECTION_LABELS.a_little, "A little");
    assert.equal(WORK_SUMMARY_MAX, 280);
    assert.equal(GUIDE_NOTE_MAX, 280);
    assert.equal(isFocusRating("great_focus"), true);
    assert.equal(isFocusRating("A+"), false);
    assert.equal(isRedirectionLevel("several_times"), true);
  });

  it("Guide workflow surfaces Complete report / Report submitted", () => {
    const page = read("src/app/dashboard/tutor/study-halls/[bookingId]/report/page.tsx");
    const form = read("src/components/dashboard/guide-session-report.tsx");
    const api = read("src/app/api/tutor/session-report/route.ts");
    assert.match(page, /GuideSessionReport/);
    assert.match(page, /Study Hall complete|Finish report|Complete report|Before you finish/);
    assert.match(form, /Complete report/);
    assert.match(form, /Report submitted/);
    assert.match(form, /What did they work on/);
    assert.match(form, /Note for parent \(optional\)/);
    assert.match(form, /not a grade/i);
    assert.match(api, /submit_session_report/);
    assert.match(api, /notifySessionReportReady/);
  });

  it("parent portal shows session reports (not grades / mastery)", () => {
    const page = read("src/app/dashboard/student/reports/page.tsx");
    const list = read("src/components/dashboard/session-reports-list.tsx");
    const detail = read("src/app/dashboard/student/study-halls/[bookingId]/page.tsx");
    const recap = read("src/components/dashboard/parent-session-recap.tsx");
    assert.match(page, /id="reports"/);
    assert.match(page, /not grades or academic assessments/i);
    assert.match(page, /Read report/);
    assert.match(list, /What they worked on|what they worked on/i);
    assert.match(list, /Focus|Redirection|Note from Guide/);
    assert.doesNotMatch(list, /grade point|mastery|tutoring results|academic diagnosis/i);
    assert.match(list, /max-w-|sm:|flex-col|rounded-2xl/);
    assert.match(detail, /ParentSessionRecap/);
    assert.match(recap, /Worked on/);
    assert.match(recap, /Guide note/);
  });

  it("reports are final on submission (no edit RPC / update policy)", () => {
    const m = read("supabase/migrations/0023_studyhall_pr6_session_reports.sql");
    assert.doesNotMatch(m, /update_session_report|edit_session_report/i);
    assert.doesNotMatch(m, /for update to authenticated/i);
    const form = read("src/components/dashboard/guide-session-report.tsx");
    assert.match(form, /Final on submit|alreadySubmitted|Report submitted/);
  });

  it("session-report-ready email fits Phase 6 template architecture", () => {
    const r = T.sessionReportReady({
      studentName: "Amara",
      whenISO: "2026-08-24T23:00:00.000Z",
      tz: "America/Chicago",
      appUrl: "https://app.example.test",
    });
    assert.match(r.subject, /Study Hall report is ready/i);
    assert.match(r.text, /Amara/);
    assert.match(r.text, /not a grade/i);
    assert.match(r.text, /#reports/);
    assert.doesNotMatch(r.html + r.text, /daily\.co|token=/i);
    const notify = read("src/lib/notify.ts");
    assert.match(notify, /notifySessionReportReady/);
    assert.match(notify, /session-report-ready:/);
  });

  it("PR2–PR5 invariants remain intact (pricing, free session, booking, T−5, Guide workspace)", () => {
    const pricing = read("src/lib/pricing.ts");
    assert.match(pricing, /PAYG_PRICE_USD = 12/);
    assert.match(pricing, /FREE_TRIAL_MINUTES = 60/);
    assert.match(pricing, /minutes:\s*60,\s*priceUsd:\s*12/);
    assert.match(pricing, /minutes:\s*120,\s*priceUsd:\s*24/);
    assert.match(pricing, /minutes:\s*180,\s*priceUsd:\s*36/);
    assert.equal(PACKAGE_14H_MINUTES, 840);
    assert.equal(PACKAGE_14H_PRICE_CENTS, 14000);
    assert.equal(PACKAGE_28H_MINUTES, 1680);
    assert.equal(PACKAGE_28H_PRICE_CENTS, 25200);
    assert.equal(JOIN_OPEN_LEAD_MIN, 5);

    const book = read("src/components/booking/booking-wizard.tsx");
    assert.match(book, /subjectId:\s*null/);
    assert.doesNotMatch(book, /Choose a subject|pick a tutor|Choose your Guide/i);
    assert.match(read("src/app/dashboard/tutor/page.tsx"), /Guide workspace/);
    assert.match(read("src/components/dashboard/guide-join-control.tsx"), /Join Study Hall|GuideJoinControl/);

    // Compensation formula untouched by PR6 migration
    const m23 = read("supabase/migrations/0023_studyhall_pr6_session_reports.sql");
    assert.doesNotMatch(m23, /comp_rate|tutor_earnings|record_tutor_earning|PAYG|package_products/i);
  });

  it("PR6 report surfaces do not reintroduce subject booking", () => {
    const blob = [
      "src/components/dashboard/guide-session-report.tsx",
      "src/app/api/tutor/session-report/route.ts",
      "supabase/migrations/0023_studyhall_pr6_session_reports.sql",
    ]
      .map(read)
      .join("\n");
    assert.doesNotMatch(blob, /reintroduce subject|subject matching for booking/i);
  });
});

describe("Study Hall PR6 — live session_reports (requires migration 0023)", { skip: !hasSupabaseEnv }, () => {
  const svc = adminClient();
  const accounts = [];
  let parent;
  let otherParent;
  let guideA;
  let guideB;
  let admin;
  let pr6Applied = false;

  async function approveGuide(id, tz = "UTC") {
    await svc.from("profiles").update({ role: "tutor" }).eq("id", id);
    await svc
      .from("tutor_profiles")
      .update({ status: "approved", timezone: tz, comp_rate_cents_per_hour: 1000 })
      .eq("profile_id", id);
  }

  async function avail(tutorId, dow, start = "00:00", end = "23:59") {
    await svc.from("tutor_availability").delete().eq("tutor_id", tutorId).eq("day_of_week", dow);
    await svc.from("tutor_availability").insert({
      tutor_id: tutorId,
      day_of_week: dow,
      start_time: start,
      end_time: end,
    });
  }

  async function newStudent(accountId, name) {
    const { data, error } = await svc
      .from("students")
      .insert({ account_id: accountId, full_name: name, grade_level: "8", timezone: "UTC" })
      .select("id")
      .single();
    assert.equal(error, null, error?.message);
    return data.id;
  }

  function futureUtc(days, hour) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  }

  async function detectPr6() {
    const { error } = await svc.from("session_reports").select("id").limit(1);
    if (error) return false;
    const probe = await svc.rpc("submit_session_report", {
      p_booking: "00000000-0000-0000-0000-000000000000",
      p_focus: "great_focus",
      p_work_summary: "probe",
      p_redirection: "none",
      p_guide_note: null,
    });
    // Function exists if we get a booking-not-found (or auth) rather than undefined RPC.
    if (!probe.error) return false;
    return /Booking not found|Not authenticated|Not authorized/i.test(probe.error.message);
  }

  async function insertCompletedBooking({ accountId, tutorId, studentId, firstName }) {
    // Stagger far-future hours so parallel/sequential inserts don't collide on
    // bookings_no_tutor_overlap (shared Guide calendar).
    const hour = 10 + (Math.floor(Math.random() * 10) % 10);
    const dayOffset = 30 + Math.floor(Math.random() * 40);
    const start = futureUtc(dayOffset, hour);
    const end = new Date(start.getTime() + 60 * 60000);
    const { data, error } = await svc
      .from("bookings")
      .insert({
        student_id: studentId,
        account_id: accountId,
        tutor_id: tutorId,
        subject_id: null,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        duration_minutes: 60,
        status: "completed",
        payment_status: "paid",
        price_cents: 1200,
        is_free_trial: false,
        student_first_name: firstName,
        tutor_display_name: "Guide",
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    assert.equal(error, null, error?.message);
    return data.id;
  }

  before(async () => {
    parent = await createUser({ requestedRole: "student", displayName: "PR6 Parent" });
    otherParent = await createUser({ requestedRole: "student", displayName: "PR6 Other Parent" });
    guideA = await createUser({ requestedRole: "tutor", displayName: "PR6 Guide A" });
    guideB = await createUser({ requestedRole: "tutor", displayName: "PR6 Guide B" });
    admin = await createUser({ requestedRole: "student", displayName: "PR6 Admin" });
    accounts.push(parent.id, otherParent.id, guideA.id, guideB.id, admin.id);
    await makeAdmin(admin.id);
    await approveGuide(guideA.id);
    await approveGuide(guideB.id);
    for (let d = 0; d < 7; d++) {
      await avail(guideA.id, d);
      await avail(guideB.id, d);
    }
    pr6Applied = await detectPr6();
  });

  after(async () => {
    for (const acc of accounts) {
      const { data: bks } = await svc.from("bookings").select("id").eq("account_id", acc);
      const ids = (bks ?? []).map((b) => b.id);
      if (ids.length) {
        await svc.from("session_reports").delete().in("booking_id", ids);
        await svc.from("tutor_earnings").delete().in("booking_id", ids);
        await svc.from("bookings").delete().in("id", ids);
      }
      await svc.from("payments").delete().eq("account_id", acc);
      await svc.from("package_minute_ledger").delete().eq("account_id", acc);
      await svc.from("dollar_credit_ledger").delete().eq("account_id", acc);
      await svc.from("students").delete().eq("account_id", acc);
    }
    // Also clear reports owned via tutor_id when account_id was the Guide (shouldn't happen)
    await svc.from("session_reports").delete().in("tutor_id", [guideA?.id, guideB?.id].filter(Boolean));
    await cleanupAll();
  });

  it("PR2 pricing + PR3 free session remain intact", async () => {
    const q60 = await svc.rpc("booking_quote", {
      p_account: parent.id,
      p_duration: 60,
      p_is_free_trial: false,
    });
    assert.equal(q60.error, null, q60.error?.message);
    assert.equal(q60.data.session_price_cents, 1200);

    const qFree = await svc.rpc("booking_quote", {
      p_account: parent.id,
      p_duration: 60,
      p_is_free_trial: true,
    });
    assert.equal(qFree.error, null, qFree.error?.message);
    assert.equal(qFree.data.session_price_cents, 0);

    const { data: pkgs } = await svc
      .from("package_products")
      .select("code, minutes, price_cents")
      .eq("is_active", true)
      .order("sort_order");
    assert.deepEqual(
      (pkgs ?? []).map((r) => [r.code, r.minutes, r.price_cents]),
      [
        ["pkg_14h", 840, 14000],
        ["pkg_28h", 1680, 25200],
      ],
    );
  });

  it("Guide can submit for own completed session; required fields + optional note", async (t) => {
    if (!pr6Applied) {
      t.skip("migration 0023 not applied to this environment yet");
      return;
    }
    const stu = await newStudent(parent.id, "Report Kid One");
    const bookingId = await insertCompletedBooking({
      accountId: parent.id,
      tutorId: guideA.id,
      studentId: stu,
      firstName: "Report",
    });

    const guideClient = await signIn(guideA.email, guideA.password);
    const bad = await guideClient.rpc("submit_session_report", {
      p_booking: bookingId,
      p_focus: "great_focus",
      p_work_summary: "",
      p_redirection: "none",
      p_guide_note: null,
    });
    assert.ok(bad.error, "empty work summary must fail");

    const ok = await guideClient.rpc("submit_session_report", {
      p_booking: bookingId,
      p_focus: "good_focus",
      p_work_summary: "Finished math worksheet pages 3–4",
      p_redirection: "a_little",
      p_guide_note: "Settled in after a brief reminder",
    });
    assert.equal(ok.error, null, ok.error?.message);
    assert.ok(ok.data);

    const { data: row } = await svc
      .from("session_reports")
      .select("*")
      .eq("booking_id", bookingId)
      .single();
    assert.equal(row.tutor_id, guideA.id);
    assert.equal(row.account_id, parent.id);
    assert.equal(row.focus_rating, "good_focus");
    assert.equal(row.redirection_level, "a_little");
    assert.match(row.work_summary, /math worksheet/i);
    assert.match(row.guide_note, /Settled in/);
  });

  it("duplicate report prevented; one report per booking", async (t) => {
    if (!pr6Applied) {
      t.skip("migration 0023 not applied to this environment yet");
      return;
    }
    const stu = await newStudent(parent.id, "Dup Kid");
    const bookingId = await insertCompletedBooking({
      accountId: parent.id,
      tutorId: guideA.id,
      studentId: stu,
      firstName: "Dup",
    });
    const guideClient = await signIn(guideA.email, guideA.password);
    const first = await guideClient.rpc("submit_session_report", {
      p_booking: bookingId,
      p_focus: "great_focus",
      p_work_summary: "Reading chapter 2",
      p_redirection: "none",
      p_guide_note: null,
    });
    assert.equal(first.error, null, first.error?.message);
    const second = await guideClient.rpc("submit_session_report", {
      p_booking: bookingId,
      p_focus: "difficult_session",
      p_work_summary: "Should not overwrite",
      p_redirection: "several_times",
      p_guide_note: null,
    });
    assert.ok(second.error);
    assert.match(second.error.message, /already been submitted/i);

    const { count } = await svc
      .from("session_reports")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", bookingId);
    assert.equal(count, 1);
  });

  it("Guide cannot submit for another Guide's session", async (t) => {
    if (!pr6Applied) {
      t.skip("migration 0023 not applied to this environment yet");
      return;
    }
    const stu = await newStudent(parent.id, "Other Guide Kid");
    const bookingId = await insertCompletedBooking({
      accountId: parent.id,
      tutorId: guideA.id,
      studentId: stu,
      firstName: "Other",
    });
    const otherGuide = await signIn(guideB.email, guideB.password);
    const r = await otherGuide.rpc("submit_session_report", {
      p_booking: bookingId,
      p_focus: "great_focus",
      p_work_summary: "Should fail",
      p_redirection: "none",
      p_guide_note: null,
    });
    assert.ok(r.error);
    assert.match(r.error.message, /Not authorized/i);
  });

  it("report requires completed booking (confirmed is rejected)", async (t) => {
    if (!pr6Applied) {
      t.skip("migration 0023 not applied to this environment yet");
      return;
    }
    const stu = await newStudent(parent.id, "Not Done Kid");
    const start = futureUtc(26, 10);
    const end = new Date(start.getTime() + 60 * 60000);
    const { data: bk, error } = await svc
      .from("bookings")
      .insert({
        student_id: stu,
        account_id: parent.id,
        tutor_id: guideA.id,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        duration_minutes: 60,
        status: "confirmed",
        payment_status: "paid",
        price_cents: 1200,
        is_free_trial: false,
        student_first_name: "NotDone",
        tutor_display_name: "Guide A",
      })
      .select("id")
      .single();
    assert.equal(error, null, error?.message);
    const guideClient = await signIn(guideA.email, guideA.password);
    const r = await guideClient.rpc("submit_session_report", {
      p_booking: bk.id,
      p_focus: "great_focus",
      p_work_summary: "Too early",
      p_redirection: "none",
      p_guide_note: null,
    });
    assert.ok(r.error);
    assert.match(r.error.message, /completed Study Hall/i);
  });

  it("parent can view own child's report; cannot view another family's; cannot modify", async (t) => {
    if (!pr6Applied) {
      t.skip("migration 0023 not applied to this environment yet");
      return;
    }
    const stu = await newStudent(parent.id, "Visible Kid");
    const bookingId = await insertCompletedBooking({
      accountId: parent.id,
      tutorId: guideA.id,
      studentId: stu,
      firstName: "Visible",
    });
    const guideClient = await signIn(guideA.email, guideA.password);
    const sub = await guideClient.rpc("submit_session_report", {
      p_booking: bookingId,
      p_focus: "needed_redirection",
      p_work_summary: "Science packet",
      p_redirection: "several_times",
      p_guide_note: null,
    });
    assert.equal(sub.error, null, sub.error?.message);

    const parentClient = await signIn(parent.email, parent.password);
    const mine = await parentClient.from("session_reports").select("*").eq("booking_id", bookingId).maybeSingle();
    assert.equal(mine.error, null, mine.error?.message);
    assert.ok(mine.data);
    assert.equal(mine.data.focus_rating, "needed_redirection");

    const upd = await parentClient
      .from("session_reports")
      .update({ work_summary: "hacked" })
      .eq("booking_id", bookingId)
      .select();
    assert.equal((upd.data ?? []).length, 0, "parent must not update Guide reports");

    const other = await signIn(otherParent.email, otherParent.password);
    const leaked = await other.from("session_reports").select("*").eq("booking_id", bookingId);
    assert.equal(leaked.error, null, leaked.error?.message);
    assert.equal((leaked.data ?? []).length, 0, "unrelated parent must not see the report");
  });

  it("unrelated Guide cannot read another Guide's report; admin can", async (t) => {
    if (!pr6Applied) {
      t.skip("migration 0023 not applied to this environment yet");
      return;
    }
    const stu = await newStudent(parent.id, "Admin Vis Kid");
    const bookingId = await insertCompletedBooking({
      accountId: parent.id,
      tutorId: guideA.id,
      studentId: stu,
      firstName: "AdminVis",
    });
    const guideClient = await signIn(guideA.email, guideA.password);
    await guideClient.rpc("submit_session_report", {
      p_booking: bookingId,
      p_focus: "great_focus",
      p_work_summary: "Quiet independent work",
      p_redirection: "none",
      p_guide_note: null,
    });

    const otherGuide = await signIn(guideB.email, guideB.password);
    const hidden = await otherGuide.from("session_reports").select("id").eq("booking_id", bookingId);
    assert.equal((hidden.data ?? []).length, 0);

    const adminClientSigned = await signIn(admin.email, admin.password);
    const seen = await adminClientSigned.from("session_reports").select("id").eq("booking_id", bookingId);
    assert.equal((seen.data ?? []).length, 1);
  });

  it("unauthenticated user cannot access reports", async (t) => {
    if (!pr6Applied) {
      t.skip("migration 0023 not applied to this environment yet");
      return;
    }
    const { anonClient } = await import("./helpers.mjs");
    const anon = anonClient();
    const r = await anon.from("session_reports").select("id").limit(5);
    assert.equal((r.data ?? []).length, 0);
    const rpc = await anon.rpc("submit_session_report", {
      p_booking: "00000000-0000-0000-0000-000000000001",
      p_focus: "great_focus",
      p_work_summary: "nope",
      p_redirection: "none",
      p_guide_note: null,
    });
    assert.ok(rpc.error);
  });

  it("invalid booking id rejected", async (t) => {
    if (!pr6Applied) {
      t.skip("migration 0023 not applied to this environment yet");
      return;
    }
    const guideClient = await signIn(guideA.email, guideA.password);
    const r = await guideClient.rpc("submit_session_report", {
      p_booking: "00000000-0000-0000-0000-000000000099",
      p_focus: "great_focus",
      p_work_summary: "ghost",
      p_redirection: "none",
      p_guide_note: null,
    });
    assert.ok(r.error);
    assert.match(r.error.message, /Booking not found/i);
  });
});
