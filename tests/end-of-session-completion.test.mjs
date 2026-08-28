import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";

import { lastCompletedStudyHall } from "../src/lib/parent-portal.mjs";
import { parentRecordingHomeLabel } from "../src/lib/parent-next-step.mjs";
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

describe("End-of-session completion — source", () => {
  it("0032 completes a confirmed booking after scheduled_end as part of the report RPC", () => {
    const m = read("supabase/migrations/0032_complete_booking_on_guide_report.sql");
    assert.match(m, /create or replace function public\.complete_ended_confirmed_booking/);
    assert.match(m, /scheduled_end <= now\(\)/);
    assert.match(m, /status = 'confirmed'/);
    assert.match(m, /try_full_earning/);
    assert.match(m, /session completed via Guide report/);
    assert.match(m, /perform public\.complete_ended_confirmed_booking\(p_booking\)/);
    assert.match(m, /create or replace function public\.submit_session_report/);
    assert.match(m, /create or replace function public\.submit_household_session_report/);
    assert.match(m, /revoke all on function public\.complete_ended_confirmed_booking/);
    assert.doesNotMatch(m, /grant execute on function public\.complete_ended_confirmed_booking\(uuid\)\s+to authenticated/i);
  });

  it("0031 is why the inconsistency existed; 0030 did not complete the booking", () => {
    const m31 = read("supabase/migrations/0031_household_study_hall_children.sql");
    const m30 = read("supabase/migrations/0030_guide_report_after_session_end.sql");
    assert.match(m31, /if v_bk\.status is distinct from 'completed'/);
    assert.match(m30, /Does not create earnings/);
    assert.match(m30, /status = 'confirmed' and v_ended/);
  });

  it("Management Mark complete and earnings uniqueness remain", () => {
    const adminApi = read("src/app/api/admin/booking/route.ts");
    const actions = read("src/components/dashboard/management-study-hall-actions.tsx");
    const earn = read("supabase/migrations/0029_guide_comp_currency.sql");
    assert.match(adminApi, /admin_complete_booking/);
    assert.match(actions, /Mark complete/);
    assert.match(earn, /on conflict \(booking_id\) do nothing/);
  });

  it("Guide UI still sends the Guide to Finish report after scheduled_end", () => {
    const room = read("src/components/session/session-room.tsx");
    const portal = read("src/lib/guide-portal.mjs");
    assert.match(room, /sessionEndedForReport/);
    assert.match(room, /\/dashboard\/tutor\/study-halls\/\$\{bookingId\}\/report/);
    assert.match(portal, /booking\.status === "completed"/);
    assert.match(portal, /booking\.status !== "confirmed"/);
  });

  it("Parent Report ready and notify still key off the stored report, not a new tracker", () => {
    const home = read("src/components/dashboard/parent-recent-activity.tsx");
    const api = read("src/app/api/tutor/session-report/route.ts");
    assert.match(home, /Report ready/);
    assert.match(api, /notifySessionReportReady/);
    const ready = T.sessionReportReady({
      studentName: "Sam",
      whenISO: "2026-08-27T17:00:00.000Z",
      tz: "America/Chicago",
      appUrl: "https://app.example.test",
      bookingId: "bk-complete",
    });
    assert.match(ready.text, /Read report/);
    assert.match(ready.text, /study-halls\/bk-complete/);
    assert.doesNotMatch(ready.html + ready.text, /attached|we emailed the recording/i);
    assert.equal(parentRecordingHomeLabel({ status: "processing" }), "Recording processing");
  });
});

