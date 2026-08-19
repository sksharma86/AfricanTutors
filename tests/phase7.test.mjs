import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, anonClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;
const SFX = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const ref = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function approveTutor(id, tz) {
  await svc.from("tutor_profiles").update({ status: "approved", timezone: tz, comp_rate_cents_per_hour: 1000 }).eq("profile_id", id);
  await svc.from("profiles").update({ role: "tutor" }).eq("id", id);
}
async function newStudent(acc, name) {
  const { data } = await svc.from("students").insert({ account_id: acc, full_name: name, grade_level: "9", timezone: "UTC" }).select("id").single();
  return data.id;
}
async function insertBooking({ account, student, tutor, status = "confirmed", minutesFromNow = 60, duration = 60 }) {
  const s = new Date(Date.now() + minutesFromNow * 60000);
  const { data, error } = await svc.from("bookings").insert({
    account_id: account, student_id: student, tutor_id: tutor,
    scheduled_start: s.toISOString(), scheduled_end: new Date(s.getTime() + duration * 60000).toISOString(),
    duration_minutes: duration, is_free_trial: false, price_cents: 2000, status, payment_status: "paid",
    student_first_name: "Amara", tutor_display_name: "Tutor Name", subject_name: "Algebra",
  }).select("id").single();
  if (error) throw new Error("insertBooking: " + error.message);
  return data.id;
}

