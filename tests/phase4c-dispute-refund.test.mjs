import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;
const SFX = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const ref = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function newSubject(name) {
  const { data, error } = await svc.from("subjects").insert({ name: `${name} ${SFX}`, category: "math" }).select("id").single();
  if (error) throw new Error("newSubject: " + error.message);
  return data.id;
}
async function newStudent(acc, name) {
  const { data } = await svc.from("students").insert({ account_id: acc, full_name: name, grade_level: "9", timezone: "UTC" }).select("id").single();
  return data.id;
}
const getPayment = async (id) => (await svc.from("payments").select("*").eq("id", id).single()).data;
const disputeStatus = async (id) => (await svc.from("disputes").select("status").eq("id", id).single()).data.status;

async function nextSlot(subject, duration, afterMs = 3 * 3600_000) {
  const { data } = await svc.rpc("get_available_slots", {
    p_subject_id: subject, p_duration: duration,
    p_from: new Date(Date.now() + afterMs).toISOString(), p_to: new Date(Date.now() + 25 * 86400_000).toISOString(),
  });
  if (!data?.length) throw new Error("no slots");
  return data[0].slot_start;
}
const clientCache = new Map();
async function clientFor(acct) {
  if (!clientCache.has(acct.email)) clientCache.set(acct.email, await signIn(acct.email, acct.password));
  return clientCache.get(acct.email);
}
// A confirmed, Stripe-funded booking (so the payment has a real refundable amount).
async function stripeBooking(acct, stu, subject, afterMs) {
  const c = await clientFor(acct);
  const r = await c.rpc("book_session", { p_student_id: stu, p_subject_id: subject, p_other_subject: null, p_request_note: null, p_duration: 60, p_start: await nextSlot(subject, 60, afterMs), p_is_free_trial: false });
  if (r.error) throw new Error("book: " + r.error.message);
  const f = await svc.rpc("fulfill_booking_payment", { p_payment_id: r.data.payment_id, p_amount_cents: 1200, p_charge_id: "pi_" + ref("x") });
  if (f.data.status !== "confirmed") throw new Error("fulfill failed: " + JSON.stringify(f.data));
  return { bookingId: r.data.booking_id, paymentId: r.data.payment_id };
}
async function packagePurchase(acct) {
  const { data: pkg } = await svc.from("package_products").select("id, price_cents").eq("code", "pkg_14h").single();
  const r = await svc.rpc("purchase_package", { p_package_id: pkg.id, p_account: acct.id });
  await svc.rpc("fulfill_package_payment", { p_payment_id: r.data.payment_id, p_amount_cents: pkg.price_cents, p_charge_id: "pi_pkg" });
  return r.data.payment_id;
}

