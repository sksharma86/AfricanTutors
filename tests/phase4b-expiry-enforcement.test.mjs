import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, cleanupAll, createUser, hasSupabaseEnv, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;
const SFX = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const ref = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const PAST = () => new Date(Date.now() - 60000).toISOString();

async function newSubject(name) {
  const { data, error } = await svc.from("subjects").insert({ name: `${name} ${SFX}`, category: "math" }).select("id").single();
  if (error) throw new Error("newSubject: " + error.message);
  return data.id;
}
async function newStudent(acc, name) {
  const { data, error } = await svc.from("students").insert({ account_id: acc, full_name: name, grade_level: "9", timezone: "UTC" }).select("id").single();
  if (error) throw new Error("newStudent: " + error.message);
  return data.id;
}
async function issueCredit(acc, cents) {
  const { error } = await svc.rpc("issue_dollar_credit", { p_account: acc, p_amount_cents: cents, p_entry_type: "admin_adjustment", p_reference: ref("seedcr") });
  if (error) throw new Error("issueCredit: " + error.message);
}
const minutes = async (acc) => (await svc.rpc("get_package_minutes", { p_account: acc })).data;
const credit = async (acc) => (await svc.rpc("get_dollar_credit", { p_account: acc })).data;
const getPayment = async (id) => (await svc.from("payments").select("*").eq("id", id).single()).data;
const getBooking = async (id) => (await svc.from("bookings").select("*").eq("id", id).single()).data;
const pkgId = async (code) => (await svc.from("package_products").select("id, minutes, price_cents").eq("code", code).single()).data;
async function nextSlot(subject, duration) {
  const from = new Date(Date.now() + 3 * 3600_000).toISOString();
  const to = new Date(Date.now() + 20 * 86400_000).toISOString();
  const { data, error } = await svc.rpc("get_available_slots", { p_subject_id: subject, p_duration: duration, p_from: from, p_to: to });
  if (error) throw new Error("nextSlot: " + error.message);
  if (!data?.length) throw new Error("no slots");
  return data[0].slot_start;
}
const clientCache = new Map();
async function bookSession(acct, a) {
  if (!clientCache.has(acct.email)) clientCache.set(acct.email, await signIn(acct.email, acct.password));
  return clientCache.get(acct.email).rpc("book_session", {
    p_student_id: a.studentId, p_subject_id: a.subjectId ?? null, p_other_subject: a.other ?? null,
    p_request_note: a.note ?? null, p_duration: a.duration, p_start: a.start ?? null, p_is_free_trial: a.free ?? false,
  });
}
// Simulate the internal deadline passing WITHOUT running any sweeper: only the
// authoritative timestamps move into the past; status stays requires_payment.
async function expireInternally(paymentId, bookingId) {
  await svc.from("payments").update({ expires_at: PAST() }).eq("id", paymentId);
  if (bookingId) await svc.from("bookings").update({ payment_hold_expires_at: PAST() }).eq("id", bookingId);
}

