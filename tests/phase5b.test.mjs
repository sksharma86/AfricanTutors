import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, anonClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;
const rid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function newStudent(acc, name) {
  const { data } = await svc.from("students").insert({ account_id: acc, full_name: name, grade_level: "9", timezone: "UTC" }).select("id").single();
  return data.id;
}
async function insertBooking({ account, student, tutor, status = "confirmed", minutesFromNow = 5, duration = 60 }) {
  const s = new Date(Date.now() + minutesFromNow * 60000);
  const { data, error } = await svc.from("bookings").insert({
    account_id: account, student_id: student, tutor_id: tutor ?? null,
    scheduled_start: s.toISOString(), scheduled_end: new Date(s.getTime() + duration * 60000).toISOString(),
    duration_minutes: duration, is_free_trial: false, price_cents: 2000, status, payment_status: "paid",
    student_first_name: "Amara", tutor_display_name: "Tomiwa Tutor", subject_name: "Algebra",
  }).select("id").single();
  if (error) throw new Error("insertBooking: " + error.message);
  return data.id;
}
const recForBooking = async (b) => (await svc.from("session_recordings").select("*").eq("booking_id", b).order("created_at")).data;

// Mirror the webhook's ready-to-download / error → record_recording_event calls.
const ready = (booking, recordingId, extra = {}) =>
  svc.rpc("record_recording_event", {
    p_booking: booking, p_status: "completed", p_recording_id: recordingId, p_instance_id: null,
    p_room_name: "at-" + booking.replace(/-/g, ""), p_started_at: new Date(Date.now() - 3600000).toISOString(),
    p_completed_at: new Date().toISOString(), p_duration: 1800, p_max_participants: 2,
    p_storage_key: `bucket/at-${booking.replace(/-/g, "")}/${Date.now()}`, p_share_token: "shr_" + rid("t"), p_error: null, ...extra,
  });
const failed = (booking, instanceId) =>
  svc.rpc("record_recording_event", {
    p_booking: booking, p_status: "failed", p_recording_id: null, p_instance_id: instanceId,
    p_room_name: "at-" + booking.replace(/-/g, ""), p_started_at: null, p_completed_at: null, p_duration: null,
    p_max_participants: null, p_storage_key: null, p_share_token: null, p_error: "cloud-recording-error: test",
  });

