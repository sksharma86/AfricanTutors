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
async function pkgId(code) {
  return (await svc.from("package_products").select("id, minutes, price_cents").eq("code", code).single()).data;
}
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
  const c = clientCache.get(acct.email);
  return c.rpc("book_session", {
    p_student_id: a.studentId, p_subject_id: a.subjectId ?? null, p_other_subject: a.other ?? null,
    p_request_note: a.note ?? null, p_duration: a.duration, p_start: a.start ?? null, p_is_free_trial: a.free ?? false,
  });
}

describe("Phase 4B — payment lifecycle & late-payment safety (live)", { skip: !hasSupabaseEnv }, () => {
  let tutor, subject;
  const accounts = [];
  async function acct(name) {
    const u = await createUser({ requestedRole: "student", displayName: name });
    accounts.push(u.id);
    return u;
  }

  before(async () => {
    tutor = await createUser({ requestedRole: "tutor", displayName: "Lifecycle Tutor" });
    await svc.from("tutor_profiles").update({ status: "approved", timezone: "UTC", comp_rate_cents_per_hour: 1000 }).eq("profile_id", tutor.id);
    await svc.from("profiles").update({ role: "tutor" }).eq("id", tutor.id);
    subject = await newSubject("Lifecycle");
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

  // 1
  it("booking 15-min hold expires (Stripe could still be open): booking expired, credit restored", async () => {
    const a = await acct("HoldExpiry");
    const stu = await newStudent(a.id, "Kid");
    await issueCredit(a.id, 700);
    const r = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start: await nextSlot(subject, 60) });
    assert.equal(r.data.funding, "stripe");
    assert.equal(await credit(a.id), 0);
    await svc.from("bookings").update({ payment_hold_expires_at: PAST() }).eq("id", r.data.booking_id);
    const rel = await svc.rpc("release_expired_checkouts");
    assert.equal(rel.error, null, rel.error && rel.error.message);
    assert.equal((await getBooking(r.data.booking_id)).status, "expired");
    assert.equal((await getPayment(r.data.payment_id)).status, "canceled");
    assert.equal(await credit(a.id), 700, "reserved credit restored");
  });

  // 2
  it("Stripe payment arrives after booking expiry: slot stays expired, value credited", async () => {
    const a = await acct("BookLate");
    const stu = await newStudent(a.id, "Kid");
    await issueCredit(a.id, 700);
    const r = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start: await nextSlot(subject, 60) });
    await svc.from("bookings").update({ payment_hold_expires_at: PAST() }).eq("id", r.data.booking_id);
    await svc.rpc("release_expired_checkouts");
    assert.equal(await credit(a.id), 700);
    const ok = await svc.rpc("fulfill_booking_payment", { p_payment_id: r.data.payment_id, p_amount_cents: 500, p_charge_id: "pi_late_book" });
    assert.equal(ok.data.status, "credited");
    assert.equal((await getBooking(r.data.booking_id)).status, "expired", "expired slot not reactivated");
    assert.equal(await credit(a.id), 1200, "restored 700 + credited 500");
  });

  // 3
  it("partial-credit package abandoned: sweeper restores credit, cancels payment, no minutes", async () => {
    const a = await acct("PkgAbandonPartial");
    const pkg = await pkgId("pkg_14h");
    await issueCredit(a.id, 5000);
    const r = await svc.rpc("purchase_package", { p_package_id: pkg.id, p_account: a.id });
    assert.equal(r.data.funding, "stripe");
    assert.equal(await credit(a.id), 0, "credit reserved");
    await svc.from("payments").update({ expires_at: PAST() }).eq("id", r.data.payment_id);
    const rel = await svc.rpc("release_expired_checkouts");
    assert.equal(rel.error, null, rel.error && rel.error.message);
    assert.equal((await getPayment(r.data.payment_id)).status, "canceled");
    assert.equal(await credit(a.id), 5000, "reserved credit restored");
    assert.equal(await minutes(a.id), 0, "no minutes issued");
  });

  // 4
  it("full-Stripe package abandoned: payment expires cleanly, no minutes", async () => {
    const a = await acct("PkgAbandonStripe");
    const pkg = await pkgId("pkg_28h");
    const r = await svc.rpc("purchase_package", { p_package_id: pkg.id, p_account: a.id });
    assert.equal(r.data.stripe_cents_due, pkg.price_cents);
    await svc.from("payments").update({ expires_at: PAST() }).eq("id", r.data.payment_id);
    await svc.rpc("release_expired_checkouts");
    assert.equal((await getPayment(r.data.payment_id)).status, "canceled");
    assert.equal(await minutes(a.id), 0);
    assert.equal(await credit(a.id), 0);
  });

  // 5
  it("package Stripe success after internal expiry: value credited, package NOT resurrected", async () => {
    const a = await acct("PkgLate");
    const pkg = await pkgId("pkg_14h");
    await issueCredit(a.id, 5000);
    const r = await svc.rpc("purchase_package", { p_package_id: pkg.id, p_account: a.id });
    const due = pkg.price_cents - 5000;
    await svc.from("payments").update({ expires_at: PAST() }).eq("id", r.data.payment_id);
    await svc.rpc("release_expired_checkouts"); // credit 5000 restored, payment canceled
    assert.equal(await credit(a.id), 5000);
    const late = await svc.rpc("fulfill_package_payment", { p_payment_id: r.data.payment_id, p_amount_cents: due, p_charge_id: "pi_late_pkg" });
    assert.equal(late.data.status, "credited");
    assert.equal(await minutes(a.id), 0, "package not issued after expiry");
    assert.equal(await credit(a.id), 5000 + due, "customer retains full value as account credit");
  });

  // 6
  it("Stripe Checkout creation failure after reservation → cancel_pending_payment restores credit (idempotent)", async () => {
    const a = await acct("PkgStripeFail");
    const pkg = await pkgId("pkg_14h");
    await issueCredit(a.id, 5000);
    const r = await svc.rpc("purchase_package", { p_package_id: pkg.id, p_account: a.id });
    assert.equal(await credit(a.id), 0);
    // Simulate the checkout service's rollback path when Stripe creation throws.
    const c1 = await svc.rpc("cancel_pending_payment", { p_payment_id: r.data.payment_id, p_reason: "stripe create failed" });
    assert.equal(c1.data.status, "canceled");
    assert.equal(await credit(a.id), 5000, "credit restored immediately");
    assert.equal(await minutes(a.id), 0);
    // Idempotent: a second cancel is a no-op and never double-restores.
    const c2 = await svc.rpc("cancel_pending_payment", { p_payment_id: r.data.payment_id, p_reason: "again" });
    assert.equal(c2.data.status, "noop");
    assert.equal(await credit(a.id), 5000, "no double restore");
  });

  // 7
  it("Stripe unavailable after booking reservation → rollback restores credit AND releases the slot", async () => {
    const a = await acct("BookStripeFail");
    const stu = await newStudent(a.id, "Kid");
    await issueCredit(a.id, 700);
    const slot = await nextSlot(subject, 60);
    const r = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start: slot });
    assert.equal(await credit(a.id), 0);
    const c = await svc.rpc("cancel_pending_payment", { p_payment_id: r.data.payment_id, p_reason: "stripe unavailable" });
    assert.equal(c.data.status, "canceled");
    assert.equal(await credit(a.id), 700, "credit restored");
    assert.equal((await getBooking(r.data.booking_id)).status, "expired", "slot released");
    // Slot is bookable again (release proves the exclusion no longer blocks it).
    const slots = await svc.rpc("get_available_slots", { p_subject_id: subject, p_duration: 60, p_from: new Date(Date.now() + 3 * 3600_000).toISOString(), p_to: new Date(Date.now() + 20 * 86400_000).toISOString() });
    assert.ok(slots.data.some((s) => s.slot_start === slot), "released slot is available again");
  });

  // 8
  it("duplicate cleanup cannot restore credit twice", async () => {
    const a = await acct("DupCleanup");
    const pkg = await pkgId("pkg_14h");
    await issueCredit(a.id, 5000);
    const r = await svc.rpc("purchase_package", { p_package_id: pkg.id, p_account: a.id });
    await svc.from("payments").update({ expires_at: PAST() }).eq("id", r.data.payment_id);
    await svc.rpc("release_expired_checkouts");
    await svc.rpc("release_expired_checkouts"); // run again
    await svc.rpc("cancel_pending_payment", { p_payment_id: r.data.payment_id, p_reason: "x" }); // and explicit
    assert.equal(await credit(a.id), 5000, "credit restored exactly once");
  });

  // 9
  it("late webhook after cleanup cannot duplicate credited value", async () => {
    const a = await acct("LateDup");
    const pkg = await pkgId("pkg_14h");
    await issueCredit(a.id, 5000);
    const r = await svc.rpc("purchase_package", { p_package_id: pkg.id, p_account: a.id });
    const due = pkg.price_cents - 5000;
    await svc.from("payments").update({ expires_at: PAST() }).eq("id", r.data.payment_id);
    await svc.rpc("release_expired_checkouts");
    const f1 = await svc.rpc("fulfill_package_payment", { p_payment_id: r.data.payment_id, p_amount_cents: due });
    assert.equal(f1.data.status, "credited");
    const f2 = await svc.rpc("fulfill_package_payment", { p_payment_id: r.data.payment_id, p_amount_cents: due });
    assert.equal(f2.data.status, "already_fulfilled");
    assert.equal(await credit(a.id), 5000 + due, "value credited exactly once");
    assert.equal(await minutes(a.id), 0);
  });

  // 10
  it("valid package Stripe success before expiry issues minutes exactly once", async () => {
    const a = await acct("PkgHappy");
    const pkg = await pkgId("pkg_14h");
    await issueCredit(a.id, 5000);
    const r = await svc.rpc("purchase_package", { p_package_id: pkg.id, p_account: a.id });
    const due = pkg.price_cents - 5000;
    const f1 = await svc.rpc("fulfill_package_payment", { p_payment_id: r.data.payment_id, p_amount_cents: due, p_charge_id: "pi_ok" });
    assert.equal(f1.data.status, "completed");
    assert.equal(await minutes(a.id), pkg.minutes);
    const f2 = await svc.rpc("fulfill_package_payment", { p_payment_id: r.data.payment_id, p_amount_cents: due });
    assert.equal(f2.data.status, "already_fulfilled");
    assert.equal(await minutes(a.id), pkg.minutes, "minutes issued exactly once");
  });
});
