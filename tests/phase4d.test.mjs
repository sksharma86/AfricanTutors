import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;
const SFX = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const ref = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function newSubject(name) {
  const { data } = await svc.from("subjects").insert({ name: `${name} ${SFX}`, category: "math" }).select("id").single();
  return data.id;
}
async function approveTutor(id, rate = 1000) {
  await svc.from("tutor_profiles").update({ status: "approved", timezone: "UTC", comp_rate_cents_per_hour: rate }).eq("profile_id", id);
  await svc.from("profiles").update({ role: "tutor" }).eq("id", id);
}
async function newStudent(acc, name) {
  const { data } = await svc.from("students").insert({ account_id: acc, full_name: name, grade_level: "9", timezone: "UTC" }).select("id").single();
  return data.id;
}
const issueMinutes = (a, m) => svc.rpc("issue_package_minutes", { p_account: a, p_minutes: m, p_reference: ref("min") });
const issueCredit = (a, c) => svc.rpc("issue_dollar_credit", { p_account: a, p_amount_cents: c, p_entry_type: "admin_adjustment", p_reference: ref("cr") });
const minutes = async (a) => (await svc.rpc("get_package_minutes", { p_account: a })).data;
const credit = async (a) => (await svc.rpc("get_dollar_credit", { p_account: a })).data;
const getBooking = async (id) => (await svc.from("bookings").select("*").eq("id", id).single()).data;
const getPayment = async (id) => (await svc.from("payments").select("*").eq("id", id).single()).data;
const earningFor = async (b) => (await svc.from("tutor_earnings").select("*").eq("booking_id", b).maybeSingle()).data;

async function nextSlot(subject, dur, afterMs = 3 * 3600_000) {
  const { data } = await svc.rpc("get_available_slots", { p_subject_id: subject, p_duration: dur, p_from: new Date(Date.now() + afterMs).toISOString(), p_to: new Date(Date.now() + 25 * 86400_000).toISOString() });
  if (!data?.length) throw new Error("no slots");
  return data[0].slot_start;
}
const clientCache = new Map();
async function clientFor(acct) {
  if (!clientCache.has(acct.email)) clientCache.set(acct.email, await signIn(acct.email, acct.password));
  return clientCache.get(acct.email);
}
async function book(acct, a) {
  const c = await clientFor(acct);
  return c.rpc("book_session", { p_student_id: a.studentId, p_subject_id: a.subjectId ?? null, p_other_subject: null, p_request_note: null, p_duration: a.duration, p_start: a.start, p_is_free_trial: a.free ?? false });
}
async function setSchedule(bookingId, hoursFromNow, duration = 60) {
  const start = new Date(Date.now() + hoursFromNow * 3600_000);
  await svc.from("bookings").update({ scheduled_start: start.toISOString(), scheduled_end: new Date(start.getTime() + duration * 60000).toISOString() }).eq("id", bookingId);
}
async function pkgId(code) { return (await svc.from("package_products").select("id, minutes, price_cents").eq("code", code).single()).data; }