describe("Phase 4C — dispute refund must belong to the dispute (live)", { skip: !hasSupabaseEnv }, () => {
  let admin, adminC, tutor, subject, custA, custB, stuA, stuA2, stuB;
  let bookingA, paymentA, paymentA2, paymentB, pkgPaymentA, disputeA;
  const accounts = [];

  before(async () => {
    admin = await createUser({ requestedRole: "student", displayName: "Admin DR" });
    await makeAdmin(admin.id);
    adminC = await signIn(admin.email, admin.password);
    tutor = await createUser({ requestedRole: "tutor", displayName: "Tutor DR" });
    await svc.from("tutor_profiles").update({ status: "approved", timezone: "UTC", comp_rate_cents_per_hour: 1000 }).eq("profile_id", tutor.id);
    await svc.from("profiles").update({ role: "tutor" }).eq("id", tutor.id);
    subject = await newSubject("DR");
    await svc.from("tutor_subjects").insert({ tutor_id: tutor.id, subject_id: subject });
    for (let d = 0; d < 7; d++) await svc.from("tutor_availability").insert({ tutor_id: tutor.id, day_of_week: d, start_time: "00:00", end_time: "23:59" });

    custA = await createUser({ requestedRole: "student", displayName: "Cust A" });
    custB = await createUser({ requestedRole: "student", displayName: "Cust B" });
    accounts.push(admin.id, tutor.id, custA.id, custB.id);
    stuA = await newStudent(custA.id, "KidA");
    stuA2 = await newStudent(custA.id, "KidA2");
    stuB = await newStudent(custB.id, "KidB");

    // Customer A: booking A (disputed) + a second booking A2; and a package purchase.
    ({ bookingId: bookingA, paymentId: paymentA } = await stripeBooking(custA, stuA, subject, 3 * 3600_000));
    ({ paymentId: paymentA2 } = await stripeBooking(custA, stuA2, subject, 6 * 86400_000));
    pkgPaymentA = await packagePurchase(custA);
    // Customer B: their own stripe booking (different customer).
    ({ paymentId: paymentB } = await stripeBooking(custB, stuB, subject, 9 * 86400_000));

    await adminC.rpc("admin_complete_booking", { p_booking: bookingA });
    disputeA = (await (await clientFor(custA)).rpc("create_dispute", { p_booking: bookingA, p_category: "quality", p_complaint: "issue" })).data;
  });

  after(async () => {
    await svc.from("disputes").delete().in("account_id", accounts);
    await svc.from("tutor_earnings").delete().eq("tutor_id", tutor.id);
    for (const acc of accounts) {
      await svc.from("refunds").delete().eq("account_id", acc);
      await svc.from("package_minute_ledger").delete().eq("account_id", acc);
      await svc.from("dollar_credit_ledger").delete().eq("account_id", acc);
      await svc.from("payments").delete().eq("account_id", acc);
    }
    await svc.from("subjects").delete().eq("id", subject);
    await cleanupAll();
  });

  const resolveWithRefund = (paymentId, cents, rid) =>
    adminC.rpc("admin_resolve_dispute", {
      p_dispute: disputeA, p_resolution: "upheld", p_notes: "n",
      p_restore_minutes: 0, p_credit_cents: 0,
      p_refund_payment: paymentId, p_refund_cents: cents, p_refund_stripe_id: rid,
      p_earning_action: null, p_earning_new_cents: null,
    });

  it("REJECT: cannot refund another customer's payment", async () => {
    const r = await resolveWithRefund(paymentB, 1000, ref("re"));
    assert.ok(r.error, "must reject a different customer's payment");
    assert.match(r.error.message, /different customer/i);
    assert.equal(await disputeStatus(disputeA), "open", "dispute unchanged after rejected refund");
    assert.equal((await getPayment(paymentB)).refunded_cents, 0, "other customer not refunded");
  });

  it("REJECT: cannot refund another booking of the same customer", async () => {
    const r = await resolveWithRefund(paymentA2, 1000, ref("re"));
    assert.ok(r.error, "must reject a different booking's payment");
    assert.match(r.error.message, /different booking/i);
    assert.equal(await disputeStatus(disputeA), "open");
    assert.equal((await getPayment(paymentA2)).refunded_cents, 0);
  });

  it("REJECT: cannot refund an unrelated package payment", async () => {
    const r = await resolveWithRefund(pkgPaymentA, 1000, ref("re"));
    assert.ok(r.error, "must reject a package payment");
    assert.match(r.error.message, /not a booking payment/i);
    assert.equal(await disputeStatus(disputeA), "open");
    assert.equal((await getPayment(pkgPaymentA)).refunded_cents, 0);
  });

  it("REJECT: refund exceeding the refundable amount rolls back the whole resolution", async () => {
    const r = await resolveWithRefund(paymentA, 9999, ref("re"));
    assert.ok(r.error, "over-cap refund rejected");
    assert.equal(await disputeStatus(disputeA), "open", "resolution rolled back");
    assert.equal((await getPayment(paymentA)).refunded_cents, 0);
  });

  it("ALLOW: dispute refunds its OWN booking payment; idempotent thereafter", async () => {
    const rid = ref("re");
    const ok = await resolveWithRefund(paymentA, 800, rid);
    assert.equal(ok.error, null, ok.error && ok.error.message);
    assert.equal(ok.data.resolution, "upheld");
    assert.equal((await getPayment(paymentA)).refunded_cents, 800, "own payment refunded");
    assert.equal(await disputeStatus(disputeA), "resolved");
    // Already-resolved dispute is a safe no-op (no double refund).
    const again = await resolveWithRefund(paymentA, 800, ref("re2"));
    assert.equal(again.data.status, "noop");
    assert.equal((await getPayment(paymentA)).refunded_cents, 800, "no double refund");
  });
});