describe("Phase 4B — self-enforcing expiry at fulfillment (live)", { skip: !hasSupabaseEnv }, () => {
  let tutor, subject;
  const accounts = [];
  async function acct(name) {
    const u = await createUser({ requestedRole: "student", displayName: name });
    accounts.push(u.id);
    return u;
  }

  before(async () => {
    tutor = await createUser({ requestedRole: "tutor", displayName: "Enforce Tutor" });
    await svc.from("tutor_profiles").update({ status: "approved", timezone: "UTC", comp_rate_cents_per_hour: 1000 }).eq("profile_id", tutor.id);
    await svc.from("profiles").update({ role: "tutor" }).eq("id", tutor.id);
    subject = await newSubject("Enforce");
    await svc.from("tutor_subjects").insert({ tutor_id: tutor.id, subject_id: subject });
    for (let d = 0; d < 7; d++) await svc.from("tutor_availability").insert({ tutor_id: tutor.id, day_of_week: d, start_time: "00:00", end_time: "23:59" });
  });

  after(async () => {
    for (const acc of accounts) {
      await svc.from("package_minute_ledger").delete().eq("account_id", acc);
      await svc.from("dollar_credit_ledger").delete().eq("account_id", acc);
      await svc.from("payments").delete().eq("account_id", acc);
    }
    await svc.from("tutor_earnings").delete().eq("tutor_id", tutor.id);
    await svc.from("subjects").delete().eq("id", subject);
    await cleanupAll();
  });

  // 1 — booking paid after deadline, NO sweeper first
  it("booking: late Stripe payment after hold expiry (no sweeper) → credited, not confirmed", async () => {
    const a = await acct("BkUnswept");
    const stu = await newStudent(a.id, "Kid");
    await issueCredit(a.id, 700);
    const r = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start: await nextSlot(subject, 60) });
    assert.equal(r.data.funding, "stripe");
    await expireInternally(r.data.payment_id, r.data.booking_id);
    // Prove the row is still physically pending/awaiting and unswept.
    const before = await getBooking(r.data.booking_id);
    assert.equal(before.status, "pending");
    assert.equal(before.payment_status, "awaiting_payment");
    assert.equal((await getPayment(r.data.payment_id)).status, "requires_payment");

    const ok = await svc.rpc("fulfill_booking_payment", { p_payment_id: r.data.payment_id, p_amount_cents: 1300, p_charge_id: "pi_unswept" });
    assert.equal(ok.data.status, "credited", "must NOT confirm an expired booking");
    const b = await getBooking(r.data.booking_id);
    assert.equal(b.status, "expired", "slot released, not resurrected");
    assert.equal(await credit(a.id), 2000, "restored 700 + credited 1300");
    const p = await getPayment(r.data.payment_id);
    assert.equal(p.status, "succeeded");
    assert.ok(p.note && /credited/i.test(p.note));
  });

  // 2 — package paid after deadline, NO sweeper first
  it("package: late Stripe payment after expires_at (no sweeper) → credited, no minutes", async () => {
    const a = await acct("PkgUnswept");
    const pkg = await pkgId("pkg_10h");
    await issueCredit(a.id, 5000);
    const r = await svc.rpc("purchase_package", { p_package_id: pkg.id, p_account: a.id });
    const due = pkg.price_cents - 5000;
    await expireInternally(r.data.payment_id, null);
    assert.equal((await getPayment(r.data.payment_id)).status, "requires_payment", "unswept");

    const late = await svc.rpc("fulfill_package_payment", { p_payment_id: r.data.payment_id, p_amount_cents: due, p_charge_id: "pi_pkg_unswept" });
    assert.equal(late.data.status, "credited", "must NOT issue minutes after expiry");
    assert.equal(await minutes(a.id), 0);
    assert.equal(await credit(a.id), 5000 + due, "restored 5000 + credited due");
  });

  // 3 — success before expiration → normal fulfillment
  it("success before expiration → booking confirms and package issues normally", async () => {
    const a = await acct("BeforeExpiry");
    const stu = await newStudent(a.id, "Kid");
    await issueCredit(a.id, 700);
    const rb = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start: await nextSlot(subject, 60) });
    // expires_at is ~15 min in the future (default) → not expired.
    const okb = await svc.rpc("fulfill_booking_payment", { p_payment_id: rb.data.payment_id, p_amount_cents: 1300 });
    assert.equal(okb.data.status, "confirmed");
    assert.equal((await getBooking(rb.data.booking_id)).status, "confirmed");

    const pkg = await pkgId("pkg_10h");
    const rp = await svc.rpc("purchase_package", { p_package_id: pkg.id, p_account: a.id });
    const okp = await svc.rpc("fulfill_package_payment", { p_payment_id: rp.data.payment_id, p_amount_cents: pkg.price_cents });
    assert.equal(okp.data.status, "completed");
    assert.equal(await minutes(a.id), pkg.minutes);
  });

  // 4 — after expiration where the sweeper already ran → same delayed result
  it("after expiry with sweeper already run → same delayed-credit result", async () => {
    const a = await acct("SweptFirst");
    const stu = await newStudent(a.id, "Kid");
    await issueCredit(a.id, 700);
    const r = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start: await nextSlot(subject, 60) });
    await expireInternally(r.data.payment_id, r.data.booking_id);
    await svc.rpc("release_expired_checkouts"); // sweeper runs FIRST
    assert.equal((await getPayment(r.data.payment_id)).status, "canceled");
    assert.equal(await credit(a.id), 700);
    const ok = await svc.rpc("fulfill_booking_payment", { p_payment_id: r.data.payment_id, p_amount_cents: 1300 });
    assert.equal(ok.data.status, "credited");
    assert.equal(await credit(a.id), 2000);
    assert.equal((await getBooking(r.data.booking_id)).status, "expired");
  });

  // 5 — sweeper and late fulfillment concurrently → value moves exactly once
  it("concurrent sweeper + late fulfillment → credit restored once, value credited once", async () => {
    // booking
    const a = await acct("ConcurBook");
    const stu = await newStudent(a.id, "Kid");
    await issueCredit(a.id, 700);
    const r = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start: await nextSlot(subject, 60) });
    await expireInternally(r.data.payment_id, r.data.booking_id);
    await Promise.all([
      svc.rpc("release_expired_checkouts"),
      svc.rpc("fulfill_booking_payment", { p_payment_id: r.data.payment_id, p_amount_cents: 1300, p_charge_id: "pi_concur" }),
    ]);
    assert.equal(await credit(a.id), 2000, "booking: restored+credited exactly once");
    assert.equal((await getBooking(r.data.booking_id)).status, "expired");
    assert.equal((await getPayment(r.data.payment_id)).status, "succeeded");

    // package
    const a2 = await acct("ConcurPkg");
    const pkg = await pkgId("pkg_10h");
    await issueCredit(a2.id, 5000);
    const rp = await svc.rpc("purchase_package", { p_package_id: pkg.id, p_account: a2.id });
    const due = pkg.price_cents - 5000;
    await expireInternally(rp.data.payment_id, null);
    await Promise.all([
      svc.rpc("release_expired_checkouts"),
      svc.rpc("fulfill_package_payment", { p_payment_id: rp.data.payment_id, p_amount_cents: due, p_charge_id: "pi_concur_pkg" }),
    ]);
    assert.equal(await minutes(a2.id), 0, "package: no minutes issued");
    assert.equal(await credit(a2.id), 5000 + due, "package: restored+credited exactly once");
  });

  // 6 — duplicate late webhook after the unswept-expiry path → no double credit
  it("duplicate late webhook after unswept expiry → value credited exactly once", async () => {
    const a = await acct("DupLate");
    const pkg = await pkgId("pkg_10h");
    await issueCredit(a.id, 5000);
    const r = await svc.rpc("purchase_package", { p_package_id: pkg.id, p_account: a.id });
    const due = pkg.price_cents - 5000;
    await expireInternally(r.data.payment_id, null); // no sweeper
    const f1 = await svc.rpc("fulfill_package_payment", { p_payment_id: r.data.payment_id, p_amount_cents: due });
    assert.equal(f1.data.status, "credited");
    const f2 = await svc.rpc("fulfill_package_payment", { p_payment_id: r.data.payment_id, p_amount_cents: due });
    assert.equal(f2.data.status, "already_fulfilled");
    assert.equal(await credit(a.id), 5000 + due, "credited exactly once");
    assert.equal(await minutes(a.id), 0);
  });
});
