import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";

import { guideWorkforceLabel, isGuideApplicantStatus } from "../src/lib/guide-workforce.mjs";
import {
  adminClient,
  cleanupAll,
  createUser,
  hasSupabaseEnv,
  makeAdmin,
  signIn,
} from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Guide workforce ops — source contracts", () => {
  it("derives rejected vs suspended from existing tutor_status", () => {
    assert.equal(guideWorkforceLabel("pending", null), "pending");
    assert.equal(guideWorkforceLabel("approved", "2026-01-01"), "active");
    assert.equal(guideWorkforceLabel("suspended", null), "rejected");
    assert.equal(guideWorkforceLabel("suspended", "2026-01-01"), "suspended");
    assert.equal(isGuideApplicantStatus("pending"), true);
    assert.equal(isGuideApplicantStatus("suspended"), true);
    assert.equal(isGuideApplicantStatus("approved"), false);
  });

  it("migration 0028 wraps RPCs and adds reject/suspend without rewriting booking math", () => {
    const m = read("supabase/migrations/0028_guide_workforce_ops.sql");
    assert.match(m, /is_guide_applicant_account/);
    assert.match(m, /book_session_unchecked/);
    assert.match(m, /purchase_package_unchecked/);
    assert.match(m, /Guide application accounts cannot book Study Hall as a parent/);
    assert.match(m, /Guide application accounts cannot purchase hours as a parent/);
    assert.match(m, /reject_tutor/);
    assert.match(m, /Only a pending Guide application can be rejected/);
    assert.match(m, /Only an active Guide can be suspended/);
    assert.doesNotMatch(m, /session_list_price_cents/, "does not copy booking pricing math");
    assert.doesNotMatch(m, /enable_recording|createFrame|stripe|resend|twilio/i);
    assert.match(read("supabase/migrations/0022_studyhall_pr4_supervision_booking.sql"), /session_list_price_cents/);
    assert.match(read("supabase/migrations/0012_phase4d_hardening.sql"), /package_products/);
  });

  it("admin Guide workforce API is admin-only and reuses auto-reassign", () => {
    const api = read("src/app/api/admin/guide-workforce/route.ts");
    assert.match(api, /adminApiContext/);
    assert.match(api, /reject_tutor/);
    assert.match(api, /suspend_tutor/);
    assert.match(api, /approve_tutor/);
    assert.match(api, /try_auto_reassign_booking/);
    assert.match(api, /notifyReassignment/);
    assert.match(api, /guide-coverage-failed/);
    assert.doesNotMatch(api, /deleteUser|hard-delete|from\("tutor_profiles"\)\.delete/);
  });

  it("Management portal surfaces status and confirmations without changing nav", () => {
    const admin = read("src/app/dashboard/admin/page.tsx");
    const actions = read("src/components/dashboard/guide-workforce-actions.tsx");
    const shell = read("src/components/dashboard/dashboard-shell.tsx");
    assert.match(admin, /id="guide-approvals"/);
    assert.match(admin, /Reject Application|GuideWorkforceActions/);
    assert.match(admin, /pending|active|suspended|rejected/);
    assert.match(actions, /Suspend Guide\?/);
    assert.match(actions, /no longer be available for new Study Hall assignments/);
    assert.match(actions, /Reject Application\?/);
    assert.match(actions, /will not be approved as a Guide/);
    assert.match(shell, /label: "Guide Approvals".*href: "\/dashboard\/admin#guide-approvals"/s);
    assert.match(shell, /label: "Overview".*href: "\/dashboard\/admin#overview"/s);
  });

  it("applicant helper treats rejected and suspended as non-parent accounts", () => {
    const helper = read("src/lib/guide-applicant.ts");
    assert.match(helper, /approved_at/);
    assert.match(helper, /rejected/);
    assert.match(read("src/lib/auth-home.ts"), /status === "pending" \|\| tp\?\.status === "suspended"/);
    assert.match(read("src/lib/checkout-service.ts"), /assertNotGuideApplicant/);
  });

  it("existing approval flow and auto-reassign architecture remain", () => {
    assert.match(read("src/app/dashboard/admin/actions.ts"), /approve_tutor/);
    assert.match(read("supabase/migrations/0001_phase2_auth_schema.sql"), /approve_tutor/);
    assert.match(read("supabase/migrations/0026_studyhall_pr10d_auto_reassign.sql"), /try_auto_reassign_booking/);
  });
});