describe("End-of-session completion — live happy path", { skip: !hasSupabaseEnv }, () => {
  const svc = adminClient();
  const accounts = [];
  let parent;
  let guide;
  let otherGuide;
  let admin;
  let schemaReady = false;

  async function approveGuide(id, rate = 1800) {
    await svc.from("profiles").update({ role: "tutor" }).eq("id", id);
    await svc
      .from("tutor_profiles")
      .update({
        status: "approved",
        timezone: "UTC",
        comp_rate_cents_per_hour: rate,
        comp_currency: "USD",
      })
      .eq("profile_id", id);
    await svc.from("tutor_availability").delete().eq("tutor_id", id);
    for (let dow = 0; dow < 7; dow += 1) {
      await svc.from("tutor_availability").insert({
        tutor_id: id,
        day_of_week: dow,
        start_time: "00:00",
        end_time: "23:59",
      });
    }
  }

  async function newStudent(accountId, name) {
    const { data, error } = await svc
      .from("students")
      .insert({ account_id: accountId, full_name: name, grade_level: "6", timezone: "UTC" })
      .select("id")
      .single();
    assert.equal(error, null, error?.message);
    return data.id;
  }

  function pastWindow(hoursAgo = 5) {
    const start = new Date(Date.now() - hoursAgo * 3600000);
    start.setUTCMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60000);
    return { start, end };
  }

  function futureWindow(days = 20, hour = 11) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + days);
    start.setUTCHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60000);
    return { start, end };
  }

  async function insertBooking({
    studentId,
    firstName,
    status,
    start,
    end,
    tutorId = guide.id,
    extra = {},
  }) {
    const { data, error } = await svc
      .from("bookings")
      .insert({
        student_id: studentId,
        account_id: parent.id,
        tutor_id: tutorId,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        duration_minutes: 60,
        status,
        payment_status: "paid",
        price_cents: 1200,
        is_free_trial: false,
        student_first_name: firstName,
        tutor_display_name: "Completion Guide",
        ...extra,
      })
      .select("id, status, completed_at")
      .single();
    assert.equal(error, null, error?.message);
    return data;
  }

  async function detect() {
    const { error } = await svc.from("session_reports").select("id").limit(1);
    if (error) return false;
    const kids = await svc.from("booking_children").select("booking_id").limit(1);
    if (kids.error) return false;
    const probe = await svc.rpc("submit_session_report", {
      p_booking: "00000000-0000-0000-0000-000000000000",
      p_focus: "great_focus",
      p_work_summary: "probe",
      p_redirection: "none",
      p_guide_note: null,
    });
    return Boolean(probe.error && /Booking not found|Not authenticated|Not authorized/i.test(probe.error.message));
  }

  before(async () => {
    schemaReady = await detect();
    if (!schemaReady) return;
    parent = await createUser({ requestedRole: "student", displayName: "Completion Parent" });
    guide = await createUser({ requestedRole: "tutor", displayName: "Completion Guide" });
    otherGuide = await createUser({ requestedRole: "tutor", displayName: "Other Completion Guide" });
    admin = await createUser({ requestedRole: "student", displayName: "Completion Admin" });
    accounts.push(parent.id, guide.id, otherGuide.id, admin.id);
    await makeAdmin(admin.id);
    await approveGuide(guide.id, 1800);
    await approveGuide(otherGuide.id, 1800);
  });

  after(async () => {
    if (accounts.length) {
      const { data: bks } = await svc.from("bookings").select("id").in("account_id", accounts);
      const ids = (bks ?? []).map((b) => b.id);
      if (ids.length) {
        await svc.from("session_report_children").delete().in("booking_id", ids);
        await svc.from("session_reports").delete().in("booking_id", ids);
        await svc.from("session_recordings").delete().in("booking_id", ids);
        await svc.from("tutor_earnings").delete().in("booking_id", ids);
        await svc.from("bookings").delete().in("id", ids);
      }
      await svc.from("students").delete().in("account_id", accounts);
      for (const id of [guide?.id, otherGuide?.id].filter(Boolean)) {
        await svc.from("tutor_availability").delete().eq("tutor_id", id);
      }
    }
    await cleanupAll();
  });

  it("one-child: confirmed + ended → Guide report completes booking, one earning, Parent can read", async (t) => {
    if (!schemaReady) {
      t.skip("report schema not applied");
      return;
    }
    const stu = await newStudent(parent.id, "Sam Complete");
    const { start, end } = pastWindow(8);
    const bk = await insertBooking({ studentId: stu, firstName: "Sam", status: "confirmed", start, end });
    const rec = await svc.from("session_recordings").insert({
      booking_id: bk.id,
      status: "processing",
      room_name: `at-${bk.id.replace(/-/g, "")}`,
    });
    assert.equal(rec.error, null, rec.error?.message);

    const guideClient = await signIn(guide.email, guide.password);
    const sub = await guideClient.rpc("submit_session_report", {
      p_booking: bk.id,
      p_focus: "good_focus",
      p_work_summary: "Math worksheet and 20 minutes of reading",
      p_redirection: "a_little",
      p_guide_note: "Asked for a quiet start.",
    });
    assert.equal(sub.error, null, sub.error?.message);

    const { data: after } = await svc
      .from("bookings")
      .select("status, completed_at")
      .eq("id", bk.id)
      .single();
    assert.equal(after.status, "completed");
    assert.ok(after.completed_at);

    const { data: report } = await svc.from("session_reports").select("work_summary").eq("booking_id", bk.id).single();
    assert.equal(report.work_summary, "Math worksheet and 20 minutes of reading");

    const { data: earns } = await svc
      .from("tutor_earnings")
      .select("amount_cents, duration_minutes, rate_cents_per_hour, currency")
      .eq("booking_id", bk.id);
    assert.equal(earns.length, 1);
    assert.equal(earns[0].duration_minutes, 60);
    assert.equal(earns[0].rate_cents_per_hour, 1800);
    assert.equal(earns[0].amount_cents, 1800);
    assert.equal(earns[0].currency, "USD");

    const parentClient = await signIn(parent.email, parent.password);
    const seen = await parentClient.from("session_reports").select("work_summary").eq("booking_id", bk.id).maybeSingle();
    assert.equal(seen.error, null, seen.error?.message);
    assert.equal(seen.data.work_summary, "Math worksheet and 20 minutes of reading");

    const last = lastCompletedStudyHall(
      [{ id: bk.id, status: after.status, scheduled_start: start.toISOString(), scheduled_end: end.toISOString() }],
      Date.now(),
    );
    assert.equal(last?.id, bk.id);

    const { data: recAfter } = await svc
      .from("session_recordings")
      .select("status")
      .eq("booking_id", bk.id)
      .single();
    assert.equal(recAfter.status, "processing");
  });

  it("three-child: one report workflow, one earning, booking completed without Management", async (t) => {
    if (!schemaReady) {
      t.skip("report schema not applied");
      return;
    }
    const ids = [];
    for (const name of ["Jordan C", "Maya C", "Noah C"]) ids.push(await newStudent(parent.id, name));
    const { start, end } = pastWindow(12);
    const bk = await insertBooking({ studentId: ids[0], firstName: "Jordan", status: "confirmed", start, end });
    const attached = await svc.rpc("attach_booking_children", { p_booking: bk.id, p_student_ids: ids });
    assert.equal(attached.error, null, attached.error?.message);

    const guideClient = await signIn(guide.email, guide.password);
    const sub = await guideClient.rpc("submit_household_session_report", {
      p_booking: bk.id,
      p_child_reports: [
        { student_id: ids[0], focus: "good_focus", work_summary: "Math worksheet and reading", redirection: "a_little", guide_note: "Started slowly" },
        { student_id: ids[1], focus: "great_focus", work_summary: "Science review and notes", redirection: "none", guide_note: null },
        { student_id: ids[2], focus: "good_focus", work_summary: "History notes and practice questions", redirection: "none", guide_note: null },
      ],
    });
    assert.equal(sub.error, null, sub.error?.message);

    const { data: after } = await svc.from("bookings").select("status").eq("id", bk.id).single();
    assert.equal(after.status, "completed");
    const { data: kids } = await svc.from("session_report_children").select("work_summary").eq("booking_id", bk.id);
    assert.equal(kids.length, 3);
    const { data: earns } = await svc.from("tutor_earnings").select("amount_cents, duration_minutes").eq("booking_id", bk.id);
    assert.equal(earns.length, 1);
    assert.equal(earns[0].duration_minutes, 60);
    assert.equal(earns[0].amount_cents, 1800);
  });

  it("premature report on a future confirmed Study Hall is rejected", async (t) => {
    if (!schemaReady) {
      t.skip("report schema not applied");
      return;
    }
    const stu = await newStudent(parent.id, "Future Kid");
    const { start, end } = futureWindow(22, 10);
    const bk = await insertBooking({ studentId: stu, firstName: "Future", status: "confirmed", start, end });
    const guideClient = await signIn(guide.email, guide.password);
    const r = await guideClient.rpc("submit_session_report", {
      p_booking: bk.id,
      p_focus: "great_focus",
      p_work_summary: "Too early",
      p_redirection: "none",
      p_guide_note: null,
    });
    assert.ok(r.error);
    assert.match(r.error.message, /completed Study Hall/i);
    const { data: after } = await svc.from("bookings").select("status").eq("id", bk.id).single();
    assert.equal(after.status, "confirmed");
    const { count } = await svc.from("tutor_earnings").select("id", { count: "exact", head: true }).eq("booking_id", bk.id);
    assert.equal(count, 0);
  });

  it("cancelled Study Hall cannot be reported or completed by the Guide", async (t) => {
    if (!schemaReady) {
      t.skip("report schema not applied");
      return;
    }
    const stu = await newStudent(parent.id, "Cancelled Kid");
    const { start, end } = pastWindow(16);
    const bk = await insertBooking({
      studentId: stu,
      firstName: "Cancel",
      status: "cancelled",
      start,
      end,
      extra: { cancelled_at: new Date().toISOString() },
    });
    const guideClient = await signIn(guide.email, guide.password);
    const r = await guideClient.rpc("submit_session_report", {
      p_booking: bk.id,
      p_focus: "great_focus",
      p_work_summary: "Should fail",
      p_redirection: "none",
      p_guide_note: null,
    });
    assert.ok(r.error);
    assert.match(r.error.message, /completed Study Hall/i);
    const { count } = await svc.from("tutor_earnings").select("id", { count: "exact", head: true }).eq("booking_id", bk.id);
    assert.equal(count, 0);
  });

  it("wrong Guide cannot report another Guide's Study Hall", async (t) => {
    if (!schemaReady) {
      t.skip("report schema not applied");
      return;
    }
    const stu = await newStudent(parent.id, "Wrong Guide Kid");
    const { start, end } = pastWindow(20);
    const bk = await insertBooking({ studentId: stu, firstName: "Wrong", status: "confirmed", start, end });
    const other = await signIn(otherGuide.email, otherGuide.password);
    const r = await other.rpc("submit_session_report", {
      p_booking: bk.id,
      p_focus: "great_focus",
      p_work_summary: "Should fail",
      p_redirection: "none",
      p_guide_note: null,
    });
    assert.ok(r.error);
    assert.match(r.error.message, /Not authorized/i);
    const { data: after } = await svc.from("bookings").select("status").eq("id", bk.id).single();
    assert.equal(after.status, "confirmed");
  });

  it("duplicate report and later Management complete do not duplicate earnings or reports", async (t) => {
    if (!schemaReady) {
      t.skip("report schema not applied");
      return;
    }
    const stu = await newStudent(parent.id, "Dup Complete Kid");
    const { start, end } = pastWindow(24);
    const bk = await insertBooking({ studentId: stu, firstName: "Dup", status: "confirmed", start, end });
    const guideClient = await signIn(guide.email, guide.password);
    const first = await guideClient.rpc("submit_session_report", {
      p_booking: bk.id,
      p_focus: "great_focus",
      p_work_summary: "Reading chapter 2",
      p_redirection: "none",
      p_guide_note: null,
    });
    assert.equal(first.error, null, first.error?.message);
    const second = await guideClient.rpc("submit_session_report", {
      p_booking: bk.id,
      p_focus: "difficult_session",
      p_work_summary: "Should not overwrite",
      p_redirection: "several_times",
      p_guide_note: null,
    });
    assert.ok(second.error);
    assert.match(second.error.message, /already been submitted/i);

    const adminClientSigned = await signIn(admin.email, admin.password);
    const complete = await adminClientSigned.rpc("admin_complete_booking", { p_booking: bk.id });
    assert.equal(complete.error, null, complete.error?.message);
    assert.equal(complete.data?.status, "noop");

    const { count: reports } = await svc
      .from("session_reports")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", bk.id);
    assert.equal(reports, 1);
    const { data: earns } = await svc.from("tutor_earnings").select("id, amount_cents").eq("booking_id", bk.id);
    assert.equal(earns.length, 1);
    assert.equal(earns[0].amount_cents, 1800);
  });

  it("Management can still complete an ended booking that has no report yet", async (t) => {
    if (!schemaReady) {
      t.skip("report schema not applied");
      return;
    }
    const stu = await newStudent(parent.id, "Admin Complete Kid");
    const { start, end } = pastWindow(28);
    const bk = await insertBooking({ studentId: stu, firstName: "Admin", status: "confirmed", start, end });
    const adminClientSigned = await signIn(admin.email, admin.password);
    const done = await adminClientSigned.rpc("admin_complete_booking", { p_booking: bk.id });
    assert.equal(done.error, null, done.error?.message);
    assert.equal(done.data?.status, "completed");

    const { data: after } = await svc.from("bookings").select("status").eq("id", bk.id).single();
    assert.equal(after.status, "completed");
    const { data: earns } = await svc.from("tutor_earnings").select("amount_cents").eq("booking_id", bk.id);
    assert.equal(earns.length, 1);
    assert.equal(earns[0].amount_cents, 1800);

    const guideClient = await signIn(guide.email, guide.password);
    const sub = await guideClient.rpc("submit_session_report", {
      p_booking: bk.id,
      p_focus: "good_focus",
      p_work_summary: "Math worksheet",
      p_redirection: "none",
      p_guide_note: null,
    });
    assert.equal(sub.error, null, sub.error?.message);
    const { data: earnsAfter } = await svc.from("tutor_earnings").select("id").eq("booking_id", bk.id);
    assert.equal(earnsAfter.length, 1);
  });
});
