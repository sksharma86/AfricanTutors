import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, anonClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;
const ref = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function seedBookingRow(accountId, studentId, tutorId, minutes = 30) {
  const { data, error } = await svc
    .from("bookings")
    .insert({ account_id: accountId, student_id: studentId, tutor_id: tutorId, duration_minutes: minutes, status: "completed", price_cents: minutes === 30 ? 1200 : 2000 })
    .select("id")
    .single();
  if (error) throw new Error("seedBookingRow: " + error.message);
  return data.id;
}

describe("Phase 4A — financial foundation (live)", { skip: !hasSupabaseEnv }, () => {
  let parent, parent2, admin, tutor;
  let studentId, booking1, booking2;

  before(async () => {
    parent = await createUser({ requestedRole: "student", displayName: "Pat Parent" });
    parent2 = await createUser({ requestedRole: "student", displayName: "Second Parent" });
    admin = await createUser({ requestedRole: "student", displayName: "Ada Admin" });
    await makeAdmin(admin.id);
    tutor = await createUser({ requestedRole: "tutor", displayName: "Tutor Tomiwa" });
    await svc.from("tutor_profiles").update({ status: "approved", timezone: "UTC" }).eq("profile_id", tutor.id);
    await svc.from("profiles").update({ role: "tutor" }).eq("id", tutor.id);
    const { data: stu } = await svc.from("students").insert({ account_id: parent.id, full_name: "Kid", grade_level: "9", timezone: "UTC" }).select("id").single();
    studentId = stu.id;
    booking1 = await seedBookingRow(parent.id, studentId, tutor.id, 30);
    booking2 = await seedBookingRow(parent.id, studentId, tutor.id, 60);
  });

  after(async () => {
    await cleanupAll();
  });

  it("package products are seeded with integer-cent pricing", async () => {
    const { data } = await svc.from("package_products").select("code, minutes, price_cents").in("code", ["pkg_10h", "pkg_20h", "pkg_40h"]);
    const by = Object.fromEntries(data.map((p) => [p.code, p]));
    assert.deepEqual([by.pkg_10h.minutes, by.pkg_10h.price_cents], [600, 19000]);
    assert.deepEqual([by.pkg_20h.minutes, by.pkg_20h.price_cents], [1200, 36000]);
    assert.deepEqual([by.pkg_40h.minutes, by.pkg_40h.price_cents], [2400, 68000]);
    assert.ok(data.every((p) => Number.isInteger(p.price_cents)));
  });

  it("package minutes: issuance is idempotent and balance derives from the ledger", async () => {
    const r = ref("pkg");
    const first = await svc.rpc("issue_package_minutes", { p_account: parent.id, p_minutes: 600, p_reference: r });
    const dup = await svc.rpc("issue_package_minutes", { p_account: parent.id, p_minutes: 600, p_reference: r });
    assert.equal(first.data, true, "first issuance inserts");
    assert.equal(dup.data, false, "duplicate reference is a no-op");
    const bal = await svc.rpc("get_package_minutes", { p_account: parent.id });
    assert.equal(bal.data, 600, "balance reflects a single issuance");
  });

  it("package minutes: consumption reduces balance; over-consumption is rejected", async () => {
    const c = await svc.rpc("consume_package_minutes", { p_account: parent.id, p_minutes: 400, p_booking_id: booking1, p_reference: ref("con") });
    assert.equal(c.error, null, c.error && c.error.message);
    const bal = await svc.rpc("get_package_minutes", { p_account: parent.id });
    assert.equal(bal.data, 200);
    const over = await svc.rpc("consume_package_minutes", { p_account: parent.id, p_minutes: 9999, p_booking_id: booking1, p_reference: ref("con") });
    assert.ok(over.error, "over-consumption rejected");
    assert.match(over.error.message, /Insufficient/i);
  });

  it("dollar credit: issuance/consumption derive a balance; over-consumption rejected", async () => {
    await svc.rpc("issue_dollar_credit", { p_account: parent.id, p_amount_cents: 5000, p_entry_type: "admin_adjustment", p_reference: ref("cr") });
    let bal = await svc.rpc("get_dollar_credit", { p_account: parent.id });
    assert.equal(bal.data, 5000);
    await svc.rpc("consume_dollar_credit", { p_account: parent.id, p_amount_cents: 3000, p_reference: ref("cr") });
    bal = await svc.rpc("get_dollar_credit", { p_account: parent.id });
    assert.equal(bal.data, 2000);
    const over = await svc.rpc("consume_dollar_credit", { p_account: parent.id, p_amount_cents: 9999, p_reference: ref("cr") });
    assert.ok(over.error, "over-consumption rejected");
  });

  it("tutor earnings: 30-min=50%, snapshot preserved after future rate change", async () => {
    const adminC = await signIn(admin.email, admin.password);
    await adminC.rpc("admin_set_tutor_rate", { p_tutor: tutor.id, p_rate_cents: 1000 });
    // 30-min earning → $5.00 = 500 cents
    const e1 = await svc.rpc("record_tutor_earning", { p_tutor: tutor.id, p_booking: booking1, p_duration: 30 });
    assert.equal(e1.error, null, e1.error && e1.error.message);
    const { data: earn1 } = await svc.from("tutor_earnings").select("amount_cents, rate_cents_per_hour, status").eq("booking_id", booking1).single();
    assert.equal(earn1.amount_cents, 500);
    assert.equal(earn1.rate_cents_per_hour, 1000);
    // duplicate for same booking is a no-op
    const dup = await svc.rpc("record_tutor_earning", { p_tutor: tutor.id, p_booking: booking1, p_duration: 30 });
    assert.equal(dup.data, null, "one earning per booking");
    // change rate, then a NEW booking earning uses the new rate; old one unchanged
    await adminC.rpc("admin_set_tutor_rate", { p_tutor: tutor.id, p_rate_cents: 2000 });
    await svc.rpc("record_tutor_earning", { p_tutor: tutor.id, p_booking: booking2, p_duration: 60 });
    const { data: earn2 } = await svc.from("tutor_earnings").select("amount_cents, rate_cents_per_hour").eq("booking_id", booking2).single();
    assert.equal(earn2.amount_cents, 2000); // 60 min @ $20/hr
    assert.equal(earn2.rate_cents_per_hour, 2000);
    const { data: still } = await svc.from("tutor_earnings").select("amount_cents, rate_cents_per_hour").eq("booking_id", booking1).single();
    assert.equal(still.amount_cents, 500, "historical earning not rewritten");
    assert.equal(still.rate_cents_per_hour, 1000);
  });

  it("a non-admin customer cannot issue package minutes or dollar credit", async () => {
    const c = await signIn(parent.email, parent.password);
    const r1 = await c.rpc("issue_package_minutes", { p_account: parent.id, p_minutes: 600, p_reference: ref("hack") });
    assert.ok(r1.error, "customer cannot issue package minutes");
    const r2 = await c.rpc("issue_dollar_credit", { p_account: parent.id, p_amount_cents: 100000, p_entry_type: "issuance", p_reference: ref("hack") });
    assert.ok(r2.error, "customer cannot issue dollar credit");
  });

  it("a customer cannot directly insert into a ledger (RLS)", async () => {
    const c = await signIn(parent.email, parent.password);
    const r1 = await c.from("package_minute_ledger").insert({ account_id: parent.id, minutes_delta: 100000, entry_type: "purchase", reference: ref("x") });
    assert.ok(r1.error, "direct package-ledger insert denied");
    const r2 = await c.from("dollar_credit_ledger").insert({ account_id: parent.id, amount_cents: 100000, entry_type: "issuance", reference: ref("x") });
    assert.ok(r2.error, "direct dollar-ledger insert denied");
  });

  it("a customer reads only their own ledgers/payments", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data: mine } = await c.from("package_minute_ledger").select("account_id");
    assert.ok(mine.length > 0 && mine.every((r) => r.account_id === parent.id));
    // parent2 sees none of parent's records
    const c2 = await signIn(parent2.email, parent2.password);
    const { data: theirs } = await c2.from("package_minute_ledger").select("account_id").eq("account_id", parent.id);
    assert.equal(theirs.length, 0, "cannot read another account's ledger");
    // cannot read another's balance via function
    const bal = await c2.rpc("get_package_minutes", { p_account: parent.id });
    assert.ok(bal.error, "cannot read another account's balance");
  });

  it("tutor reads own earnings; customers cannot read tutor earnings", async () => {
    const t = await signIn(tutor.email, tutor.password);
    const { data: mine } = await t.from("tutor_earnings").select("tutor_id");
    assert.ok(mine.length > 0 && mine.every((r) => r.tutor_id === tutor.id));
    const c = await signIn(parent.email, parent.password);
    const { data: none } = await c.from("tutor_earnings").select("id");
    assert.equal(none.length, 0, "customer cannot read tutor earnings");
  });

  it("a tutor cannot set their own compensation rate", async () => {
    const t = await signIn(tutor.email, tutor.password);
    await t.from("tutor_profiles").update({ comp_rate_cents_per_hour: 999999 }).eq("profile_id", tutor.id);
    const { data: tp } = await svc.from("tutor_profiles").select("comp_rate_cents_per_hour").eq("profile_id", tutor.id).single();
    assert.notEqual(tp.comp_rate_cents_per_hour, 999999, "tutor must not change own rate");
    const viaRpc = await t.rpc("admin_set_tutor_rate", { p_tutor: tutor.id, p_rate_cents: 999999 });
    assert.ok(viaRpc.error, "tutor cannot call admin_set_tutor_rate");
  });

  it("Stripe event idempotency: first is new, duplicate is a no-op", async () => {
    const evt = `evt_test_${Date.now()}`;
    const first = await svc.rpc("mark_stripe_event_processed", { p_event_id: evt, p_type: "payment_intent.succeeded" });
    const dup = await svc.rpc("mark_stripe_event_processed", { p_event_id: evt, p_type: "payment_intent.succeeded" });
    assert.equal(first.data, true);
    assert.equal(dup.data, false, "duplicate Stripe event is a no-op");
    const c = await signIn(parent.email, parent.password);
    const denied = await c.rpc("mark_stripe_event_processed", { p_event_id: `evt_x_${Date.now()}`, p_type: "x" });
    assert.ok(denied.error, "customers cannot record Stripe events");
  });

  it("anonymous users cannot read financial data", async () => {
    const anon = anonClient();
    for (const table of ["payments", "package_minute_ledger", "dollar_credit_ledger", "tutor_earnings", "stripe_events", "financial_audit_log"]) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      assert.ok(error || (data ?? []).length === 0, `anon must not read ${table}`);
    }
  });
});
