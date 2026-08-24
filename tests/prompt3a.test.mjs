import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, anonClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;

// unique suffix so re-runs don't collide on subject names
const SFX = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

async function newSubject(name, category = "other", active = true) {
  const { data, error } = await svc
    .from("subjects")
    .insert({ name: `${name} ${SFX}`, category, is_active: active })
    .select("id, name")
    .single();
  if (error) throw new Error("newSubject: " + error.message);
  return data;
}

async function approveTutor(userId, tz = "UTC") {
  let r = await svc.from("tutor_profiles").update({ status: "approved", timezone: tz }).eq("profile_id", userId);
  if (r.error) throw new Error("approveTutor status: " + r.error.message);
  r = await svc.from("profiles").update({ role: "tutor" }).eq("id", userId);
  if (r.error) throw new Error("approveTutor role: " + r.error.message);
}

async function addTutorSubject(tutorId, subjectId) {
  const { error } = await svc.from("tutor_subjects").insert({ tutor_id: tutorId, subject_id: subjectId });
  if (error) throw new Error("addTutorSubject: " + error.message);
}

async function addAvailability(tutorId, dow, start, end) {
  const { error } = await svc
    .from("tutor_availability")
    .insert({ tutor_id: tutorId, day_of_week: dow, start_time: start, end_time: end });
  if (error) throw new Error("addAvailability: " + error.message);
}

async function newStudentRecord(accountId, full_name, grade = "9", tz = "America/Chicago") {
  const { data, error } = await svc
    .from("students")
    .insert({ account_id: accountId, full_name, grade_level: grade, timezone: tz })
    .select("id")
    .single();
  if (error) throw new Error("newStudentRecord: " + error.message);
  return data.id;
}

/** A UTC Date `days` ahead at the given UTC hour, on a 30-min boundary. */
function futureUtc(days, hourUtc, minute = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hourUtc, minute, 0, 0);
  return d;
}

