import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

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
async function qualify(t, s) {
  const { error } = await svc.from("tutor_subjects").insert({ tutor_id: t, subject_id: s });
  if (error) throw new Error("qualify: " + error.message);
}
async function avail(t, dow, start, end) {
  const { error } = await svc.from("tutor_availability").insert({ tutor_id: t, day_of_week: dow, start_time: start, end_time: end });
  if (error) throw new Error("avail: " + error.message);
}
async function newStudent(acc, name, tz = "America/Chicago") {
  const { data, error } = await svc.from("students").insert({ account_id: acc, full_name: name, grade_level: "9", timezone: tz }).select("id").single();
  if (error) throw new Error("newStudent: " + error.message);
  return data.id;
}
function futureUtc(days, hour, min = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, min, 0, 0);
  return d;
}
const book = (c, a) => c.rpc("create_booking", {
  p_student_id: a.studentId, p_subject_id: a.subjectId ?? null, p_other_subject: a.other ?? null,
  p_request_note: a.note ?? null, p_duration: a.duration, p_start: a.start ?? null, p_is_free_trial: a.free ?? false,
});

describe("Prompt 3D — booking lifecycle hardening (live)", { skip: !hasSupabaseEnv }, () => {
  let parent, parent2, admin, tutorMain, tutorSolo, tutorLagos;
  let stuA, stuB, stu2, stuChi;
  let subjMain, subjSolo, subjLagos;

  before(async () => {
    parent = await createUser({ requestedRole: "student", displayName: "Parent One" });
    parent2 = await createUser({ requestedRole: "student", displayName: "Parent Two" });
    admin = await createUser({ requestedRole: "student", displayName: "Admin" });
    await makeAdmin(admin.id);
    tutorMain = await createUser({ requestedRole: "tutor", displayName: "Tutor Main" });
    tutorSolo = await createUser({ requestedRole: "tutor", displayName: "Tutor Solo" });
    tutorLagos = await createUser({ requestedRole: "tutor", displayName: "Tutor Lagos" });
    await approveTutor(tutorMain.id, "UTC");
    await approveTutor(tutorSolo.id, "UTC");
    await approveTutor(tutorLagos.id, "Africa/Lagos");

    stuA = await newStudent(parent.id, "Kid A");
    stuB = await newStudent(parent.id, "Kid B");
    stu2 = await newStudent(parent2.id, "Kid Two");
    stuChi = await newStudent(parent.id, "Chi Kid", "America/Chicago");

    subjMain = await newSubject("Main", "math");
    subjSolo = await newSubject("Solo", "other");
    subjLagos = await newSubject("Lagos", "other");
    await qualify(tutorMain.id, subjMain);
    await qualify(tutorSolo.id, subjSolo);
    await qualify(tutorLagos.id, subjLagos);
    for (let d = 0; d < 7; d++) {
      await avail(tutorMain.id, d, "06:00", "23:00");
      await avail(tutorSolo.id, d, "06:00", "23:00");
      await avail(tutorLagos.id, d, "17:00", "22:00"); // Lagos local
    }
  });

  after(async () => {
    for (const s of [subjMain, subjSolo, subjLagos]) await svc.from("subjects").delete().eq("id", s);
    await cleanupAll();
  });

  it("paid booking is created PENDING + awaiting_payment + a payment hold (not confirmed)", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data: id, error } = await book(c, { studentId: stuA, subjectId: subjMain, duration: 30, start: futureUtc(3, 8).toISOString() });
    assert.equal(error, null, error && error.message);
    const { data: b } = await svc.from("bookings").select("status, payment_status, payment_hold_expires_at").eq("id", id).single();
    assert.equal(b.status, "pending");
    assert.equal(b.payment_status, "awaiting_payment");
    assert.ok(b.payment_hold_expires_at, "paid booking must have a payment hold");
    const holdMs = new Date(b.payment_hold_expires_at).getTime() - Date.now();
    assert.ok(holdMs > 10 * 60000 && holdMs < 20 * 60000, "hold ~15 min");
  });

  it("free trial remains confirmed + not_required with no hold", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data: id, error } = await book(c, { studentId: stuA, subjectId: subjMain, duration: 30, start: futureUtc(3, 10).toISOString(), free: true });
    assert.equal(error, null, error && error.message);
    const { data: b } = await svc.from("bookings").select("status, payment_status, payment_hold_expires_at, price_cents").eq("id", id).single();
    assert.equal(b.status, "confirmed");
    assert.equal(b.payment_status, "not_required");
    assert.equal(b.payment_hold_expires_at, null);
    assert.equal(b.price_cents, 0);
  });

  it("an ACTIVE (non-expired) hold blocks the slot", async () => {
    const c = await signIn(parent.email, parent.password);
    const slot = futureUtc(4, 14);
    const first = await book(c, { studentId: stuA, subjectId: subjSolo, duration: 30, start: slot.toISOString() });
    assert.equal(first.error, null, first.error && first.error.message);
    // slot should NOT appear as available now (active hold)
    const { data: slots } = await c.rpc("get_available_slots", { p_subject_id: subjSolo, p_duration: 30, p_from: futureUtc(4, 0).toISOString(), p_to: futureUtc(5, 0).toISOString() });
    const iso = slot.toISOString();
    assert.ok(!slots.some((r) => new Date(r.slot_start).toISOString() === iso), "active hold must remove the slot");
    // second booking of same slot (only solo tutor) fails
    const c2 = await signIn(parent2.email, parent2.password);
    const second = await book(c2, { studentId: stu2, subjectId: subjSolo, duration: 30, start: iso });
    assert.ok(second.error, "active hold blocks a second booking");
  });

  it("an EXPIRED hold frees the slot again and is released to 'expired'", async () => {
    const slot = futureUtc(4, 16);
    // create a real paid hold via the engine (assigned to the solo tutor)
    const c2 = await signIn(parent2.email, parent2.password);
    const held = await book(c2, { studentId: stu2, subjectId: subjSolo, duration: 30, start: slot.toISOString() });
    assert.equal(held.error, null, held.error && held.error.message);
    const holdId = held.data;
    // force the hold to be expired (timestamp-only update, no enum write)
    const { error: ue } = await svc.from("bookings").update({ payment_hold_expires_at: new Date(Date.now() - 60000).toISOString() }).eq("id", holdId);
    assert.equal(ue, null, ue && ue.message);
    const c = await signIn(parent.email, parent.password);
    // slot should appear available again (expired hold ignored)
    const { data: slots } = await c.rpc("get_available_slots", { p_subject_id: subjSolo, p_duration: 30, p_from: futureUtc(4, 0).toISOString(), p_to: futureUtc(5, 0).toISOString() });
    assert.ok(slots.some((r) => new Date(r.slot_start).toISOString() === slot.toISOString()), "expired hold must free the slot");
    // booking the slot succeeds (release runs first) and the stale hold is released
    const { data: id, error } = await book(c, { studentId: stuA, subjectId: subjSolo, duration: 30, start: slot.toISOString() });
    assert.equal(error, null, error && error.message);
    assert.ok(id);
    const { data: old } = await svc.from("bookings").select("status").eq("id", holdId).single();
    assert.equal(old.status, "expired", "stale hold should be released to expired");
  });

  it("release_expired_holds() is callable and returns a count", async () => {
    const c = await signIn(admin.email, admin.password);
    const { data, error } = await c.rpc("release_expired_holds");
    assert.equal(error, null, error && error.message);
    assert.equal(typeof data, "number");
  });

  it("security: student cannot mark a paid hold paid/confirmed or extend the hold", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data: mine } = await c.from("bookings").select("id, status, payment_status, payment_hold_expires_at").eq("account_id", parent.id).eq("payment_status", "awaiting_payment").limit(1);
    assert.ok(mine.length > 0);
    const id = mine[0].id;
    await c.from("bookings").update({ payment_status: "paid", status: "confirmed" }).eq("id", id);
    await c.from("bookings").update({ payment_hold_expires_at: futureUtc(30, 0).toISOString() }).eq("id", id);
    const { data: after } = await svc.from("bookings").select("status, payment_status").eq("id", id).single();
    assert.equal(after.payment_status, "awaiting_payment", "student must not mark paid");
    assert.notEqual(after.status, "confirmed", "student must not confirm");
  });

  it("multiple students: Student A's used free trial does not consume Student B's", async () => {
    const c = await signIn(parent.email, parent.password);
    // stuA already used a free trial in an earlier test
    const aUsed = await c.rpc("has_used_free_trial", { p_student: stuA });
    assert.equal(aUsed.data, true);
    const bUsed = await c.rpc("has_used_free_trial", { p_student: stuB });
    assert.equal(bUsed.data, false);
    const { data: id, error } = await book(c, { studentId: stuB, subjectId: subjMain, duration: 30, start: futureUtc(5, 9).toISOString(), free: true });
    assert.equal(error, null, error && error.message);
    const { data: b } = await svc.from("bookings").select("is_free_trial, price_cents").eq("id", id).single();
    assert.equal(b.is_free_trial, true);
    assert.equal(b.price_cents, 0);
  });

  it("timezone end-to-end: Lagos tutor + Chicago student share one UTC instant at correct local times", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data: slots } = await c.rpc("get_available_slots", { p_subject_id: subjLagos, p_duration: 60, p_from: futureUtc(6, 0).toISOString(), p_to: futureUtc(7, 6).toISOString() });
    assert.ok(slots.length > 0, "expected Lagos slots");
    const start = slots[0].slot_start;
    const { data: id, error } = await book(c, { studentId: stuChi, subjectId: subjLagos, duration: 60, start });
    assert.equal(error, null, error && error.message);
    const { data: b } = await svc.from("bookings").select("scheduled_start").eq("id", id).single();
    const inst = new Date(b.scheduled_start);
    const lagosHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Lagos", hour: "numeric", hour12: false }).format(inst));
    const chicagoHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false }).format(inst));
    assert.ok(lagosHour >= 17 && lagosHour <= 21, `Lagos local hour ${lagosHour} in availability window`);
    // Same instant, different local wall clocks (Lagos is ahead of Chicago).
    assert.notEqual(lagosHour, chicagoHour);
  });

  it("Other request stays a pending, tutor-less admin item with the private description", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data: id, error } = await book(c, { studentId: stuA, subjectId: null, other: "AP Physics C", note: "mechanics", duration: 30 });
    assert.equal(error, null, error && error.message);
    const { data: b } = await svc.from("bookings").select("status, tutor_id, subject_id, other_subject_text, request_note").eq("id", id).single();
    assert.equal(b.status, "pending");
    assert.equal(b.tutor_id, null);
    assert.equal(b.subject_id, null);
    assert.equal(b.other_subject_text, "AP Physics C");
    assert.equal(b.request_note, "mechanics");
  });
});
