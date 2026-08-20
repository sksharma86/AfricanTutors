import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, cleanupAll, createUser, hasSupabaseEnv, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;

describe("Phase 8 — customer data isolation & safe identity (live)", { skip: !hasSupabaseEnv }, () => {
  let custA, custB, studentA, studentB, bookingA, bookingB, clientA;
  const accounts = [];

  async function mkStudent(account, name) {
    const { data, error } = await svc
      .from("students")
      .insert({ account_id: account, full_name: name, grade_level: "9", timezone: "America/Chicago" })
      .select("id")
      .single();
    if (error) throw new Error(`student: ${error.message}`);
    return data.id;
  }
  async function mkCompletedBooking(account, student) {
    const start = new Date(Date.now() - 3 * 86400000);
    const { data, error } = await svc
      .from("bookings")
      .insert({
        account_id: account, student_id: student, tutor_id: null,
        scheduled_start: start.toISOString(), scheduled_end: new Date(start.getTime() + 3600000).toISOString(),
        duration_minutes: 60, is_free_trial: false, price_cents: 2000, status: "completed",
        payment_status: "paid", student_first_name: "Amara", subject_name: "Algebra I",
        tutor_display_name: "Ms. Ada",
      })
      .select("id")
      .single();
    if (error) throw new Error(`booking: ${error.message}`);
    return data.id;
  }

  before(async () => {
    custA = await createUser({ requestedRole: "student", displayName: "Parent A" });
    custB = await createUser({ requestedRole: "student", displayName: "Parent B" });
    accounts.push(custA.id, custB.id);
    studentA = await mkStudent(custA.id, "Amara A");
    studentB = await mkStudent(custB.id, "Bola B");
    bookingA = await mkCompletedBooking(custA.id, studentA);
    bookingB = await mkCompletedBooking(custB.id, studentB);
    await svc.from("disputes").insert([
      { account_id: custA.id, booking_id: bookingA, category: "quality", status: "under_review", complaint: "A private note" },
      { account_id: custB.id, booking_id: bookingB, category: "quality", status: "open", complaint: "B private note" },
    ]);
    clientA = await signIn(custA.email, custA.password);
  });

  after(async () => {
    await svc.from("disputes").delete().in("account_id", accounts);
    await svc.from("bookings").delete().in("account_id", accounts);
    await svc.from("students").delete().in("account_id", accounts);
    await cleanupAll();
  });

  it("a customer sees only their own bookings", async () => {
    const { data } = await clientA.from("bookings").select("id, account_id");
    const ids = (data ?? []).map((r) => r.id);
    assert.ok(ids.includes(bookingA), "own booking visible");
    assert.ok(!ids.includes(bookingB), "other customer's booking hidden");
    for (const r of data ?? []) assert.equal(r.account_id, custA.id);
  });

  it("a customer cannot read another customer's booking by id", async () => {
    const { data } = await clientA.from("bookings").select("id").eq("id", bookingB).maybeSingle();
    assert.equal(data, null, "RLS blocks cross-account read");
  });

  it("customer booking rows expose no tutor/customer contact fields", async () => {
    const { data } = await clientA.from("bookings").select("*").eq("id", bookingA).single();
    const keys = Object.keys(data);
    for (const k of keys) assert.ok(!/email|phone|contact/i.test(k), `unexpected contact field: ${k}`);
    assert.equal(data.tutor_display_name, "Ms. Ada", "safe display identity only");
  });

  it("list_my_dispute_statuses returns only the caller's issues (id + status only)", async () => {
    const { data, error } = await clientA.rpc("list_my_dispute_statuses");
    assert.equal(error, null);
    const rows = data ?? [];
    assert.equal(rows.length, 1, "only own dispute");
    assert.equal(rows[0].booking_id, bookingA);
    assert.equal(rows[0].status, "under_review");
    assert.deepEqual(Object.keys(rows[0]).sort(), ["booking_id", "status"], "no complaint/admin fields leaked");
  });

  it("disputes table itself is not directly readable by the customer (admin-only RLS)", async () => {
    const { data } = await clientA.from("disputes").select("id, complaint");
    assert.equal((data ?? []).length, 0, "no direct dispute rows exposed to customer");
  });
});
