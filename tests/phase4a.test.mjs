import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, anonClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;
const ref = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const evtId = (p) => `evt_${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function seedBooking({ account, student, tutor = undefined, minutes = 30 }) {
  const row = { account_id: account, student_id: student, status: "completed" };
  if (tutor !== undefined) row.tutor_id = tutor;
  if (minutes !== undefined) {
    row.duration_minutes = minutes;
    row.price_cents = minutes === 30 ? 1200 : minutes === 60 ? 2000 : 0;
  }
  const { data, error } = await svc.from("bookings").insert(row).select("id").single();
  if (error) throw new Error("seedBooking: " + error.message);
  return data.id;
}

describe("Phase 4A — financial foundation (live)", { skip: !hasSupabaseEnv }, () => {
  let parent, parent2, admin, tutor;
  let studentId, booking1, booking2, bookingNoTutor, bookingNoDuration;

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
    booking1 = await seedBooking({ account: parent.id, student: studentId, tutor: tutor.id, minutes: 30 });
    booking2 = await seedBooking({ account: parent.id, student: studentId, tutor: tutor.id, minutes: 60 });
    bookingNoTutor = await seedBooking({ account: parent.id, student: studentId, tutor: null, minutes: 30 });
    bookingNoDuration = await seedBooking({ account: parent.id, student: studentId, tutor: tutor.id, minutes: null });
  });

  after(async () => {
    // Financial FKs are RESTRICT, so clear financial rows before deleting users.
    for (const t of ["tutor_earnings", "package_minute_ledger", "dollar_credit_ledger", "payments"]) {
      await svc.from(t).delete().not("id", "is", null);
    }
    await svc.from("stripe_events").delete().neq("id", "");
    await svc.from("financial_audit_log").delete().not("id", "is", null);
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
    assert.equal(first.data, true);
    assert.equal(dup.data, false, "duplicate reference is a no-op");
    const bal = await svc.rpc("get_package_minutes", { p_account: parent.id });
    assert.equal(bal.data, 600);
  });

  it("package minutes: consumption reduces balance; over-consumption rejected", async () => {
    await svc.rpc("consume_package_minutes", { p_account: parent.id, p_minutes: 400, p_booking_id: booking1, p_reference: ref("con") });
    const bal = await svc.rpc("get_package_minutes", { p_account: parent.id });
    assert.equal(bal.data, 200);
    const over = await svc.rpc("consume_package_minutes", { p_account: parent.id, p_minutes: 9999, p_booking_id: booking1, p_reference: ref("con") });
    assert.match(over.error.message, /Insufficient/i);
  });

  it("dollar credit: issuance/consumption derive a balance; over-consumption rejected", async () => {
    await svc.rpc("issue_dollar_credit", { p_account: parent.id, p_amount_cents: 5000, p_entry_type: "admin_adjustment", p_reference: ref("cr") });
    await svc.rpc("consume_dollar_credit", { p_account: parent.id, p_amount_cents: 3000, p_reference: ref("cr") });
    const bal = await svc.rpc("get_dollar_credit", { p_account: parent.id });
    assert.equal(bal.data, 2000);
    const over = await svc.rpc("consume_dollar_credit", { p_account: parent.id, p_amount_cents: 9999, p_reference: ref("cr") });
    assert.ok(over.error);
  });

  it("idempotency references: null and blank are rejected; duplicate stays idempotent", async () => {
    const nullRef = await svc.rpc("issue_package_minutes", { p_account: parent.id, p_minutes: 60, p_reference: null });
    assert.ok(nullRef.error, "null reference rejected");
    const blankRef = await svc.rpc("issue_package_minutes", { p_account: parent.id, p_minutes: 60, p_reference: "   " });
    assert.ok(blankRef.error, "blank reference rejected");
    const nullDollar = await svc.rpc("issue_dollar_credit", { p_account: parent.id, p_amount_cents: 100, p_entry_type: "issuance", p_reference: null });
    assert.ok(nullDollar.error, "null dollar reference rejected");
    // duplicate valid reference remains a safe no-op
    const r = ref("dupref");
    assert.equal((await svc.rpc("issue_package_minutes", { p_account: parent.id, p_minutes: 30, p_reference: r })).data, true);
    assert.equal((await svc.rpc("issue_package_minutes", { p_account: parent.id, p_minutes: 30, p_reference: r })).data, false);
  });

  it("tutor earnings: derived from booking (tutor+duration), 30-min=50%, rate snapshot preserved", async () => {
    const adminC = await signIn(admin.email, admin.password);
    await adminC.rpc("admin_set_tutor_rate", { p_tutor: tutor.id, p_rate_cents: 1000 }); // $10/hr
    const e1 = await svc.rpc("record_tutor_earning", { p_booking: booking1 });
    assert.equal(e1.error, null, e1.error && e1.error.message);
    const { data: earn1 } = await svc.from("tutor_earnings").select("tutor_id, amount_cents, rate_cents_per_hour, duration_minutes").eq("booking_id", booking1).single();
    assert.equal(earn1.tutor_id, tutor.id);
    assert.equal(earn1.duration_minutes, 30);
    assert.equal(earn1.amount_cents, 500); // 30 min @ $10/hr = $5
    // duplicate for same booking → no-op
    assert.equal((await svc.rpc("record_tutor_earning", { p_booking: booking1 })).data, null);
    // change rate; new booking uses new rate; old earning unchanged
    await adminC.rpc("admin_set_tutor_rate", { p_tutor: tutor.id, p_rate_cents: 2000 });
    await svc.rpc("record_tutor_earning", { p_booking: booking2 });
    const { data: earn2 } = await svc.from("tutor_earnings").select("amount_cents, rate_cents_per_hour").eq("booking_id", booking2).single();
    assert.equal(earn2.amount_cents, 2000); // 60 min @ $20/hr
    const { data: still } = await svc.from("tutor_earnings").select("amount_cents, rate_cents_per_hour").eq("booking_id", booking1).single();
    assert.deepEqual([still.amount_cents, still.rate_cents_per_hour], [500, 1000]);
  });

  it("tutor earnings: invalid booking, missing tutor, or missing duration are rejected", async () => {
    const bad = await svc.rpc("record_tutor_earning", { p_booking: "00000000-0000-0000-0000-000000000000" });
    assert.ok(bad.error, "nonexistent booking rejected");
    const noTutor = await svc.rpc("record_tutor_earning", { p_booking: bookingNoTutor });
    assert.match(noTutor.error.message, /no assigned tutor/i);
    const noDur = await svc.rpc("record_tutor_earning", { p_booking: bookingNoDuration });
    assert.match(noDur.error.message, /no valid duration/i);
  });

  it("a non-admin customer cannot issue package minutes or dollar credit", async () => {
    const c = await signIn(parent.email, parent.password);
    assert.ok((await c.rpc("issue_package_minutes", { p_account: parent.id, p_minutes: 600, p_reference: ref("hack") })).error);
    assert.ok((await c.rpc("issue_dollar_credit", { p_account: parent.id, p_amount_cents: 100000, p_entry_type: "issuance", p_reference: ref("hack") })).error);
  });

  it("a customer cannot directly insert into a ledger (RLS)", async () => {
    const c = await signIn(parent.email, parent.password);
    assert.ok((await c.from("package_minute_ledger").insert({ account_id: parent.id, minutes_delta: 100000, entry_type: "purchase", reference: ref("x") })).error);
    assert.ok((await c.from("dollar_credit_ledger").insert({ account_id: parent.id, amount_cents: 100000, entry_type: "issuance", reference: ref("x") })).error);
  });

  it("a customer reads only their own ledgers/balances", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data: mine } = await c.from("package_minute_ledger").select("account_id");
    assert.ok(mine.length > 0 && mine.every((r) => r.account_id === parent.id));
    const c2 = await signIn(parent2.email, parent2.password);
    const { data: theirs } = await c2.from("package_minute_ledger").select("account_id").eq("account_id", parent.id);
    assert.equal(theirs.length, 0);
    assert.ok((await c2.rpc("get_package_minutes", { p_account: parent.id })).error, "cannot read another account's balance");
  });

  it("tutor reads own earnings; customers cannot read tutor earnings", async () => {
    const t = await signIn(tutor.email, tutor.password);
    const { data: mine } = await t.from("tutor_earnings").select("tutor_id");
    assert.ok(mine.length > 0 && mine.every((r) => r.tutor_id === tutor.id));
    const c = await signIn(parent.email, parent.password);
    assert.equal((await c.from("tutor_earnings").select("id")).data.length, 0);
  });

  it("a tutor cannot set their own compensation rate", async () => {
    const t = await signIn(tutor.email, tutor.password);
    await t.from("tutor_profiles").update({ comp_rate_cents_per_hour: 999999 }).eq("profile_id", tutor.id);
    const { data: tp } = await svc.from("tutor_profiles").select("comp_rate_cents_per_hour").eq("profile_id", tutor.id).single();
    assert.notEqual(tp.comp_rate_cents_per_hour, 999999);
    assert.ok((await t.rpc("admin_set_tutor_rate", { p_tutor: tutor.id, p_rate_cents: 999999 })).error);
  });

  it("Stripe event lifecycle: claim → in_progress duplicate → complete → duplicate", async () => {
    const id = evtId("life");
    assert.equal((await svc.rpc("begin_stripe_event", { p_id: id, p_type: "payment_intent.succeeded" })).data, "claimed");
    // a concurrent duplicate delivery (event still processing) must not fulfill
    assert.equal((await svc.rpc("begin_stripe_event", { p_id: id, p_type: "payment_intent.succeeded" })).data, "in_progress");
    await svc.rpc("complete_stripe_event", { p_id: id });
    // after completion, duplicate delivery is a safe no-op
    assert.equal((await svc.rpc("begin_stripe_event", { p_id: id, p_type: "payment_intent.succeeded" })).data, "duplicate");
    // customers cannot drive the event lifecycle
    const c = await signIn(parent.email, parent.password);
    assert.ok((await c.rpc("begin_stripe_event", { p_id: evtId("x"), p_type: "x" })).error);
  });

  it("Stripe event lifecycle: failed fulfillment is retryable, then completes", async () => {
    const id = evtId("retry");
    assert.equal((await svc.rpc("begin_stripe_event", { p_id: id, p_type: "checkout.session.completed" })).data, "claimed");
    // fulfillment failed → mark failed
    await svc.rpc("fail_stripe_event", { p_id: id, p_error: "boom" });
    // Stripe retries → the failed event can be reclaimed and re-fulfilled
    assert.equal((await svc.rpc("begin_stripe_event", { p_id: id, p_type: "checkout.session.completed" })).data, "claimed");
    await svc.rpc("complete_stripe_event", { p_id: id });
    assert.equal((await svc.rpc("begin_stripe_event", { p_id: id, p_type: "checkout.session.completed" })).data, "duplicate");
  });

  it("financial history is preserved: an account with ledger records cannot be physically deleted", async () => {
    const throwaway = await createUser({ requestedRole: "student", displayName: "Temp" });
    await svc.rpc("issue_dollar_credit", { p_account: throwaway.id, p_amount_cents: 1000, p_entry_type: "admin_adjustment", p_reference: ref("hist") });
    const del = await svc.auth.admin.deleteUser(throwaway.id);
    assert.ok(del.error, "deletion must be blocked while financial history exists (RESTRICT)");
    const { count } = await svc.from("dollar_credit_ledger").select("*", { count: "exact", head: true }).eq("account_id", throwaway.id);
    assert.equal(count, 1, "financial record still present");
  });

  it("anonymous users cannot read financial data", async () => {
    const anon = anonClient();
    for (const table of ["payments", "package_minute_ledger", "dollar_credit_ledger", "tutor_earnings", "stripe_events", "financial_audit_log"]) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      assert.ok(error || (data ?? []).length === 0, `anon must not read ${table}`);
    }
  });
});
