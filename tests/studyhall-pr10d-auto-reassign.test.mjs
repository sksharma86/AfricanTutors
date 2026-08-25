import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";

import {
  parentSilentOnSuccessfulReassignment,
  reassignmentOutcome,
  reassignmentRecipients,
} from "../src/lib/notifications/reassignment-policy.mjs";
import {
  adminClient,
  cleanupAll,
  createUser,
  hasSupabaseEnv,
  makeAdmin,
  signIn,
} from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const SFX = `pr10d_re_${Date.now().toString(36)}`;

describe("Study Hall PR10D — auto-reassign source contracts", () => {
  it("migration 0026 defines eligibility + auto-reassign + no subject matching", () => {
    const m = read("supabase/migrations/0026_studyhall_pr10d_auto_reassign.sql");
    assert.match(m, /try_auto_reassign_booking/);
    assert.match(m, /list_reassignment_candidates/);
    assert.match(m, /tutor_is_available/);
    assert.match(m, /exclusion_violation/);
    assert.match(m, /auto_reassign_tutor/);
    assert.match(m, /for update/i);
    assert.match(m, /profile_id is distinct from/);
    assert.doesNotMatch(m, /tutor_subjects/);
    assert.match(m, /admin_reassign_tutor/);
    assert.match(m, /not continuously available|continuously available/i);
  });

  it("Guide cancel API attempts auto-reassign; success silent to parent; failure alerts admin", () => {
    const route = read("src/app/api/tutor/cancellation-request/route.ts");
    assert.match(route, /try_auto_reassign_booking/);
    assert.match(route, /notifyReassignment/);
    assert.match(route, /reassigned:\s*true/);
    assert.match(route, /guide-coverage-failed/);
    assert.match(route, /needs_admin/);
    assert.doesNotMatch(route, /Tutor cancellation request/);
    assert.doesNotMatch(route, /A tutor has requested/);
  });

  it("manual admin reassignment fetches eligibility candidates (not all approved Guides)", () => {
    const consoleSrc = read("src/components/dashboard/admin-console.tsx");
    assert.match(consoleSrc, /\/api\/admin\/reassignment-candidates/);
    assert.match(consoleSrc, /continuously available for the full session/i);
    assert.doesNotMatch(consoleSrc, /All approved Guides passed in are eligible/);
    const api = read("src/app/api/admin/reassignment-candidates/route.ts");
    assert.match(api, /list_reassignment_candidates/);
  });

  it("PR8 successful reassignment remains parent-silent", () => {
    assert.equal(reassignmentOutcome(true), "successful_internal");
    assert.equal(parentSilentOnSuccessfulReassignment(true), true);
    const r = reassignmentRecipients("successful_internal");
    assert.equal(r.parentEmail, false);
    assert.equal(r.parentSms, false);
    assert.equal(r.newGuideAssignment, true);
    assert.equal(r.managerExceptionAlert, false);
    const notify = read("src/lib/notify.ts");
    assert.match(notify, /never parent email \/ never parent SMS on successful reassignment/i);
  });

  it("presentation labels use Guide / Prepaid hours (not generated Tutor labels)", () => {
    assert.match(read("src/lib/checkout-service.ts"), /Prepaid hours/);
    assert.doesNotMatch(read("src/lib/checkout-service.ts"), /Tutoring package/);
    assert.match(read("src/components/dashboard/tutor-cancel-request.tsx"), /Finding a replacement|I'm unavailable/);
  });
});

describe("Study Hall PR10D — live auto-reassignment", { skip: !hasSupabaseEnv }, () => {
  const svc = adminClient();
  const accounts = [];
  let parent;
  let guideA;
  let guideB;
  let guideC;
  let admin;
  let adminC;
  let applied = false;
  let subjectOnlyB;

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

  async function clearAvail(tutorId) {
    await svc.from("tutor_availability").delete().eq("tutor_id", tutorId);
  }

  async function newStudent(accountId, name) {
    const { data, error } = await svc
      .from("students")
      .insert({ account_id: accountId, full_name: name, grade_level: "7", timezone: "UTC" })
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

  async function confirmedBooking({ tutorId, start, end, duration = 60, studentId, accountId, first = "Kid" }) {
    const { data, error } = await svc
      .from("bookings")
      .insert({
        student_id: studentId,
        account_id: accountId,
        tutor_id: tutorId,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        duration_minutes: duration,
        status: "confirmed",
        payment_status: "paid",
        price_cents: 1200,
        is_free_trial: false,
        student_first_name: first,
        tutor_display_name: "Guide",
        public_reference: `SH-${SFX}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
      })
      .select("id, tutor_id, scheduled_start, scheduled_end, status, payment_status, price_cents, student_id, account_id")
      .single();
    assert.equal(error, null, error?.message);
    return data;
  }

  before(async () => {
    const probe = await svc.rpc("try_auto_reassign_booking", {
      p_booking: "00000000-0000-0000-0000-000000000000",
    });
    applied = !probe.error || !/schema cache|Could not find the function/i.test(probe.error.message);
    if (!applied) return;

    parent = await createUser({ requestedRole: "student", displayName: "PR10D Re Parent" });
    accounts.push(parent.id);
    guideA = await createUser({ requestedRole: "tutor", displayName: "PR10D Guide A" });
    guideB = await createUser({ requestedRole: "tutor", displayName: "PR10D Guide B" });
    guideC = await createUser({ requestedRole: "tutor", displayName: "PR10D Guide C" });
    admin = await createUser({ requestedRole: "student", displayName: "PR10D Re Admin" });
    await makeAdmin(admin.id);
    adminC = await signIn(admin.email, admin.password);

    await approveGuide(guideA.id);
    await approveGuide(guideB.id);
    await approveGuide(guideC.id);
    for (let d = 0; d < 7; d++) {
      await avail(guideA.id, d);
      await avail(guideB.id, d);
      await avail(guideC.id, d);
    }

    const { data: subj } = await svc
      .from("subjects")
      .insert({ name: `PR10D Subj ${SFX}`, category: "math", is_active: true })
      .select("id")
      .single();
    subjectOnlyB = subj?.id ?? null;
    if (subjectOnlyB) {
      await svc.from("tutor_subjects").insert({ tutor_id: guideB.id, subject_id: subjectOnlyB });
    }
  });

  after(async () => {
    for (const acc of accounts) {
      const { data: bks } = await svc.from("bookings").select("id").eq("account_id", acc);
      const ids = (bks ?? []).map((b) => b.id);
      if (ids.length) {
        await svc.from("tutor_cancellation_requests").delete().in("booking_id", ids);
        await svc.from("tutor_earnings").delete().in("booking_id", ids);
        await svc.from("bookings").delete().in("id", ids);
      }
      await svc.from("students").delete().eq("account_id", acc);
    }
    if (subjectOnlyB) {
      await svc.from("tutor_subjects").delete().eq("subject_id", subjectOnlyB);
      await svc.from("subjects").delete().eq("id", subjectOnlyB);
    }
    await cleanupAll();
  });

  it("skips when migration 0026 is not applied", { skip: false }, () => {
    assert.equal(applied, true, "migration 0026 must be applied for live reassignment tests");
  });

  it("A: cancel with one eligible replacement → automatically reassigns", async () => {
    if (!applied) return;
    const studentId = await newStudent(parent.id, "AutoKid");
    const start = futureUtc(20, 14);
    const end = new Date(start.getTime() + 60 * 60000);
    // Only A and B available; assign A; B is free → auto picks B.
    await clearAvail(guideC.id);
    const b = await confirmedBooking({
      tutorId: guideA.id,
      start,
      end,
      studentId,
      accountId: parent.id,
      first: "AutoKid",
    });
    const guideClient = await signIn(guideA.email, guideA.password);
    const req = await guideClient.rpc("request_tutor_cancellation", {
      p_booking: b.id,
      p_reason: "Conflict",
    });
    assert.equal(req.error, null, req.error?.message);
    const auto = await svc.rpc("try_auto_reassign_booking", { p_booking: b.id });
    assert.equal(auto.error, null, auto.error?.message);
    assert.equal(auto.data.status, "reassigned");
    assert.equal(auto.data.from_tutor, guideA.id);
    assert.equal(auto.data.to_tutor, guideB.id);
    const { data: after } = await svc.from("bookings").select("*").eq("id", b.id).single();
    assert.equal(after.tutor_id, guideB.id);
    assert.equal(after.scheduled_start, b.scheduled_start);
    assert.equal(after.scheduled_end, b.scheduled_end);
    assert.equal(after.payment_status, "paid");
    assert.equal(after.status, "confirmed");
    const { data: tcr } = await svc
      .from("tutor_cancellation_requests")
      .select("status")
      .eq("booking_id", b.id)
      .maybeSingle();
    assert.equal(tcr?.status, "resolved");
    // restore C availability for later tests
    for (let d = 0; d < 7; d++) await avail(guideC.id, d);
  });

  it("B/D: approved but only partially available → NOT eligible", async () => {
    if (!applied) return;
    const studentId = await newStudent(parent.id, "PartialKid");
    const start = futureUtc(21, 15);
    const end = new Date(start.getTime() + 120 * 60000); // 2h
    const dow = start.getUTCDay();
    // B available only first hour of the window
    await clearAvail(guideB.id);
    await avail(guideB.id, dow, "15:00", "16:00");
    await clearAvail(guideC.id);
    const b = await confirmedBooking({
      tutorId: guideA.id,
      start,
      end,
      duration: 120,
      studentId,
      accountId: parent.id,
    });
    const { data: cands } = await adminC.rpc("list_reassignment_candidates", { p_booking: b.id });
    const ids = (cands ?? []).map((c) => c.candidate_tutor_id ?? c.tutor_id);
    assert.equal(ids.includes(guideB.id), false, "partial window Guide must not be listed");
    const bad = await adminC.rpc("admin_reassign_tutor", {
      p_booking: b.id,
      p_new_tutor: guideB.id,
      p_reason: "try partial",
    });
    assert.ok(bad.error, "partial availability must be rejected");
    for (let d = 0; d < 7; d++) {
      await avail(guideB.id, d);
      await avail(guideC.id, d);
    }
  });

  it("C: overlapping booking → NOT eligible", async () => {
    if (!applied) return;
    const studentId = await newStudent(parent.id, "OverlapKid");
    const start = futureUtc(22, 16);
    const end = new Date(start.getTime() + 60 * 60000);
    const b1 = await confirmedBooking({
      tutorId: guideA.id,
      start,
      end,
      studentId,
      accountId: parent.id,
      first: "Overlap1",
    });
    // B already booked on same slot
    const student2 = await newStudent(parent.id, "Overlap2");
    await confirmedBooking({
      tutorId: guideB.id,
      start,
      end,
      studentId: student2,
      accountId: parent.id,
      first: "Overlap2",
    });
    const { data: cands } = await adminC.rpc("list_reassignment_candidates", { p_booking: b1.id });
    assert.equal((cands ?? []).some((c) => (c.candidate_tutor_id ?? c.tutor_id) === guideB.id), false);
    const conflict = await adminC.rpc("admin_reassign_tutor", {
      p_booking: b1.id,
      p_new_tutor: guideB.id,
      p_reason: "overlap",
    });
    assert.ok(conflict.error, "overlap rejected");
  });

  it("E: original cancelling Guide is excluded", async () => {
    if (!applied) return;
    const studentId = await newStudent(parent.id, "ExcludeKid");
    const start = futureUtc(23, 10);
    const end = new Date(start.getTime() + 60 * 60000);
    const b = await confirmedBooking({
      tutorId: guideA.id,
      start,
      end,
      studentId,
      accountId: parent.id,
    });
    const { data: cands } = await adminC.rpc("list_reassignment_candidates", { p_booking: b.id });
    assert.equal((cands ?? []).some((c) => (c.candidate_tutor_id ?? c.tutor_id) === guideA.id), false);
  });

  it("F: subject expertise differs → still eligible (subjects irrelevant)", async () => {
    if (!applied) return;
    const studentId = await newStudent(parent.id, "SubjKid");
    const start = futureUtc(24, 11);
    const end = new Date(start.getTime() + 60 * 60000);
    // Booking has no subject (Study Hall). Guide C has no tutor_subjects rows.
    // Guide B has a specialty subject — both must still be eligible.
    await clearAvail(guideA.id); // only so list is cleaner; A is current anyway
    const b = await confirmedBooking({
      tutorId: guideA.id,
      start,
      end,
      studentId,
      accountId: parent.id,
    });
    // Ensure subject_id stays null
    await svc.from("bookings").update({ subject_id: null }).eq("id", b.id);
    const { data: cands, error } = await adminC.rpc("list_reassignment_candidates", { p_booking: b.id });
    assert.equal(error, null, error?.message);
    const ids = (cands ?? []).map((c) => c.candidate_tutor_id ?? c.tutor_id);
    assert.equal(ids.includes(guideC.id), true, "Guide without specialty still eligible");
    assert.equal(ids.includes(guideB.id), true, "Guide with unrelated specialty still eligible");
    for (let d = 0; d < 7; d++) await avail(guideA.id, d);
  });

  it("G/H/I/J: successful reassignment preserves parent booking; PR8 silent parent; Guide sees assignment", async () => {
    if (!applied) return;
    const studentId = await newStudent(parent.id, "NotifyKid");
    const start = futureUtc(25, 12);
    const end = new Date(start.getTime() + 60 * 60000);
    const b = await confirmedBooking({
      tutorId: guideA.id,
      start,
      end,
      studentId,
      accountId: parent.id,
      first: "NotifyKid",
    });
    const before = { ...b };
    const auto = await svc.rpc("try_auto_reassign_booking", { p_booking: b.id });
    assert.equal(auto.data.status, "reassigned");
    const { data: after } = await svc
      .from("bookings")
      .select("tutor_id, scheduled_start, scheduled_end, status, payment_status, price_cents, student_id, account_id")
      .eq("id", b.id)
      .single();
    assert.equal(after.scheduled_start, before.scheduled_start);
    assert.equal(after.scheduled_end, before.scheduled_end);
    assert.equal(after.status, before.status);
    assert.equal(after.payment_status, before.payment_status);
    assert.equal(after.price_cents, before.price_cents);
    assert.equal(after.student_id, before.student_id);
    assert.equal(after.account_id, before.account_id);
    assert.notEqual(after.tutor_id, guideA.id);

    const replacement = after.tutor_id === guideB.id ? guideB : after.tutor_id === guideC.id ? guideC : null;
    assert.ok(replacement);
    const gClient = await signIn(replacement.email, replacement.password);
    const { data: visible } = await gClient.from("bookings").select("id").eq("id", b.id);
    assert.equal((visible ?? []).length, 1);

    // Policy: parent silent on success
    assert.equal(parentSilentOnSuccessfulReassignment(true), true);
  });

  it("K: no eligible replacement → needs_admin; TCR stays open", async () => {
    if (!applied) return;
    const studentId = await newStudent(parent.id, "FailKid");
    const start = futureUtc(26, 13);
    const end = new Date(start.getTime() + 60 * 60000);
    await clearAvail(guideB.id);
    await clearAvail(guideC.id);
    const b = await confirmedBooking({
      tutorId: guideA.id,
      start,
      end,
      studentId,
      accountId: parent.id,
    });
    const guideClient = await signIn(guideA.email, guideA.password);
    const req = await guideClient.rpc("request_tutor_cancellation", {
      p_booking: b.id,
      p_reason: "Sick",
    });
    assert.equal(req.error, null, req.error?.message);
    const auto = await svc.rpc("try_auto_reassign_booking", { p_booking: b.id });
    assert.equal(auto.data.status, "needs_admin");
    assert.equal(auto.data.reason, "no_eligible_guide");
    const { data: after } = await svc.from("bookings").select("tutor_id, status").eq("id", b.id).single();
    assert.equal(after.tutor_id, guideA.id, "booking unchanged when auto fails");
    assert.equal(after.status, "confirmed");
    const { data: tcr } = await svc
      .from("tutor_cancellation_requests")
      .select("status")
      .eq("booking_id", b.id)
      .eq("status", "open")
      .maybeSingle();
    assert.ok(tcr, "open cancellation request surfaces coverage failure");
    for (let d = 0; d < 7; d++) {
      await avail(guideB.id, d);
      await avail(guideC.id, d);
    }
  });

  it("L: manual reassignment cannot select unavailable Guide", async () => {
    if (!applied) return;
    const studentId = await newStudent(parent.id, "ManualKid");
    const start = futureUtc(27, 9);
    const end = new Date(start.getTime() + 60 * 60000);
    await clearAvail(guideB.id);
    const b = await confirmedBooking({
      tutorId: guideA.id,
      start,
      end,
      studentId,
      accountId: parent.id,
    });
    const { data: cands } = await adminC.rpc("list_reassignment_candidates", { p_booking: b.id });
    assert.equal((cands ?? []).some((c) => (c.candidate_tutor_id ?? c.tutor_id) === guideB.id), false);
    const bad = await adminC.rpc("admin_reassign_tutor", {
      p_booking: b.id,
      p_new_tutor: guideB.id,
      p_reason: "manual bad",
    });
    assert.ok(bad.error);
    // Eligible C still works
    const ok = await adminC.rpc("admin_reassign_tutor", {
      p_booking: b.id,
      p_new_tutor: guideC.id,
      p_reason: "manual ok",
    });
    assert.equal(ok.error, null, ok.error?.message);
    assert.equal(ok.data.to_tutor, guideC.id);
    for (let d = 0; d < 7; d++) await avail(guideB.id, d);
  });

  it("M/N: bookings_no_tutor_overlap / exclusion still protects concurrent double-book", async () => {
    if (!applied) return;
    const studentId = await newStudent(parent.id, "RaceKid1");
    const student2 = await newStudent(parent.id, "RaceKid2");
    const start = futureUtc(28, 17);
    const end = new Date(start.getTime() + 60 * 60000);
    const b1 = await confirmedBooking({
      tutorId: guideA.id,
      start,
      end,
      studentId,
      accountId: parent.id,
      first: "Race1",
    });
    const b2 = await confirmedBooking({
      tutorId: guideB.id,
      start,
      end,
      studentId: student2,
      accountId: parent.id,
      first: "Race2",
    });
    // Both try to take C — first wins, second hits exclusion / availability fail.
    const r1 = await adminC.rpc("admin_reassign_tutor", {
      p_booking: b1.id,
      p_new_tutor: guideC.id,
      p_reason: "race1",
    });
    assert.equal(r1.error, null, r1.error?.message);
    const r2 = await adminC.rpc("admin_reassign_tutor", {
      p_booking: b2.id,
      p_new_tutor: guideC.id,
      p_reason: "race2",
    });
    assert.ok(r2.error, "second concurrent assign to same Guide must fail");
    // Direct overlap insert must still violate GiST
    const clash = await svc.from("bookings").insert({
      student_id: studentId,
      account_id: parent.id,
      tutor_id: guideC.id,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      duration_minutes: 60,
      status: "confirmed",
      payment_status: "paid",
      price_cents: 1200,
      is_free_trial: false,
      student_first_name: "Clash",
      tutor_display_name: "C",
    });
    assert.ok(clash.error, "bookings_no_tutor_overlap still enforced");
  });
});