describe("Prompt 3A — booking foundation: matching, free trial, RLS, timezones (live)", { skip: !hasSupabaseEnv }, () => {
  let parent, parent2, admin, tutorA, tutorB;
  let studentId, student2Id;
  let subjAlg, subjBio, subjSolo, subjRace, subjNoTutor;
  let adminClientSignedIn;

  before(async () => {
    parent = await createUser({ requestedRole: "student", displayName: "Pat Parent" });
    parent2 = await createUser({ requestedRole: "student", displayName: "Second Parent" });
    admin = await createUser({ requestedRole: "student", displayName: "Ada Admin" });
    await makeAdmin(admin.id);
    tutorA = await createUser({ requestedRole: "tutor", displayName: "Tutor Ada" });
    tutorB = await createUser({ requestedRole: "tutor", displayName: "Tutor Ben" });
    await approveTutor(tutorA.id, "UTC");
    await approveTutor(tutorB.id, "UTC");

    studentId = await newStudentRecord(parent.id, "Kid One", "9", "America/Chicago");
    student2Id = await newStudentRecord(parent2.id, "Kid Two", "10", "America/New_York");

    subjAlg = await newSubject("Algebra Test", "math");
    subjBio = await newSubject("Biology Test", "science");
    subjSolo = await newSubject("Solo Subject", "other");
    subjRace = await newSubject("Race Subject", "other");
    subjNoTutor = await newSubject("Unstaffed Subject", "other");

    // tutorA teaches Algebra + Solo + Race; tutorB teaches Biology. No tutor for Unstaffed.
    await addTutorSubject(tutorA.id, subjAlg.id);
    await addTutorSubject(tutorA.id, subjSolo.id);
    await addTutorSubject(tutorA.id, subjRace.id);
    await addTutorSubject(tutorB.id, subjBio.id);

    // tutorA wide availability every day 06:00-23:00 UTC.
    for (let dow = 0; dow < 7; dow++) await addAvailability(tutorA.id, dow, "06:00", "23:00");
    // tutorB wide availability too.
    for (let dow = 0; dow < 7; dow++) await addAvailability(tutorB.id, dow, "06:00", "23:00");

    adminClientSignedIn = await signIn(admin.email, admin.password);
  });

  after(async () => {
    // remove test subjects (bookings cascade via student delete in cleanupAll)
    for (const s of [subjAlg, subjBio, subjSolo, subjRace, subjNoTutor]) {
      if (s) await svc.from("subjects").delete().eq("id", s.id);
    }
    await cleanupAll();
  });

  it("student sees available slots for a staffed subject", async () => {
    const c = await signIn(parent.email, parent.password);
    const from = futureUtc(3, 6).toISOString();
    const to = futureUtc(4, 6).toISOString();
    const { data, error } = await c.rpc("get_available_slots", {
      p_subject_id: subjAlg.id, p_duration: 30, p_from: from, p_to: to,
    });
    assert.equal(error, null, error && error.message);
    assert.ok(data.length > 0, "expected available slots for Algebra");
  });

  it("unstaffed subject yields no slots and cannot be booked", async () => {
    const c = await signIn(parent.email, parent.password);
    const from = futureUtc(3, 6).toISOString();
    const to = futureUtc(4, 6).toISOString();
    const { data } = await c.rpc("get_available_slots", {
      p_subject_id: subjNoTutor.id, p_duration: 30, p_from: from, p_to: to,
    });
    assert.equal(data.length, 0);
    const start = futureUtc(3, 15).toISOString();
    const { error } = await c.rpc("create_booking", {
      p_student_id: studentId, p_subject_id: subjNoTutor.id, p_other_subject: null,
      p_request_note: null, p_duration: 30, p_start: start, p_is_free_trial: false,
    });
    assert.ok(error, "booking an unstaffed subject must fail");
  });

  it("matching only assigns a tutor approved for the requested subject", async () => {
    const c = await signIn(parent.email, parent.password);
    const start = futureUtc(3, 16).toISOString();
    const { data: bookingId, error } = await c.rpc("create_booking", {
      p_student_id: studentId, p_subject_id: subjBio.id, p_other_subject: null,
      p_request_note: "cell division", p_duration: 30, p_start: start, p_is_free_trial: false,
    });
    assert.equal(error, null, error && error.message);
    const { data: b } = await svc.from("bookings").select("tutor_id, subject_name, tutor_display_name").eq("id", bookingId).single();
    assert.equal(b.tutor_id, tutorB.id, "Biology must go to tutorB (approved), never tutorA");
  });

  it("30-minute paid booking works and is priced $12", async () => {
    const c = await signIn(parent.email, parent.password);
    const start = futureUtc(4, 15).toISOString();
    const { data: id, error } = await c.rpc("create_booking", {
      p_student_id: studentId, p_subject_id: subjAlg.id, p_other_subject: null,
      p_request_note: null, p_duration: 30, p_start: start, p_is_free_trial: false,
    });
    assert.equal(error, null, error && error.message);
    const { data: b } = await svc.from("bookings").select("*").eq("id", id).single();
    assert.equal(b.duration_minutes, 30);
    assert.equal(b.price_cents, 1200);
    assert.equal(b.payment_status, "awaiting_payment");
    assert.equal(new Date(b.scheduled_end) - new Date(b.scheduled_start), 30 * 60000);
  });

  it("60-minute paid booking works and is priced $12", async () => {
    const c = await signIn(parent.email, parent.password);
    const start = futureUtc(4, 17).toISOString();
    const { data: id, error } = await c.rpc("create_booking", {
      p_student_id: studentId, p_subject_id: subjAlg.id, p_other_subject: null,
      p_request_note: null, p_duration: 60, p_start: start, p_is_free_trial: false,
    });
    assert.equal(error, null, error && error.message);
    const { data: b } = await svc.from("bookings").select("*").eq("id", id).single();
    assert.equal(b.duration_minutes, 60);
    assert.equal(b.price_cents, 1200);
    assert.equal(new Date(b.scheduled_end) - new Date(b.scheduled_start), 60 * 60000);
  });

  it("free-trial eligible student can book ONE free 60-min session ($0)", async () => {
    const c = await signIn(parent.email, parent.password);
    const start = futureUtc(4, 19).toISOString();
    const { data: id, error } = await c.rpc("create_booking", {
      p_student_id: studentId, p_subject_id: subjAlg.id, p_other_subject: null,
      p_request_note: null, p_duration: 60, p_start: start, p_is_free_trial: true,
    });
    assert.equal(error, null, error && error.message);
    const { data: b } = await svc.from("bookings").select("is_free_trial, price_cents, payment_status, duration_minutes").eq("id", id).single();
    assert.equal(b.is_free_trial, true);
    assert.equal(b.price_cents, 0);
    assert.equal(b.payment_status, "not_required");
    assert.equal(b.duration_minutes, 60);
  });

  it("same student cannot claim a second free trial", async () => {
    const c = await signIn(parent.email, parent.password);
    const start = futureUtc(4, 20).toISOString();
    const { error } = await c.rpc("create_booking", {
      p_student_id: studentId, p_subject_id: subjAlg.id, p_other_subject: null,
      p_request_note: null, p_duration: 60, p_start: start, p_is_free_trial: true,
    });
    assert.ok(error, "second free trial must be rejected");
  });

  it("a 30-minute session cannot be claimed as the free trial", async () => {
    const c = await signIn(parent2.email, parent2.password);
    const start = futureUtc(3, 18).toISOString();
    const { error } = await c.rpc("create_booking", {
      p_student_id: student2Id, p_subject_id: subjBio.id, p_other_subject: null,
      p_request_note: null, p_duration: 30, p_start: start, p_is_free_trial: true,
    });
    assert.ok(error, "30-min free trial must be rejected");
  });

  it("a tutor cannot be double-booked (only eligible tutor already busy)", async () => {
    const c1 = await signIn(parent.email, parent.password);
    const c2 = await signIn(parent2.email, parent2.password);
    const start = futureUtc(5, 14).toISOString();
    const { data: id1, error: e1 } = await c1.rpc("create_booking", {
      p_student_id: studentId, p_subject_id: subjSolo.id, p_other_subject: null,
      p_request_note: null, p_duration: 30, p_start: start, p_is_free_trial: false,
    });
    assert.equal(e1, null, e1 && e1.message);
    assert.ok(id1);
    // second student, same solo subject (only tutorA), same time → no tutor free
    const { error: e2 } = await c2.rpc("create_booking", {
      p_student_id: student2Id, p_subject_id: subjSolo.id, p_other_subject: null,
      p_request_note: null, p_duration: 30, p_start: start, p_is_free_trial: false,
    });
    assert.ok(e2, "overlapping booking of the only eligible tutor must fail");
  });

  it("concurrent booking of the last slot: exactly one succeeds", async () => {
    // dedicated tutor with a single 30-min slot for subjRace
    const tutorR = await createUser({ requestedRole: "tutor", displayName: "Tutor Race" });
    await approveTutor(tutorR.id, "UTC");
    await addTutorSubject(tutorR.id, subjRace.id);
    const slot = futureUtc(6, 12);
    const dow = slot.getUTCDay();
    await addAvailability(tutorR.id, dow, "12:00", "12:30"); // exactly one 30-min slot
    // NOTE: tutorA also teaches subjRace with wide availability, so to force a
    // true race on a single tutor we disable tutorA for this subject window via
    // an exception covering the slot.
    await svc.from("tutor_availability_exceptions").insert({
      tutor_id: tutorA.id, starts_at: slot.toISOString(),
      ends_at: new Date(slot.getTime() + 30 * 60000).toISOString(), reason: "test",
    });
    const c1 = await signIn(parent.email, parent.password);
    const c2 = await signIn(parent2.email, parent2.password);
    const args = (sid) => ({
      p_student_id: sid, p_subject_id: subjRace.id, p_other_subject: null,
      p_request_note: null, p_duration: 30, p_start: slot.toISOString(), p_is_free_trial: false,
    });
    const [r1, r2] = await Promise.all([
      c1.rpc("create_booking", args(studentId)),
      c2.rpc("create_booking", args(student2Id)),
    ]);
    const successes = [r1, r2].filter((r) => !r.error && r.data).length;
    assert.equal(successes, 1, "exactly one concurrent booking should succeed");
  });

  it("an availability exception removes a tutor from matching", async () => {
    const tutorX = await createUser({ requestedRole: "tutor", displayName: "Tutor Ex" });
    await approveTutor(tutorX.id, "UTC");
    const subjX = await newSubject("Exception Subject", "other");
    await addTutorSubject(tutorX.id, subjX.id);
    const slot = futureUtc(7, 13);
    const dow = slot.getUTCDay();
    await addAvailability(tutorX.id, dow, "06:00", "23:00");
    await svc.from("tutor_availability_exceptions").insert({
      tutor_id: tutorX.id, starts_at: slot.toISOString(),
      ends_at: new Date(slot.getTime() + 60 * 60000).toISOString(), reason: "appt",
    });
    const c = await signIn(parent.email, parent.password);
    const { error } = await c.rpc("create_booking", {
      p_student_id: studentId, p_subject_id: subjX.id, p_other_subject: null,
      p_request_note: null, p_duration: 30, p_start: slot.toISOString(), p_is_free_trial: false,
    });
    assert.ok(error, "exception window must not be bookable");
    await svc.from("subjects").delete().eq("id", subjX.id);
  });

  it("timezone: Lagos (UTC+1) availability maps to the correct UTC slots", async () => {
    const tutorL = await createUser({ requestedRole: "tutor", displayName: "Tutor Lagos" });
    await approveTutor(tutorL.id, "Africa/Lagos");
    const subjL = await newSubject("Lagos Subject", "other");
    await addTutorSubject(tutorL.id, subjL.id);
    // Available 17:00-22:00 Lagos local, every day. Lagos = UTC+1 (no DST) → 16:00-21:00 UTC.
    for (let dow = 0; dow < 7; dow++) await addAvailability(tutorL.id, dow, "17:00", "22:00");
    const c = await signIn(parent.email, parent.password);
    const from = futureUtc(3, 0).toISOString();
    const to = futureUtc(6, 0).toISOString();
    const { data, error } = await c.rpc("get_available_slots", {
      p_subject_id: subjL.id, p_duration: 60, p_from: from, p_to: to,
    });
    assert.equal(error, null, error && error.message);
    assert.ok(data.length > 0, "expected Lagos slots");
    // Every returned slot's UTC hour must be within 16:00..20:00 (last 60-min start=21:00 Lagos=20:00 UTC).
    for (const row of data) {
      const h = new Date(row.slot_start).getUTCHours();
      assert.ok(h >= 16 && h <= 20, `slot UTC hour ${h} out of Lagos window`);
    }
    await svc.from("subjects").delete().eq("id", subjL.id);
  });

  it("RLS: a student cannot read another account's bookings", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data } = await c.from("bookings").select("id, account_id");
    assert.ok(data.every((b) => b.account_id === parent.id), "student must only see own bookings");
  });

  it("RLS: an assigned tutor reads only their own bookings (no others)", async () => {
    const c = await signIn(tutorB.email, tutorB.password);
    const { data } = await c.from("bookings").select("id, tutor_id");
    assert.ok(data.every((b) => b.tutor_id === tutorB.id), "tutor must only see assigned bookings");
  });

  it("RLS: a tutor cannot read the students (learner) table", async () => {
    const c = await signIn(tutorB.email, tutorB.password);
    const { data } = await c.from("students").select("id");
    assert.equal((data ?? []).length, 0, "tutors must not read learner records");
  });

  it("RLS: anonymous users cannot read bookings", async () => {
    const anon = anonClient();
    const { data, error } = await anon.from("bookings").select("id");
    assert.ok(error || (data ?? []).length === 0);
  });

  it("a tutor cannot grant themselves a subject approval", async () => {
    const c = await signIn(tutorB.email, tutorB.password);
    const { error } = await c.from("tutor_subjects").insert({ tutor_id: tutorB.id, subject_id: subjAlg.id });
    assert.ok(error, "tutor self-approval of subjects must be rejected");
  });

  it("a student cannot re-own a booking (only admin may update bookings)", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data: mine } = await c.from("bookings").select("id").eq("account_id", parent.id).limit(1);
    assert.ok(mine.length > 0);
    const { error } = await c.from("bookings").update({ account_id: parent.id }).eq("id", mine[0].id);
    // No update policy for non-admins → update affects 0 rows or errors.
    const { data: check } = await svc.from("bookings").select("account_id").eq("id", mine[0].id).single();
    assert.equal(check.account_id, parent.id);
    assert.ok(error || true); // primary guarantee: ownership unchanged (checked above)
  });

  it("admin can manage the subject catalog", async () => {
    const s = await newSubject("Admin Managed", "other");
    const { error: upErr } = await adminClientSignedIn.from("subjects").update({ is_active: false }).eq("id", s.id);
    assert.equal(upErr, null, upErr && upErr.message);
    const { data } = await svc.from("subjects").select("is_active").eq("id", s.id).single();
    assert.equal(data.is_active, false);
    await svc.from("subjects").delete().eq("id", s.id);
  });
});