describe("Phase 5B — session recording model, association, RLS (live)", { skip: !hasSupabaseEnv }, () => {
  let admin, adminC, tutor, custA, custB, tut, cA, cB, cT, stuA;
  const accounts = [];
  const bookings = [];

  before(async () => {
    admin = await createUser({ requestedRole: "student", displayName: "Admin 5B" });
    await makeAdmin(admin.id);
    adminC = await signIn(admin.email, admin.password);
    tutor = await createUser({ requestedRole: "tutor", displayName: "Tomiwa Tutor" });
    await svc.from("tutor_profiles").update({ status: "approved", timezone: "UTC", comp_rate_cents_per_hour: 1000 }).eq("profile_id", tutor.id);
    await svc.from("profiles").update({ role: "tutor" }).eq("id", tutor.id);
    custA = await createUser({ requestedRole: "student", displayName: "Parent A" });
    custB = await createUser({ requestedRole: "student", displayName: "Parent B" });
    accounts.push(admin.id, tutor.id, custA.id, custB.id);
    stuA = await newStudent(custA.id, "Amara");
    cA = await signIn(custA.email, custA.password);
    cB = await signIn(custB.email, custB.password);
    cT = await signIn(tutor.email, tutor.password);
    tut = tutor;
  });

  after(async () => {
    for (const b of bookings) await svc.from("session_recordings").delete().eq("booking_id", b);
    await svc.from("tutor_earnings").delete().eq("tutor_id", tut.id);
    await svc.from("payments").delete().in("account_id", accounts);
    await svc.from("bookings").delete().in("account_id", accounts);
    await cleanupAll();
  });
  async function freshTutor() {
    const t = await createUser({ requestedRole: "tutor", displayName: "Pool Tutor" });
    await svc.from("tutor_profiles").update({ status: "approved", timezone: "UTC", comp_rate_cents_per_hour: 1000 }).eq("profile_id", t.id);
    await svc.from("profiles").update({ role: "tutor" }).eq("id", t.id);
    return t.id;
  }
  // Each booking gets its own tutor by default so overlapping near-now confirmed
  // test bookings don't trip the tutor/slot exclusion constraint.
  async function mkBooking(opts) {
    const t = opts.tutor ?? (await freshTutor());
    const id = await insertBooking({ ...opts, tutor: t });
    bookings.push(id);
    return id;
  }

  it("a recording associates only with its own booking", async () => {
    const b = await mkBooking({ account: custA.id, student: stuA });
    const recId = rid("rec");
    await ready(b, recId);
    const rows = await recForBooking(b);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].booking_id, b);
    assert.equal(rows[0].daily_recording_id, recId);
    assert.equal(rows[0].status, "completed");
    assert.equal(rows[0].duration_seconds, 1800);
    assert.ok(rows[0].storage_key && !/^https?:\/\//i.test(rows[0].storage_key), "storage_key is a key, not a public URL");
  });

  it("duplicate ready-to-download is idempotent (no duplicate rows)", async () => {
    const b = await mkBooking({ account: custA.id, student: stuA, minutesFromNow: 7 });
    const recId = rid("rec");
    await ready(b, recId);
    await ready(b, recId); // duplicate / out-of-order redelivery
    assert.equal((await recForBooking(b)).length, 1, "one row per Daily recording id");
  });

  it("multiple recordings for one booking (reconnect/restart) are preserved", async () => {
    const b = await mkBooking({ account: custA.id, student: stuA, minutesFromNow: 9 });
    await ready(b, rid("rec"));
    await ready(b, rid("rec"));
    const rows = await recForBooking(b);
    assert.equal(rows.length, 2, "each legitimate artifact kept");
    assert.ok(rows.every((r) => r.status === "completed"));
  });

  it("recording RLS: owning parent + admin can read; other customer, tutor, anon cannot", async () => {
    const b = await mkBooking({ account: custA.id, student: stuA, tutor: tut.id, minutesFromNow: 11 });
    await ready(b, rid("rec"));
    // PR9: owning parent may read; until 0025 is applied this may still be 0 (admin-only).
    const { error: colErr } = await svc.from("session_recordings").select("deleted_at").limit(1);
    const pr9 = !colErr;
    const ownerCount = (await cA.from("session_recordings").select("id").eq("booking_id", b)).data?.length ?? 0;
    if (pr9) {
      assert.ok(ownerCount >= 1, "owning parent can read own recording after PR9");
    } else {
      assert.equal(ownerCount, 0, "pre-PR9: owner customer blocked");
    }
    assert.equal((await cB.from("session_recordings").select("id").eq("booking_id", b)).data.length, 0, "other customer blocked");
    assert.equal((await cT.from("session_recordings").select("id").eq("booking_id", b)).data.length, 0, "assigned tutor blocked");
    const anon = anonClient();
    const anonRes = await anon.from("session_recordings").select("id").eq("booking_id", b);
    assert.ok(anonRes.error || (anonRes.data ?? []).length === 0, "anonymous blocked");
    assert.ok((await adminC.from("session_recordings").select("id").eq("booking_id", b)).data.length >= 1, "admin can read");
  });

  it("clients cannot write recordings (only service/admin via the function)", async () => {
    const b = await mkBooking({ account: custA.id, student: stuA, minutesFromNow: 13 });
    // direct insert blocked by RLS
    assert.ok((await cA.from("session_recordings").insert({ booking_id: b, status: "completed" })).error, "direct insert blocked");
    // function requires is_financial_actor
    assert.ok((await cA.rpc("record_recording_event", { p_booking: b, p_status: "completed", p_recording_id: rid("x") })).error, "customer cannot record");
    assert.ok((await cB.rpc("record_recording_event", { p_booking: b, p_status: "failed", p_instance_id: rid("i") })).error);
  });

  it("recording failure does NOT alter booking, payment, or tutor earnings", async () => {
    const b = await mkBooking({ account: custA.id, student: stuA, minutesFromNow: 15 });
    await svc.from("payments").insert({ account_id: custA.id, purpose: "booking", booking_id: b, gross_cents: 2000, stripe_paid_cents: 2000, status: "succeeded" });
    await svc.from("tutor_earnings").insert({ tutor_id: tut.id, booking_id: b, duration_minutes: 60, rate_cents_per_hour: 1000, amount_cents: 1000, status: "earned", earned_at: new Date().toISOString() });
    const before = {
      booking: (await svc.from("bookings").select("status, payment_status").eq("id", b).single()).data,
      payment: (await svc.from("payments").select("status, stripe_paid_cents").eq("booking_id", b).single()).data,
      earning: (await svc.from("tutor_earnings").select("status, amount_cents").eq("booking_id", b).single()).data,
    };
    await failed(b, rid("inst"));
    const recs = await recForBooking(b);
    assert.ok(recs.some((r) => r.status === "failed"), "failure recorded for admin visibility");
    assert.deepEqual((await svc.from("bookings").select("status, payment_status").eq("id", b).single()).data, before.booking, "booking unchanged");
    assert.deepEqual((await svc.from("payments").select("status, stripe_paid_cents").eq("booking_id", b).single()).data, before.payment, "payment unchanged");
    assert.deepEqual((await svc.from("tutor_earnings").select("status, amount_cents").eq("booking_id", b).single()).data, before.earning, "earnings unchanged");
  });

  it("failure events are idempotent per instance id", async () => {
    const b = await mkBooking({ account: custA.id, student: stuA, minutesFromNow: 17 });
    const inst = rid("inst");
    await failed(b, inst);
    await failed(b, inst);
    const rows = (await recForBooking(b)).filter((r) => r.daily_instance_id === inst);
    assert.equal(rows.length, 1, "one failure row per instance id");
  });

  it("recording for a non-existent booking is rejected (no orphan association)", async () => {
    const res = await ready("00000000-0000-0000-0000-000000000000", rid("rec"));
    assert.ok(res.error, "FK prevents attaching a recording to a non-booking");
  });
});