describe("Guide workforce ops — live RPCs", { skip: !hasSupabaseEnv }, () => {
  const svc = hasSupabaseEnv ? adminClient() : null;
  const accounts = [];
  let applied = false;
  let admin;
  let adminC;
  let parent;
  let parentC;
  let applicant;
  let applicantC;
  let guide;
  let otherGuide;
  let studentId;
  let pkg;

  async function approveGuide(id) {
    await svc.from("profiles").update({ role: "tutor" }).eq("id", id);
    await svc
      .from("tutor_profiles")
      .update({ status: "approved", timezone: "UTC", comp_rate_cents_per_hour: 1000, approved_at: new Date().toISOString() })
      .eq("profile_id", id);
  }

  before(async () => {
    const probe = await svc.rpc("reject_tutor", { target: "00000000-0000-0000-0000-000000000000" });
    applied = !probe.error || !/schema cache|Could not find the function/i.test(probe.error.message);
    if (!applied) return;

    admin = await createUser({ requestedRole: "student", displayName: "WF Admin" });
    await makeAdmin(admin.id);
    adminC = await signIn(admin.email, admin.password);
    parent = await createUser({ requestedRole: "student", displayName: "WF Parent" });
    parentC = await signIn(parent.email, parent.password);
    applicant = await createUser({ requestedRole: "tutor", displayName: "WF Applicant" });
    applicantC = await signIn(applicant.email, applicant.password);
    guide = await createUser({ requestedRole: "tutor", displayName: "WF Guide" });
    otherGuide = await createUser({ requestedRole: "tutor", displayName: "WF Other Guide" });
    await approveGuide(guide.id);
    await approveGuide(otherGuide.id);
    for (const id of [guide.id, otherGuide.id]) {
      for (let d = 0; d < 7; d++) {
        await svc.from("tutor_availability").insert({
          tutor_id: id,
          day_of_week: d,
          start_time: "00:00",
          end_time: "23:59",
        });
      }
    }
    const { data: stu } = await svc
      .from("students")
      .insert({ account_id: parent.id, full_name: "WF Child", grade_level: "6", timezone: "UTC" })
      .select("id")
      .single();
    studentId = stu.id;
    const { data: applicantStu } = await svc
      .from("students")
      .insert({ account_id: applicant.id, full_name: "Should Not Book", grade_level: "6", timezone: "UTC" })
      .select("id")
      .single();
    applicant.studentId = applicantStu.id;
    pkg = (await svc.from("package_products").select("id").eq("is_active", true).limit(1).maybeSingle()).data;
    accounts.push(admin.id, parent.id, applicant.id, guide.id, otherGuide.id);
  });

  after(async () => {
    for (const acc of accounts) {
      const { data: bks } = await svc.from("bookings").select("id").eq("account_id", acc);
      const ids = (bks ?? []).map((b) => b.id);
      if (ids.length) {
        await svc.from("tutor_earnings").delete().in("booking_id", ids);
        await svc.from("session_reports").delete().in("booking_id", ids).then(
          () => {},
          () => {},
        );
        await svc.from("bookings").delete().in("id", ids);
      }
      await svc.from("payments").delete().eq("account_id", acc);
      await svc.from("students").delete().eq("account_id", acc);
    }
    await cleanupAll();
  });

  it("live RPC checks run only after 0028 is applied", () => {
    if (!applied) {
      console.log("migration 0028 is not on this database yet — live RPC assertions skipped");
    }
  });

  it("pending applicant cannot call book_session directly", async () => {
    if (!applied) return;
    const start = new Date(Date.now() + 10 * 86400_000);
    const { error } = await applicantC.rpc("book_session", {
      p_student_id: applicant.studentId,
      p_subject_id: null,
      p_other_subject: null,
      p_request_note: null,
      p_duration: 60,
      p_start: start.toISOString(),
      p_is_free_trial: false,
    });
    assert.ok(error, "pending applicant must be rejected by book_session");
    assert.match(error.message, /Guide application accounts cannot book/i);
  });

  it("pending applicant cannot call purchase_package directly", async () => {
    if (!applied) return;
    assert.ok(pkg?.id, "an active package product is required");
    const { error } = await applicantC.rpc("purchase_package", { p_package_id: pkg.id });
    assert.ok(error, "pending applicant must be rejected by purchase_package");
    assert.match(error.message, /Guide application accounts cannot purchase/i);
  });

  it("normal parent can still call purchase_package when otherwise eligible", async () => {
    if (!applied) return;
    assert.ok(pkg?.id);
    const { error } = await parentC.rpc("purchase_package", { p_package_id: pkg.id });
    assert.equal(error, null, error?.message);
  });

  it("admin can reject a pending applicant; non-admin cannot", async () => {
    if (!applied) return;
    const extra = await createUser({ requestedRole: "tutor", displayName: "WF Reject Me" });
    accounts.push(extra.id);
    const parentTry = await parentC.rpc("reject_tutor", { target: extra.id });
    assert.ok(parentTry.error, "parent cannot reject");
    const guideTry = await (await signIn(guide.email, guide.password)).rpc("reject_tutor", { target: extra.id });
    assert.ok(guideTry.error, "Guide cannot reject");
    const { error } = await adminC.rpc("reject_tutor", { target: extra.id });
    assert.equal(error, null, error?.message);
    const row = (await svc.from("tutor_profiles").select("status, approved_at").eq("profile_id", extra.id).single()).data;
    const prof = (await svc.from("profiles").select("role").eq("id", extra.id).single()).data;
    assert.equal(row.status, "suspended");
    assert.equal(row.approved_at, null);
    assert.equal(prof.role, "student");
    assert.equal(guideWorkforceLabel(row.status, row.approved_at), "rejected");
  });

  it("admin can suspend an active Guide; non-admin cannot; matching excludes them", async () => {
    if (!applied) return;
    const target = await createUser({ requestedRole: "tutor", displayName: "WF Suspend Me" });
    accounts.push(target.id);
    await approveGuide(target.id);
    const parentTry = await parentC.rpc("suspend_tutor", { target: target.id });
    assert.ok(parentTry.error, "parent cannot suspend");
    const selfTry = await (await signIn(target.email, target.password)).rpc("suspend_tutor", { target: target.id });
    assert.ok(selfTry.error, "Guide cannot suspend self");
    const { error } = await adminC.rpc("suspend_tutor", { target: target.id });
    assert.equal(error, null, error?.message);
    const row = (await svc.from("tutor_profiles").select("status, approved_at").eq("profile_id", target.id).single()).data;
    const prof = (await svc.from("profiles").select("role").eq("id", target.id).single()).data;
    assert.equal(row.status, "suspended");
    assert.ok(row.approved_at);
    assert.equal(prof.role, "student");
    assert.equal(guideWorkforceLabel(row.status, row.approved_at), "suspended");

    const start = new Date(Date.now() + 12 * 86400_000);
    start.setUTCMinutes(0, 0, 0);
    const { data: created, error: bookErr } = await parentC.rpc("book_session", {
      p_student_id: studentId,
      p_subject_id: null,
      p_other_subject: null,
      p_request_note: null,
      p_duration: 60,
      p_start: start.toISOString(),
      p_is_free_trial: false,
    });
    if (!bookErr && created?.booking_id) {
      const b = (await svc.from("bookings").select("tutor_id").eq("id", created.booking_id).single()).data;
      assert.notEqual(b.tutor_id, target.id, "suspended Guide must not receive new assignments");
    }
  });

  it("historical bookings, reports, and earnings survive suspend", async () => {
    if (!applied) return;
    const histGuide = await createUser({ requestedRole: "tutor", displayName: "WF History Guide" });
    accounts.push(histGuide.id);
    await approveGuide(histGuide.id);
    const start = new Date(Date.now() - 7 * 86400_000);
    const end = new Date(start.getTime() + 60 * 60000);
    const { data: booking, error: bErr } = await svc
      .from("bookings")
      .insert({
        student_id: studentId,
        account_id: parent.id,
        tutor_id: histGuide.id,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        duration_minutes: 60,
        status: "completed",
        payment_status: "paid",
        price_cents: 1200,
        is_free_trial: false,
        student_first_name: "WF Child",
        tutor_display_name: "History Guide",
      })
      .select("id, tutor_id, tutor_display_name, status")
      .single();
    assert.equal(bErr, null, bErr?.message);
    const { data: earning } = await svc
      .from("tutor_earnings")
      .insert({
        tutor_id: histGuide.id,
        booking_id: booking.id,
        duration_minutes: 60,
        rate_cents_per_hour: 1000,
        amount_cents: 1000,
        status: "earned",
        reason: "test",
      })
      .select("id, amount_cents, booking_id")
      .single();
    const { error: rptErr } = await svc.from("session_reports").insert({
      booking_id: booking.id,
      tutor_id: histGuide.id,
      account_id: parent.id,
      focus_rating: "good_focus",
      work_summary: "Completed the planned homework routine.",
      redirection_level: "a_little",
    });
    const reportInserted = !rptErr;

    const { error } = await adminC.rpc("suspend_tutor", { target: histGuide.id });
    assert.equal(error, null, error?.message);

    const still = (await svc.from("bookings").select("id, tutor_id, tutor_display_name, status").eq("id", booking.id).single())
      .data;
    assert.equal(still.tutor_id, histGuide.id);
    assert.equal(still.tutor_display_name, "History Guide");
    assert.equal(still.status, "completed");
    if (earning?.id) {
      const e2 = (await svc.from("tutor_earnings").select("amount_cents, booking_id").eq("id", earning.id).single()).data;
      assert.equal(e2.amount_cents, 1000);
      assert.equal(e2.booking_id, booking.id);
    }
    if (reportInserted) {
      const r2 = (await svc.from("session_reports").select("id").eq("booking_id", booking.id).maybeSingle()).data;
      assert.ok(r2?.id);
    }
  });

  it("reactivate uses approve_tutor and restores active status", async () => {
    if (!applied) return;
    const g = await createUser({ requestedRole: "tutor", displayName: "WF Reactivate" });
    accounts.push(g.id);
    await approveGuide(g.id);
    assert.equal((await adminC.rpc("suspend_tutor", { target: g.id })).error, null);
    const parentTry = await parentC.rpc("approve_tutor", { target: g.id });
    assert.ok(parentTry.error, "parent cannot reactivate");
    const { error } = await adminC.rpc("approve_tutor", { target: g.id });
    assert.equal(error, null, error?.message);
    const row = (await svc.from("tutor_profiles").select("status").eq("profile_id", g.id).single()).data;
    const prof = (await svc.from("profiles").select("role").eq("id", g.id).single()).data;
    assert.equal(row.status, "approved");
    assert.equal(prof.role, "tutor");
  });

  it("existing approve_tutor still promotes a pending applicant", async () => {
    if (!applied) return;
    const g = await createUser({ requestedRole: "tutor", displayName: "WF Approve Flow" });
    accounts.push(g.id);
    const { error } = await adminC.rpc("approve_tutor", { target: g.id });
    assert.equal(error, null, error?.message);
    const row = (await svc.from("tutor_profiles").select("status").eq("profile_id", g.id).single()).data;
    const prof = (await svc.from("profiles").select("role").eq("id", g.id).single()).data;
    assert.equal(row.status, "approved");
    assert.equal(prof.role, "tutor");
  });

  it("future assigned sessions try existing auto-reassign after suspend", async () => {
    if (!applied) return;
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 21);
    start.setUTCHours(15, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60000);
    const { data: booking, error: bErr } = await svc
      .from("bookings")
      .insert({
        student_id: studentId,
        account_id: parent.id,
        tutor_id: guide.id,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        duration_minutes: 60,
        status: "confirmed",
        payment_status: "paid",
        price_cents: 1200,
        is_free_trial: false,
        student_first_name: "WF Child",
        tutor_display_name: "WF Guide",
      })
      .select("id, tutor_id")
      .single();
    assert.equal(bErr, null, bErr?.message);
    assert.equal((await adminC.rpc("suspend_tutor", { target: guide.id })).error, null);
    const { data: auto, error: autoErr } = await svc.rpc("try_auto_reassign_booking", { p_booking: booking.id });
    assert.equal(autoErr, null, autoErr?.message);
    if (auto?.status === "reassigned") {
      assert.notEqual(auto.to_tutor, guide.id);
      const after = (await svc.from("bookings").select("tutor_id").eq("id", booking.id).single()).data;
      assert.equal(after.tutor_id, auto.to_tutor);
    } else {
      assert.equal(auto?.status, "needs_admin");
      const after = (await svc.from("bookings").select("tutor_id, status").eq("id", booking.id).single()).data;
      assert.equal(after.tutor_id, guide.id, "booking stays assigned when no replacement");
      assert.equal(after.status, "confirmed");
    }
  });
});