describe("Phase 7 — tutor operations, earnings visibility, cancellation requests (live)", { skip: !hasSupabaseEnv }, () => {
  let admin, adminC, tA, tB, cust, cTA, cTB, cCust, subject, stu;
  const accounts = [];
  const bookings = [];

  before(async () => {
    admin = await createUser({ requestedRole: "student", displayName: "Admin 7" });
    await makeAdmin(admin.id);
    adminC = await signIn(admin.email, admin.password);
    tA = await createUser({ requestedRole: "tutor", displayName: "Tutor Ada" });
    tB = await createUser({ requestedRole: "tutor", displayName: "Tutor Bola" });
    await approveTutor(tA.id, "America/Chicago");
    await approveTutor(tB.id, "Africa/Lagos");
    cust = await createUser({ requestedRole: "student", displayName: "Parent" });
    cTA = await signIn(tA.email, tA.password);
    cTB = await signIn(tB.email, tB.password);
    cCust = await signIn(cust.email, cust.password);
    const { data: subj } = await svc.from("subjects").insert({ name: `Algebra ${SFX}`, category: "math" }).select("id").single();
    subject = subj.id;
    await svc.from("tutor_subjects").insert({ tutor_id: tA.id, subject_id: subject });
    stu = await newStudent(cust.id, "Amara");
    accounts.push(admin.id, tA.id, tB.id, cust.id);
  });

  after(async () => {
    await svc.from("tutor_cancellation_requests").delete().in("tutor_id", [tA.id, tB.id]);
    for (const t of [tA.id, tB.id]) await svc.from("tutor_earnings").delete().eq("tutor_id", t);
    for (const b of bookings) await svc.from("bookings").delete().eq("id", b);
    await svc.from("bookings").delete().in("account_id", accounts);
    await svc.from("tutor_availability").delete().in("tutor_id", [tA.id, tB.id]);
    await svc.from("subjects").delete().eq("id", subject);
    await cleanupAll();
  });
  async function mk(opts) { const id = await insertBooking(opts); bookings.push(id); return id; }

  it("tutor sees own bookings but not another tutor's; student identity is safe (no email/phone)", async () => {
    const a = await mk({ account: cust.id, student: stu, tutor: tA.id, minutesFromNow: 60 });
    await mk({ account: cust.id, student: stu, tutor: tB.id, minutesFromNow: 200 });
    const mine = await cTA.from("bookings").select("id, student_first_name").eq("id", a);
    assert.equal(mine.data.length, 1);
    assert.equal(mine.data[0].student_first_name, "Amara");
    assert.ok(!("email" in mine.data[0]) && !("phone" in mine.data[0]), "no contact fields");
    // tutor A cannot see tutor B's booking
    const others = await cTA.from("bookings").select("id").eq("tutor_id", tB.id);
    assert.equal(others.data.length, 0, "cannot read another tutor's bookings");
  });

  it("tutor reads own earnings + payout history; not another tutor's; cannot mutate", async () => {
    const b = await mk({ account: cust.id, student: stu, tutor: tA.id, minutesFromNow: 300 });
    await svc.from("tutor_earnings").insert({ tutor_id: tA.id, booking_id: b, duration_minutes: 60, rate_cents_per_hour: 1000, amount_cents: 1000, status: "paid", earned_at: new Date().toISOString(), paid_at: new Date().toISOString() });
    const mine = await cTA.from("tutor_earnings").select("amount_cents, status, paid_at").eq("tutor_id", tA.id);
    assert.ok(mine.data.length >= 1 && mine.data.some((e) => e.status === "paid" && e.paid_at), "own earnings + payout visible");
    assert.equal((await cTB.from("tutor_earnings").select("id").eq("tutor_id", tA.id)).data.length, 0, "cannot read another tutor's earnings");
    await cTA.from("tutor_earnings").update({ status: "paid", amount_cents: 999999 }).eq("booking_id", b);
    assert.equal((await svc.from("tutor_earnings").select("amount_cents").eq("booking_id", b).single()).data.amount_cents, 1000, "tutor cannot mutate earnings");
  });

  it("compensation rate is read-only to the tutor (can view, cannot change rate or status)", async () => {
    const own = await cTA.from("tutor_profiles").select("comp_rate_cents_per_hour, timezone").eq("profile_id", tA.id).single();
    assert.equal(own.data.comp_rate_cents_per_hour, 1000, "tutor sees own rate");
    assert.equal(own.data.timezone, "America/Chicago", "own timezone (IANA #1)");
    assert.equal((await cTB.from("tutor_profiles").select("timezone").eq("profile_id", tB.id).single()).data.timezone, "Africa/Lagos", "IANA #2");
    await cTA.from("tutor_profiles").update({ comp_rate_cents_per_hour: 999999, status: "approved" }).eq("profile_id", tA.id);
    const after = await svc.from("tutor_profiles").select("comp_rate_cents_per_hour").eq("profile_id", tA.id).single();
    assert.equal(after.data.comp_rate_cents_per_hour, 1000, "rate unchanged (guard trigger)");
  });

  it("tutor can add/edit/remove own availability but cannot self-assign subjects", async () => {
    const ins = await cTA.from("tutor_availability").insert({ tutor_id: tA.id, day_of_week: 2, start_time: "09:00", end_time: "12:00" }).select("id").single();
    assert.equal(ins.error, null, ins.error && ins.error.message);
    await cTA.from("tutor_availability").update({ end_time: "13:00" }).eq("id", ins.data.id);
    assert.equal((await svc.from("tutor_availability").select("end_time").eq("id", ins.data.id).single()).data.end_time, "13:00:00");
    await cTA.from("tutor_availability").delete().eq("id", ins.data.id);
    assert.equal((await svc.from("tutor_availability").select("id").eq("id", ins.data.id)).data.length, 0);
    // read-only subjects
    assert.ok((await cTA.from("tutor_subjects").insert({ tutor_id: tA.id, subject_id: subject })).error, "tutor cannot self-add subjects");
    assert.ok((await cTA.from("tutor_subjects").select("subject_id").eq("tutor_id", tA.id)).data.length >= 1, "tutor reads own approved subjects");
  });

  it("booking conflict protection remains authoritative", async () => {
    const start = new Date(Date.now() + 5 * 86400_000);
    await svc.from("bookings").insert({ account_id: cust.id, student_id: stu, tutor_id: tA.id, scheduled_start: start.toISOString(), scheduled_end: new Date(start.getTime() + 3600000).toISOString(), duration_minutes: 60, is_free_trial: false, price_cents: 2000, status: "confirmed", payment_status: "paid" }).then((r) => { if (r.error) throw new Error(r.error.message); });
    const overlap = await svc.from("bookings").insert({ account_id: cust.id, student_id: stu, tutor_id: tA.id, scheduled_start: new Date(start.getTime() + 30 * 60000).toISOString(), scheduled_end: new Date(start.getTime() + 90 * 60000).toISOString(), duration_minutes: 60, is_free_trial: false, price_cents: 2000, status: "confirmed", payment_status: "paid" });
    assert.ok(overlap.error, "overlapping tutor booking rejected by exclusion constraint");
  });

  it("tutor cancellation request: own upcoming only; one open; not completed; not another tutor's; not customer", async () => {
    const b = await mk({ account: cust.id, student: stu, tutor: tA.id, minutesFromNow: 6 * 60 });
    const r = await cTA.rpc("request_tutor_cancellation", { p_booking: b, p_reason: "Family emergency" });
    assert.equal(r.error, null, r.error && r.error.message);
    assert.ok((await cTA.rpc("request_tutor_cancellation", { p_booking: b, p_reason: "again" })).error, "one open request per booking");
    // another tutor cannot request on A's booking
    assert.ok((await cTB.rpc("request_tutor_cancellation", { p_booking: b, p_reason: "x" })).error, "not the assigned tutor");
    // customer cannot request
    assert.ok((await cCust.rpc("request_tutor_cancellation", { p_booking: b, p_reason: "x" })).error, "customer cannot request tutor cancellation");
    // completed booking cannot be tutor-cancelled
    const done = await mk({ account: cust.id, student: stu, tutor: tA.id, status: "completed", minutesFromNow: -300 });
    assert.ok((await cTA.rpc("request_tutor_cancellation", { p_booking: done, p_reason: "x" })).error, "completed not cancellable");
    // admin sees the open request; tutor sees own; other tutor cannot
    assert.ok((await adminC.from("tutor_cancellation_requests").select("id").eq("booking_id", b)).data.length === 1);
    assert.ok((await cTA.from("tutor_cancellation_requests").select("id").eq("booking_id", b)).data.length === 1);
    assert.equal((await cTB.from("tutor_cancellation_requests").select("id").eq("booking_id", b)).data.length, 0, "other tutor cannot read the request");
    // admin resolves; tutor cannot resolve
    assert.ok((await cTA.rpc("resolve_tutor_cancellation_request", { p_id: r.data, p_status: "resolved" })).error, "tutor cannot resolve");
    await adminC.rpc("resolve_tutor_cancellation_request", { p_id: r.data, p_status: "resolved" });
    assert.equal((await svc.from("tutor_cancellation_requests").select("status").eq("id", r.data).single()).data.status, "resolved");
  });

  it("tutor cannot access recordings or forge presence", async () => {
    const b = await mk({ account: cust.id, student: stu, tutor: tA.id, minutesFromNow: 900 });
    await svc.rpc("record_recording_event", { p_booking: b, p_status: "completed", p_recording_id: ref("rec"), p_room_name: "at-" + b.replace(/-/g, "") });
    assert.equal((await cTA.from("session_recordings").select("id").eq("booking_id", b)).data.length, 0, "tutor cannot read recordings");
    assert.ok((await cTA.rpc("record_session_presence", { p_booking: b, p_role: "tutor", p_event: "join" })).error, "tutor cannot forge presence");
  });

  it("anonymous cannot read tutor-only data", async () => {
    const anon = anonClient();
    for (const t of ["tutor_earnings", "tutor_cancellation_requests", "session_recordings"]) {
      const res = await anon.from(t).select("id").limit(1);
      assert.ok(res.error || (res.data ?? []).length === 0, `anon blocked from ${t}`);
    }
  });
});
