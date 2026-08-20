import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, cleanupAll, createUser, hasSupabaseEnv, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;

describe("Phase 8 — free trial is ONE PER ACCOUNT (live)", { skip: !hasSupabaseEnv }, () => {
  let tutor, subjectId, accountA;
  const accounts = [];
  const bookingIds = [];

  async function approveTutor(id) {
    await svc.from("tutor_profiles").upsert(
      { profile_id: id, status: "approved", timezone: "America/Chicago", comp_rate_cents_per_hour: 2500, bio: "t", approved_at: new Date().toISOString() },
      { onConflict: "profile_id" },
    );
    await svc.from("profiles").update({ role: "tutor", display_name: "Mr. Demo Tutor" }).eq("id", id);
    await svc.from("tutor_subjects").upsert({ tutor_id: id, subject_id: subjectId, approved_by: id }, { onConflict: "tutor_id,subject_id" });
    const avail = [];
    for (let d = 0; d < 7; d++) avail.push({ tutor_id: id, day_of_week: d, start_time: "00:00", end_time: "23:59" });
    await svc.from("tutor_availability").insert(avail);
  }

  async function mkAccount(name) {
    const u = await createUser({ requestedRole: "student", displayName: name });
    accounts.push(u.id);
    u.client = await signIn(u.email, u.password);
    return u;
  }
  async function mkStudent(account, name) {
    const { data, error } = await svc
      .from("students")
      .insert({ account_id: account, full_name: name, grade_level: "9", timezone: "America/Chicago" })
      .select("id")
      .single();
    if (error) throw new Error(`student: ${error.message}`);
    return data.id;
  }
  async function firstSlot(client) {
    const { data } = await client.rpc("get_available_slots", {
      p_subject_id: subjectId,
      p_duration: 30,
      p_from: new Date(Date.now() + 3 * 3600000).toISOString(),
      p_to: new Date(Date.now() + 10 * 86400000).toISOString(),
    });
    return (data ?? [])[0]?.slot_start ?? null;
  }
  function trialScheduled(client, studentId, startISO, duration = 30) {
    return client.rpc("book_session", {
      p_student_id: studentId,
      p_subject_id: subjectId,
      p_other_subject: null,
      p_request_note: null,
      p_duration: duration,
      p_start: startISO,
      p_is_free_trial: true,
    });
  }
  function trialOther(client, studentId, duration = 30) {
    return client.rpc("book_session", {
      p_student_id: studentId,
      p_subject_id: null,
      p_other_subject: "General help",
      p_request_note: null,
      p_duration: duration,
      p_start: null,
      p_is_free_trial: true,
    });
  }

  before(async () => {
    const { data: subj } = await svc.from("subjects").select("id").eq("name", "Algebra I").single();
    subjectId = subj.id;
    const t = await createUser({ requestedRole: "tutor", displayName: "Mr. Demo Tutor" });
    accounts.push(t.id);
    tutor = t.id;
    await approveTutor(tutor);
  });

  after(async () => {
    for (const b of bookingIds) await svc.from("bookings").delete().eq("id", b);
    await svc.from("bookings").delete().in("account_id", accounts);
    await svc.from("tutor_availability").delete().eq("tutor_id", tutor);
    await svc.from("students").delete().in("account_id", accounts);
    await cleanupAll();
  });

  it("account with one student can use the free trial once (30 min, no payment, tutor assigned)", async () => {
    const a = await mkAccount("Parent A");
    const s1 = await mkStudent(a.id, "Child A1");
    const slot = await firstSlot(a.client);
    assert.ok(slot, "a slot is available");
    const { data, error } = await trialScheduled(a.client, s1, slot);
    assert.equal(error, null, error?.message);
    assert.equal(data.funding, "free_trial");
    assert.equal(data.session_price_cents, 0);
    assert.equal(data.stripe_cents_due, 0, "no payment method / nothing due");
    bookingIds.push(data.booking_id);
    a.s1 = s1;

    const { data: bk } = await svc.from("bookings").select("*").eq("id", data.booking_id).single();
    assert.equal(bk.is_free_trial, true);
    assert.equal(bk.duration_minutes, 30, "free trial is 30 minutes only");
    assert.equal(bk.price_cents, 0, "customer charged $0");
    assert.equal(bk.status, "confirmed");
    assert.ok(bk.tutor_id, "a tutor is assigned (normal compensation path is unchanged)");

    // Tutor compensation path unchanged: the $0-to-customer session still books a
    // real assigned tutor and a $0 booking payment (earnings pipeline untouched).
    const { data: pay } = await svc.from("payments").select("gross_cents, status").eq("booking_id", data.booking_id).single();
    assert.equal(pay.gross_cents, 0);
    assert.equal(pay.status, "succeeded");

    accountA = a;
  });

  it("the same student cannot use a second free trial", async () => {
    const a = accountA;
    const slot = await firstSlot(a.client);
    const { data, error } = await trialScheduled(a.client, a.s1, slot);
    assert.ok(error, "second trial rejected");
    assert.match(error.message, /already used/i);
    assert.equal(data, null);
  });

  it("a second student under the same account cannot receive another free trial", async () => {
    const a = accountA;
    const s2 = await mkStudent(a.id, "Child A2");
    const slot = await firstSlot(a.client);
    const { error } = await trialScheduled(a.client, s2, slot);
    assert.ok(error, "second student's trial rejected");
    assert.match(error.message, /already used/i);
  });

  it("adding a third/new student does not restore account eligibility", async () => {
    const a = accountA;
    const s3 = await mkStudent(a.id, "Child A3");
    const used = await a.client.rpc("account_has_used_free_trial", { p_account: a.id });
    assert.equal(used.data, true, "account still marked as having used its trial");
    const { error } = await trialOther(a.client, s3);
    assert.ok(error, "new student's trial rejected");
    assert.match(error.message, /already used/i);
  });

  it("a different customer account remains independently eligible", async () => {
    const b = await mkAccount("Parent B");
    const s = await mkStudent(b.id, "Child B1");
    const slot = await firstSlot(b.client);
    const { data, error } = await trialScheduled(b.client, s, slot);
    assert.equal(error, null, error?.message);
    assert.equal(data.funding, "free_trial");
    bookingIds.push(data.booking_id);
  });

  it("two simultaneous free-trial attempts under one account yield exactly one success", async () => {
    const c = await mkAccount("Parent C");
    const s = await mkStudent(c.id, "Child C1");
    const results = await Promise.all([trialOther(c.client, s), trialOther(c.client, s)]);
    const successes = results.filter((r) => !r.error);
    const failures = results.filter((r) => r.error);
    assert.equal(successes.length, 1, "exactly one concurrent attempt succeeds");
    assert.equal(failures.length, 1, "the other is rejected");
    assert.match(failures[0].error.message, /already used/i);
    for (const r of successes) if (r.data?.booking_id) bookingIds.push(r.data.booking_id);
  });

  it("the free trial must be 30 minutes only", async () => {
    const d = await mkAccount("Parent D");
    const s = await mkStudent(d.id, "Child D1");
    const { error } = await trialOther(d.client, s, 60);
    assert.ok(error, "60-minute free trial rejected");
    assert.match(error.message, /30 minutes/i);
  });
});