describe("Phase 4D — hardening: concurrency, boundaries, state integrity (live)", { skip: !hasSupabaseEnv }, () => {
  let admin, adminC, tutor, tutorNoRate, subject;
  const accounts = [];
  const acct = async (name) => { const u = await createUser({ requestedRole: "student", displayName: name }); accounts.push(u.id); return u; };

  before(async () => {
    admin = await createUser({ requestedRole: "student", displayName: "Admin 4D" });
    await makeAdmin(admin.id);
    adminC = await signIn(admin.email, admin.password);
    tutor = await createUser({ requestedRole: "tutor", displayName: "Tutor 4D" });
    tutorNoRate = await createUser({ requestedRole: "tutor", displayName: "Tutor NoRate 4D" });
    await approveTutor(tutor.id, 1000);
    await approveTutor(tutorNoRate.id, 1000); // set then null below when needed
    await svc.from("tutor_profiles").update({ comp_rate_cents_per_hour: null }).eq("profile_id", tutorNoRate.id);
    subject = await newSubject("Harden");
    await svc.from("tutor_subjects").insert({ tutor_id: tutor.id, subject_id: subject });
    for (let d = 0; d < 7; d++) await svc.from("tutor_availability").insert({ tutor_id: tutor.id, day_of_week: d, start_time: "00:00", end_time: "23:59" });
    accounts.push(admin.id, tutor.id, tutorNoRate.id);
  });

  after(async () => {
    await svc.from("disputes").delete().in("account_id", accounts);
    for (const t of [tutor.id, tutorNoRate.id]) await svc.from("tutor_earnings").delete().eq("tutor_id", t);
    for (const acc of accounts) {
      await svc.from("refunds").delete().eq("account_id", acc);
      await svc.from("package_minute_ledger").delete().eq("account_id", acc);
      await svc.from("dollar_credit_ledger").delete().eq("account_id", acc);
      await svc.from("payments").delete().eq("account_id", acc);
    }
    await svc.from("subjects").delete().eq("id", subject);
    await cleanupAll();
  });

  async function creditBooking(a, stu) {
    await issueCredit(a.id, 2000);
    const r = await book(a, { studentId: stu, subjectId: subject, duration: 60, start: await nextSlot(subject, 60) });
    assert.equal(r.error, null, r.error && r.error.message);
    return r.data;
  }
  async function stripeBooking(a, stu, afterMs) {
    const r = await book(a, { studentId: stu, subjectId: subject, duration: 60, start: await nextSlot(subject, 60, afterMs) });
    assert.equal(r.error, null, r.error && r.error.message);
    await svc.rpc("fulfill_booking_payment", { p_payment_id: r.data.payment_id, p_amount_cents: 2000, p_charge_id: "pi_" + ref("x") });
    return r.data;
  }

  // ---- 24-hour cancellation boundary ----
  it("cancellation boundary: >=24h is early (credit), <24h is late (no restore)", async () => {
    // Rule: (scheduled_start - now()) >= 24h → early. The exact-24h instant is
    // inherently racy (time passes before the check), so we verify both sides of
    // the boundary with a small buffer.
    const a = await acct("Boundary");
    const stu = await newStudent(a.id, "K");
    const c = await clientFor(a);
    await issueCredit(a.id, 2000);

    let r = await book(a, { studentId: stu, subjectId: subject, duration: 60, start: await nextSlot(subject, 60) });
    await setSchedule(r.data.booking_id, 24 + 2 / 60); // 24h+2min → early
    assert.equal((await c.rpc("customer_cancel_booking", { p_booking: r.data.booking_id })).data.early, true);
    assert.equal(await credit(a.id), 2000, "early cancellation restores value");

    r = await book(a, { studentId: stu, subjectId: subject, duration: 60, start: await nextSlot(subject, 60) }); // uses restored 2000
    await setSchedule(r.data.booking_id, 23 + 58 / 60); // 23h58m → late
    assert.equal((await c.rpc("customer_cancel_booking", { p_booking: r.data.booking_id })).data.early, false);
    assert.equal(await credit(a.id), 0, "late cancellation restores nothing");
    assert.equal((await earningFor(r.data.booking_id)).amount_cents, 1000, "late cancel pays tutor");
  });

  it("cannot self-cancel a completed booking (noop)", async () => {
    const a = await acct("PostComplete");
    const stu = await newStudent(a.id, "K");
    const b = await creditBooking(a, stu);
    await adminC.rpc("admin_complete_booking", { p_booking: b.booking_id });
    const r = await (await clientFor(a)).rpc("customer_cancel_booking", { p_booking: b.booking_id });
    assert.equal(r.data.status, "noop");
    assert.equal((await getBooking(b.booking_id)).status, "completed");
  });

  // ---- Concurrency: refund race ----
  it("refund race: two concurrent full refunds cannot over-refund", async () => {
    const a = await acct("RefundRace");
    const stu = await newStudent(a.id, "K");
    const b = await stripeBooking(a, stu, 3 * 3600_000);
    const [r1, r2] = await Promise.all([
      adminC.rpc("admin_record_refund", { p_payment_id: b.payment_id, p_amount_cents: 2000, p_stripe_refund_id: ref("re"), p_reason: "a" }),
      adminC.rpc("admin_record_refund", { p_payment_id: b.payment_id, p_amount_cents: 2000, p_stripe_refund_id: ref("re"), p_reason: "b" }),
    ]);
    const errs = [r1.error, r2.error].filter(Boolean);
    assert.equal(errs.length, 1, "exactly one refund rejected (over-cap)");
    assert.equal((await getPayment(b.payment_id)).refunded_cents, 2000, "refunded exactly the Stripe-paid amount, once");
  });

  // ---- Concurrency: payout race ----
  it("payout race: two concurrent mark-paid pays an earning once", async () => {
    const a = await acct("PayoutRace");
    const stu = await newStudent(a.id, "K");
    const b = await creditBooking(a, stu);
    await adminC.rpc("admin_complete_booking", { p_booking: b.booking_id });
    const e = await earningFor(b.booking_id);
    const [r1, r2] = await Promise.all([
      adminC.rpc("admin_mark_earning_paid", { p_earning_id: e.id, p_note: "x" }),
      adminC.rpc("admin_mark_earning_paid", { p_earning_id: e.id, p_note: "y" }),
    ]);
    const statuses = [r1.data?.status, r2.data?.status].sort();
    assert.deepEqual(statuses, ["noop", "paid"], "one pays, one no-ops");
    assert.equal((await svc.from("tutor_earnings").select("status").eq("id", e.id).single()).data.status, "paid");
  });

  // ---- Concurrency: cancellation vs completion ----
  it("cancel vs complete race yields exactly one financial outcome", async () => {
    const a = await acct("CancelVsComplete");
    const stu = await newStudent(a.id, "K");
    const b = await creditBooking(a, stu);
    await setSchedule(b.booking_id, 48); // early
    const c = await clientFor(a);
    await Promise.all([
      c.rpc("customer_cancel_booking", { p_booking: b.booking_id }),
      adminC.rpc("admin_complete_booking", { p_booking: b.booking_id }),
    ]);
    const bk = await getBooking(b.booking_id);
    const e = await earningFor(b.booking_id);
    const restored = (await credit(a.id)) === 2000;
    if (bk.status === "cancelled") {
      assert.ok(restored && !e, "cancelled → credit restored, no earning");
    } else {
      assert.equal(bk.status, "completed");
      assert.ok(!restored && e && e.amount_cents === 1000, "completed → earning, no restore");
    }
  });

  // ---- Concurrency: cancellation vs no-show ----
  it("cancel vs no-show race yields exactly one outcome", async () => {
    const a = await acct("CancelVsNoShow");
    const stu = await newStudent(a.id, "K");
    const b = await creditBooking(a, stu);
    await setSchedule(b.booking_id, 48);
    const c = await clientFor(a);
    await Promise.all([
      c.rpc("customer_cancel_booking", { p_booking: b.booking_id }),
      adminC.rpc("admin_no_show", { p_booking: b.booking_id }),
    ]);
    const bk = await getBooking(b.booking_id);
    const e = await earningFor(b.booking_id);
    assert.ok(["cancelled", "no_show"].includes(bk.status));
    if (bk.status === "cancelled") assert.ok(!e, "cancelled → no earning");
    else assert.ok(e && e.amount_cents === 1000, "no_show → tutor paid");
  });

  // ---- Concurrency: package purchase double-submit dedupe ----
  it("duplicate package checkout submissions reserve credit once (dedupe)", async () => {
    const a = await acct("PkgDouble");
    const pkg = await pkgId("pkg_10h");
    await issueCredit(a.id, 5000);
    const c = await clientFor(a);
    const [r1, r2] = await Promise.all([
      c.rpc("purchase_package", { p_package_id: pkg.id }),
      c.rpc("purchase_package", { p_package_id: pkg.id }),
    ]);
    assert.equal(r1.error, null, r1.error && r1.error.message);
    assert.equal(r2.error, null, r2.error && r2.error.message);
    assert.equal(r1.data.payment_id, r2.data.payment_id, "both submissions map to one pending payment");
    const { count } = await svc.from("payments").select("*", { count: "exact", head: true }).eq("account_id", a.id).eq("purpose", "package").eq("status", "requires_payment");
    assert.equal(count, 1, "only one pending package payment");
    assert.equal(await credit(a.id), 0, "credit reserved exactly once (not 5000 twice)");
  });

  // ---- Concurrency: same-slot booking double-submit ----
  it("duplicate same-slot booking submissions create exactly one booking", async () => {
    const a = await acct("SlotDouble");
    const stu = await newStudent(a.id, "K");
    await issueMinutes(a.id, 600);
    const slot = await nextSlot(subject, 60, 10 * 86400_000);
    const [r1, r2] = await Promise.all([
      book(a, { studentId: stu, subjectId: subject, duration: 60, start: slot }),
      book(a, { studentId: stu, subjectId: subject, duration: 60, start: slot }),
    ]);
    const ok = [r1, r2].filter((r) => !r.error);
    assert.equal(ok.length, 1, "exactly one booking succeeds for the slot");
    assert.equal(await minutes(a.id), 540, "package minutes consumed exactly once");
  });

  // ---- Booking state-machine invalid transitions ----
  it("invalid transitions are rejected", async () => {
    const a = await acct("Transitions");
    const stu = await newStudent(a.id, "K");
    const b = await creditBooking(a, stu);
    await setSchedule(b.booking_id, 48);
    await (await clientFor(a)).rpc("customer_cancel_booking", { p_booking: b.booking_id }); // → cancelled
    // cancelled → completed rejected
    assert.ok((await adminC.rpc("admin_complete_booking", { p_booking: b.booking_id })).error, "cannot complete a cancelled booking");
    // cancelled → no_show is a safe noop (only pending/confirmed act)
    assert.equal((await adminC.rpc("admin_no_show", { p_booking: b.booking_id })).data.status, "noop");
  });

  it("a late Stripe payment cannot confirm a cancelled/expired booking (self-enforced)", async () => {
    const a = await acct("LateVsCancel");
    const stu = await newStudent(a.id, "K");
    await issueCredit(a.id, 700);
    const r = await book(a, { studentId: stu, subjectId: subject, duration: 60, start: await nextSlot(subject, 60) });
    // mixed → pending awaiting payment; cancel it early first
    await setSchedule(r.data.booking_id, 48);
    await (await clientFor(a)).rpc("customer_cancel_booking", { p_booking: r.data.booking_id });
    const f = await svc.rpc("fulfill_booking_payment", { p_payment_id: r.data.payment_id, p_amount_cents: 1300, p_charge_id: "pi_late" });
    assert.equal(f.data.status, "credited", "late payment credited, not confirmed");
    assert.notEqual((await getBooking(r.data.booking_id)).status, "confirmed");
  });

  // ---- Tutor earning edge cases ----
  it("earning edges: missing rate defers (no earning); adjust/void after paid rejected", async () => {
    // missing rate → completion still succeeds, earning deferred
    await svc.from("tutor_subjects").insert({ tutor_id: tutorNoRate.id, subject_id: subject });
    await svc.from("tutor_availability").insert({ tutor_id: tutorNoRate.id, day_of_week: new Date(Date.now() + 12 * 86400_000).getUTCDay(), start_time: "00:00", end_time: "23:59" });
    // Force assignment to tutorNoRate by making the main tutor busy is complex; instead
    // create the booking, then reassign to tutorNoRate before completion.
    const a = await acct("NoRate");
    const stu = await newStudent(a.id, "K");
    const b = await creditBooking(a, stu);
    const rr = await adminC.rpc("admin_reassign_tutor", { p_booking: b.booking_id, p_new_tutor: tutorNoRate.id, p_reason: "coverage" });
    if (!rr.error) {
      const done = await adminC.rpc("admin_complete_booking", { p_booking: b.booking_id });
      assert.equal(done.data.status, "completed", "completes even though rate missing");
      assert.equal(await earningFor(b.booking_id), null, "no earning recorded without a rate");
    }

    // adjust/void after paid rejected
    const a2 = await acct("PaidGuard");
    const stu2 = await newStudent(a2.id, "K");
    const b2 = await creditBooking(a2, stu2);
    await adminC.rpc("admin_complete_booking", { p_booking: b2.booking_id });
    const e2 = await earningFor(b2.booking_id);
    await adminC.rpc("admin_mark_earning_paid", { p_earning_id: e2.id });
    assert.ok((await adminC.rpc("admin_adjust_earning", { p_earning_id: e2.id, p_new_amount_cents: 100, p_reason: "x" })).error, "cannot adjust a paid earning");
    assert.ok((await adminC.rpc("admin_void_earning", { p_earning_id: e2.id, p_reason: "x" })).error, "cannot void a paid earning");
  });

  // ---- Client tampering / authorization ----
  it("customers cannot tamper with financial state or call admin functions", async () => {
    const a = await acct("Tamper");
    const stu = await newStudent(a.id, "K");
    const b = await stripeBooking(a, stu, 3 * 3600_000);
    const c = await clientFor(a);
    // direct writes blocked by RLS
    await c.from("payments").update({ status: "succeeded", refunded_cents: 9999 }).eq("id", b.payment_id);
    assert.equal((await getPayment(b.payment_id)).refunded_cents, 0, "cannot forge refunded amount");
    await c.from("bookings").update({ status: "confirmed" }).eq("id", b.booking_id);
    // admin-only funcs blocked
    assert.ok((await c.rpc("admin_record_refund", { p_payment_id: b.payment_id, p_amount_cents: 100, p_stripe_refund_id: ref("re"), p_reason: "x" })).error);
    assert.ok((await c.rpc("admin_adjust_package_minutes", { p_account: a.id, p_minutes: 100000, p_reason: "x", p_reference: ref("x") })).error);
    assert.ok((await c.rpc("admin_no_show", { p_booking: b.booking_id })).error);
  });
});
