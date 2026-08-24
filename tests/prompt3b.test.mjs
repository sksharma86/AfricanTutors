import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, anonClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;
const SFX = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

async function newSubject(name, category = "other") {
  const { data, error } = await svc.from("subjects").insert({ name: `${name} ${SFX}`, category }).select("id").single();
  if (error) throw new Error("newSubject: " + error.message);
  return data.id;
}
async function approveTutor(id, tz = "UTC") {
  await svc.from("tutor_profiles").update({ status: "approved", timezone: tz }).eq("profile_id", id);
  await svc.from("profiles").update({ role: "tutor" }).eq("id", id);
}
async function qualify(tutorId, subjectId) {
  const { error } = await svc.from("tutor_subjects").insert({ tutor_id: tutorId, subject_id: subjectId });
  if (error) throw new Error("qualify: " + error.message);
}
async function avail(tutorId, dow, start, end) {
  const { error } = await svc.from("tutor_availability").insert({ tutor_id: tutorId, day_of_week: dow, start_time: start, end_time: end });
  if (error) throw new Error("avail: " + error.message);
}
async function newStudent(accountId, name, tz = "America/Chicago") {
  const { data, error } = await svc.from("students").insert({ account_id: accountId, full_name: name, grade_level: "9", timezone: tz }).select("id").single();
  if (error) throw new Error("newStudent: " + error.message);
  return data.id;
}
async function seedBooking({ studentId, accountId, tutorId, subjectId, start, minutes = 30, status = "confirmed" }) {
  const end = new Date(new Date(start).getTime() + minutes * 60000).toISOString();
  const { error } = await svc.from("bookings").insert({
    student_id: studentId, account_id: accountId, tutor_id: tutorId, subject_id: subjectId,
    scheduled_start: start, scheduled_end: end, duration_minutes: minutes, price_cents: 1200,
    status, is_free_trial: false, subject_name: "seed", tutor_display_name: "seed",
  });
  if (error) throw new Error("seedBooking: " + error.message);
}
function futureUtc(days, hour, min = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, min, 0, 0);
  return d;
}
const book = (client, args) => client.rpc("create_booking", {
  p_student_id: args.studentId, p_subject_id: args.subjectId ?? null, p_other_subject: args.other ?? null,
  p_request_note: args.note ?? null, p_duration: args.duration, p_start: args.start ?? null,
  p_is_free_trial: args.free ?? false,
});

describe("Prompt 3B — booking engine hardening (live)", { skip: !hasSupabaseEnv }, () => {
  let parent, parent2, admin;
  let tutorA, tutorB, tutorSlot, tutorConf, tutorChi;
  let stuA, stuB, stu2;
  let subjMain, subjSlot, subjConf, subjChi;

  before(async () => {
    parent = await createUser({ requestedRole: "student", displayName: "Parent One" });
    parent2 = await createUser({ requestedRole: "student", displayName: "Parent Two" });
    admin = await createUser({ requestedRole: "student", displayName: "Admin" });
    await makeAdmin(admin.id);

    tutorA = await createUser({ requestedRole: "tutor", displayName: "Tutor A" });
    tutorB = await createUser({ requestedRole: "tutor", displayName: "Tutor B" });
    tutorSlot = await createUser({ requestedRole: "tutor", displayName: "Tutor Slot" });
    tutorConf = await createUser({ requestedRole: "tutor", displayName: "Tutor Conf" });
    tutorChi = await createUser({ requestedRole: "tutor", displayName: "Tutor Chi" });
    for (const t of [tutorA, tutorB, tutorSlot, tutorConf]) await approveTutor(t.id, "UTC");
    await approveTutor(tutorChi.id, "America/Chicago");

    stuA = await newStudent(parent.id, "Kid A");
    stuB = await newStudent(parent.id, "Kid B");
    stu2 = await newStudent(parent2.id, "Kid Two");

    subjMain = await newSubject("Main", "math");
    subjSlot = await newSubject("SlotMath", "other");
    subjConf = await newSubject("Conflict", "other");
    subjChi = await newSubject("Chicago", "other");

    await qualify(tutorA.id, subjMain);
    await qualify(tutorB.id, subjMain);
    await qualify(tutorSlot.id, subjSlot);
    await qualify(tutorConf.id, subjConf);
    await qualify(tutorChi.id, subjChi);

    // Wide availability for matching/conflict tutors (every day 06:00-23:00 UTC).
    for (let d = 0; d < 7; d++) {
      await avail(tutorA.id, d, "06:00", "23:00");
      await avail(tutorB.id, d, "06:00", "23:00");
      await avail(tutorConf.id, d, "06:00", "23:00");
      await avail(tutorChi.id, d, "12:00", "20:00"); // local Chicago hours
    }
    // tutorSlot: single narrow block 17:00-19:00 on the dow of a target day.
    const slotDay = futureUtc(5, 17);
    await avail(tutorSlot.id, slotDay.getUTCDay(), "17:00", "19:00");
  });

  after(async () => {
    for (const s of [subjMain, subjSlot, subjConf, subjChi]) await svc.from("subjects").delete().eq("id", s);
    await cleanupAll();
  });

  it("30-min slot math: 17:00-19:00 yields 17:00/17:30/18:00/18:30", async () => {
    const c = await signIn(parent.email, parent.password);
    const day = futureUtc(5, 0);
    const from = day.toISOString();
    const to = futureUtc(6, 0).toISOString();
    const { data } = await c.rpc("get_available_slots", { p_subject_id: subjSlot, p_duration: 30, p_from: from, p_to: to });
    const hoursMin = data.map((r) => new Date(r.slot_start).toISOString().slice(11, 16)).sort();
    assert.deepEqual(hoursMin, ["17:00", "17:30", "18:00", "18:30"]);
  });

  it("60-min slot math: 17:00-19:00 yields 17:00/17:30/18:00 (no 18:30)", async () => {
    const c = await signIn(parent.email, parent.password);
    const from = futureUtc(5, 0).toISOString();
    const to = futureUtc(6, 0).toISOString();
    const { data } = await c.rpc("get_available_slots", { p_subject_id: subjSlot, p_duration: 60, p_from: from, p_to: to });
    const hoursMin = data.map((r) => new Date(r.slot_start).toISOString().slice(11, 16)).sort();
    assert.deepEqual(hoursMin, ["17:00", "17:30", "18:00"]);
  });

  it("configurable slot interval (60-min interval) yields 17:00/18:00 for 30-min sessions", async () => {
    const c = await signIn(parent.email, parent.password);
    const from = futureUtc(5, 0).toISOString();
    const to = futureUtc(6, 0).toISOString();
    const { data } = await c.rpc("get_available_slots", { p_subject_id: subjSlot, p_duration: 30, p_from: from, p_to: to, p_slot_minutes: 60 });
    const hoursMin = data.map((r) => new Date(r.slot_start).toISOString().slice(11, 16)).sort();
    assert.deepEqual(hoursMin, ["17:00", "18:00"]);
  });

  it("matching assigns only an approved+qualified tutor", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data: id, error } = await book(c, { studentId: stuA, subjectId: subjMain, duration: 30, start: futureUtc(7, 8).toISOString() });
    assert.equal(error, null, error && error.message);
    const { data: b } = await svc.from("bookings").select("tutor_id").eq("id", id).single();
    assert.ok([tutorA.id, tutorB.id].includes(b.tutor_id));
  });

  it("repeat-tutor preference: same student + same subject completed → same tutor", async () => {
    // seed a completed prior session with tutorA for subjMain
    await seedBooking({ studentId: stuB, accountId: parent.id, tutorId: tutorA.id, subjectId: subjMain, start: futureUtc(-3, 10).toISOString(), status: "completed" });
    const c = await signIn(parent.email, parent.password);
    const { data: id } = await book(c, { studentId: stuB, subjectId: subjMain, duration: 30, start: futureUtc(7, 9).toISOString() });
    const { data: b } = await svc.from("bookings").select("tutor_id").eq("id", id).single();
    assert.equal(b.tutor_id, tutorA.id, "should prefer the repeat tutor A");
  });

  it("repeat-tutor fallback: if repeat tutor unavailable, assign another eligible tutor", async () => {
    const slot = futureUtc(8, 14);
    // block tutorA at the slot via exception
    await svc.from("tutor_availability_exceptions").insert({ tutor_id: tutorA.id, starts_at: slot.toISOString(), ends_at: new Date(slot.getTime() + 30 * 60000).toISOString() });
    const c = await signIn(parent.email, parent.password);
    const { data: id, error } = await book(c, { studentId: stuB, subjectId: subjMain, duration: 30, start: slot.toISOString() });
    assert.equal(error, null, error && error.message);
    const { data: b } = await svc.from("bookings").select("tutor_id").eq("id", id).single();
    assert.equal(b.tutor_id, tutorB.id, "should fall back to tutor B");
  });

  it("fair workload: a new student (no repeat) is assigned the less-loaded tutor", async () => {
    // load tutorA with two future confirmed bookings
    await seedBooking({ studentId: stu2, accountId: parent2.id, tutorId: tutorA.id, subjectId: subjMain, start: futureUtc(9, 6).toISOString() });
    await seedBooking({ studentId: stu2, accountId: parent2.id, tutorId: tutorA.id, subjectId: subjMain, start: futureUtc(9, 7).toISOString() });
    const c = await signIn(parent2.email, parent2.password);
    const { data: id, error } = await book(c, { studentId: stu2, subjectId: subjMain, duration: 30, start: futureUtc(9, 15).toISOString() });
    assert.equal(error, null, error && error.message);
    const { data: b } = await svc.from("bookings").select("tutor_id").eq("id", id).single();
    assert.equal(b.tutor_id, tutorB.id, "less-loaded tutor B should be chosen");
  });

  it("free trial: created at $0 / not_required; second rejected; 30-min rejected", async () => {
    const c = await signIn(parent2.email, parent2.password);
    const { data: id, error } = await book(c, { studentId: stu2, subjectId: subjMain, duration: 60, start: futureUtc(10, 12).toISOString(), free: true });
    assert.equal(error, null, error && error.message);
    const { data: b } = await svc.from("bookings").select("price_cents, payment_status, is_free_trial, duration_minutes").eq("id", id).single();
    assert.equal(b.price_cents, 0);
    assert.equal(b.payment_status, "not_required");
    assert.equal(b.is_free_trial, true);
    assert.equal(b.duration_minutes, 60);
    const second = await book(c, { studentId: stu2, subjectId: subjMain, duration: 60, start: futureUtc(10, 13).toISOString(), free: true });
    assert.ok(second.error, "second free trial rejected");
    const thirty = await book(c, { studentId: stuA, subjectId: subjMain, duration: 30, start: futureUtc(10, 14).toISOString(), free: true });
    assert.ok(thirty.error, "30-min free trial rejected");
  });

  it("paid price integrity: 30-min = $12, 60-min = $12 (server-derived)", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data: id30 } = await book(c, { studentId: stuA, subjectId: subjMain, duration: 30, start: futureUtc(11, 8).toISOString() });
    const { data: id60 } = await book(c, { studentId: stuA, subjectId: subjMain, duration: 60, start: futureUtc(11, 10).toISOString() });
    const { data: b30 } = await svc.from("bookings").select("price_cents, payment_status").eq("id", id30).single();
    const { data: b60 } = await svc.from("bookings").select("price_cents, payment_status").eq("id", id60).single();
    assert.equal(b30.price_cents, 1200);
    assert.equal(b30.payment_status, "awaiting_payment");
    assert.equal(b60.price_cents, 1200);
  });

  it("price tampering: client cannot insert a booking directly (RLS)", async () => {
    const c = await signIn(parent.email, parent.password);
    const { error } = await c.from("bookings").insert({
      student_id: stuA, account_id: parent.id, subject_id: subjMain, duration_minutes: 30,
      scheduled_start: futureUtc(12, 8).toISOString(), scheduled_end: futureUtc(12, 8, 30).toISOString(),
      price_cents: 1, status: "confirmed",
    });
    assert.ok(error, "direct booking insert must be denied");
  });

  it("student cannot mark a booking paid or change owner (admin-only updates)", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data: mine } = await c.from("bookings").select("id, payment_status").eq("account_id", parent.id).limit(1);
    assert.ok(mine.length > 0);
    await c.from("bookings").update({ payment_status: "paid" }).eq("id", mine[0].id);
    await c.from("bookings").update({ account_id: parent2.id }).eq("id", mine[0].id);
    const { data: check } = await svc.from("bookings").select("payment_status, account_id").eq("id", mine[0].id).single();
    assert.notEqual(check.payment_status, "paid");
    assert.equal(check.account_id, parent.id);
  });

  it("student cannot book for a student they do not own", async () => {
    const c = await signIn(parent2.email, parent2.password);
    const { error } = await book(c, { studentId: stuA, subjectId: subjMain, duration: 30, start: futureUtc(12, 9).toISOString() });
    assert.ok(error, "must not book for another account's student");
  });

  it("double-booking: exact, partial, and 60-over-30 overlaps are rejected; back-to-back allowed", async () => {
    const c = await signIn(parent.email, parent.password);
    const t = futureUtc(13, 15);
    const okBase = await book(c, { studentId: stuA, subjectId: subjConf, duration: 30, start: t.toISOString() }); // 15:00-15:30
    assert.equal(okBase.error, null, okBase.error && okBase.error.message);
    // exact overlap (only tutorConf eligible → no tutor free)
    const exact = await book(c, { studentId: stuB, subjectId: subjConf, duration: 30, start: t.toISOString() });
    assert.ok(exact.error, "exact overlap rejected");
    // partial overlap 15:15-15:45
    const partial = await book(c, { studentId: stuB, subjectId: subjConf, duration: 30, start: new Date(t.getTime() + 15 * 60000).toISOString() });
    assert.ok(partial.error, "partial overlap rejected");
    // 60-min covering 14:45-15:45 overlaps 15:00-15:30
    const sixtyOver = await book(c, { studentId: stuB, subjectId: subjConf, duration: 60, start: new Date(t.getTime() - 15 * 60000).toISOString() });
    assert.ok(sixtyOver.error, "60-over-30 overlap rejected");
    // back-to-back 15:30-16:00 allowed
    const backToBack = await book(c, { studentId: stuB, subjectId: subjConf, duration: 30, start: new Date(t.getTime() + 30 * 60000).toISOString() });
    assert.equal(backToBack.error, null, "adjacent booking should succeed");
  });

  it("concurrent booking of the same last slot: exactly one succeeds", async () => {
    const c1 = await signIn(parent.email, parent.password);
    const c2 = await signIn(parent2.email, parent2.password);
    const t = futureUtc(14, 16).toISOString();
    const [r1, r2] = await Promise.all([
      book(c1, { studentId: stuA, subjectId: subjConf, duration: 30, start: t }),
      book(c2, { studentId: stu2, subjectId: subjConf, duration: 30, start: t }),
    ]);
    const wins = [r1, r2].filter((r) => !r.error && r.data).length;
    assert.equal(wins, 1);
  });

  it("timezone + DST: Chicago 17:00 local = 22:00 UTC in summer, 23:00 UTC in winter", async () => {
    const c = await signIn(parent.email, parent.password);
    async function utcHourForLocal17(dateStr) {
      const from = new Date(dateStr + "T00:00:00Z").toISOString();
      const to = new Date(dateStr + "T23:30:00Z").toISOString();
      const { data } = await c.rpc("get_available_slots", { p_subject_id: subjChi, p_duration: 30, p_from: from, p_to: to });
      for (const r of data) {
        const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false, day: "2-digit", month: "2-digit" });
        const parts = fmt.formatToParts(new Date(r.slot_start));
        const localHour = Number(parts.find((p) => p.type === "hour")?.value);
        if (localHour === 17) return new Date(r.slot_start).getUTCHours();
      }
      return null;
    }
    const summer = await utcHourForLocal17("2026-07-15"); // CDT = UTC-5
    const winter = await utcHourForLocal17("2027-01-15"); // CST = UTC-6
    assert.equal(summer, 22, "17:00 CDT should be 22:00 UTC");
    assert.equal(winter, 23, "17:00 CST should be 23:00 UTC");
  });

  it("anonymous users cannot call the booking engine", async () => {
    const anon = anonClient();
    const slots = await anon.rpc("get_available_slots", { p_subject_id: subjMain, p_duration: 30, p_from: futureUtc(3, 0).toISOString(), p_to: futureUtc(4, 0).toISOString() });
    assert.ok(slots.error, "anon get_available_slots must be denied");
    const booked = await anon.rpc("create_booking", { p_student_id: stuA, p_subject_id: subjMain, p_other_subject: null, p_request_note: null, p_duration: 30, p_start: futureUtc(3, 12).toISOString(), p_is_free_trial: false });
    assert.ok(booked.error, "anon create_booking must be denied");
  });

  it("Other subject request: creates a pending admin-review request with no tutor", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data: id, error } = await book(c, { studentId: stuA, subjectId: null, other: "AP Statistics review", duration: 30 });
    assert.equal(error, null, error && error.message);
    const { data: b } = await svc.from("bookings").select("status, tutor_id, subject_id, other_subject_text").eq("id", id).single();
    assert.equal(b.status, "pending");
    assert.equal(b.tutor_id, null);
    assert.equal(b.subject_id, null);
    assert.equal(b.other_subject_text, "AP Statistics review");
  });
});
