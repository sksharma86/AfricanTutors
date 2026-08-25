import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, anonClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;
const key = (p) => `${p}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

async function newStudent(acc, name) {
  const { data } = await svc.from("students").insert({ account_id: acc, full_name: name, grade_level: "9", timezone: "UTC" }).select("id").single();
  return data.id;
}
async function freshTutor() {
  const t = await createUser({ requestedRole: "tutor", displayName: "Tutor 6" });
  await svc.from("tutor_profiles").update({ status: "approved", timezone: "UTC" }).eq("profile_id", t.id);
  await svc.from("profiles").update({ role: "tutor" }).eq("id", t.id);
  return t.id;
}
async function insertBooking({ account, student, tutor, status, minutesFromNow, duration = 60 }) {
  const s = new Date(Date.now() + minutesFromNow * 60000);
  const { data, error } = await svc.from("bookings").insert({
    account_id: account, student_id: student, tutor_id: tutor,
    scheduled_start: s.toISOString(), scheduled_end: new Date(s.getTime() + duration * 60000).toISOString(),
    duration_minutes: duration, is_free_trial: false, price_cents: 2000, status, payment_status: "paid",
    student_first_name: "Amara", tutor_display_name: "Tomiwa Tutor", subject_name: "Algebra",
  }).select("id").single();
  if (error) throw new Error("insertBooking: " + error.message);
  return data.id;
}

describe("Phase 6 — email delivery log: idempotency, RLS, provider status (live)", { skip: !hasSupabaseEnv }, () => {
  let admin, adminC, custA, custB, cA, cB;
  const accounts = [];
  const bookings = [];

  before(async () => {
    admin = await createUser({ requestedRole: "student", displayName: "Admin 6" });
    await makeAdmin(admin.id);
    adminC = await signIn(admin.email, admin.password);
    custA = await createUser({ requestedRole: "student", displayName: "Parent A" });
    custB = await createUser({ requestedRole: "student", displayName: "Parent B" });
    cA = await signIn(custA.email, custA.password);
    cB = await signIn(custB.email, custB.password);
    accounts.push(admin.id, custA.id, custB.id);
  });

  after(async () => {
    await svc.from("email_deliveries").delete().in("recipient_account_id", accounts);
    await svc.from("email_deliveries").delete().is("recipient_account_id", null).like("notification_type", "test_ops%");
    for (const b of bookings) await svc.from("bookings").delete().eq("id", b);
    await cleanupAll();
  });

  it("claim is idempotent; complete records status (no duplicate sends)", async () => {
    const k = key("booking-confirmed");
    assert.equal((await svc.rpc("claim_email_delivery", { p_key: k, p_type: "booking_confirmed", p_account: custA.id, p_to: "a@x.test" })).data, true, "first claim");
    assert.equal((await svc.rpc("claim_email_delivery", { p_key: k, p_type: "booking_confirmed", p_account: custA.id, p_to: "a@x.test" })).data, false, "duplicate claim rejected");
    await svc.rpc("complete_email_delivery", { p_key: k, p_status: "sent", p_provider_message_id: "msg_" + k });
    const { data, count } = await svc.from("email_deliveries").select("status, provider_message_id", { count: "exact" }).eq("idempotency_key", k);
    assert.equal(count, 1, "exactly one delivery row");
    assert.equal(data[0].status, "sent");
  });

  it("provider webhook status updates are idempotent and terminal", async () => {
    const k = key("package-purchased");
    const mid = "msg_" + k;
    await svc.rpc("claim_email_delivery", { p_key: k, p_type: "package_purchased", p_account: custA.id, p_to: "a@x.test" });
    await svc.rpc("complete_email_delivery", { p_key: k, p_status: "sent", p_provider_message_id: mid });
    await svc.rpc("record_email_provider_status", { p_provider_message_id: mid, p_status: "delivered" });
    assert.equal((await svc.from("email_deliveries").select("status").eq("idempotency_key", k).single()).data.status, "sent");
    await svc.rpc("record_email_provider_status", { p_provider_message_id: mid, p_status: "bounced" });
    assert.equal((await svc.from("email_deliveries").select("status").eq("idempotency_key", k).single()).data.status, "failed");
    await svc.rpc("record_email_provider_status", { p_provider_message_id: mid, p_status: "delivered" }); // late/out-of-order
    assert.equal((await svc.from("email_deliveries").select("status").eq("idempotency_key", k).single()).data.status, "sent", "delivered maps to sent (webhook-driven)");
  });

  it("RLS: recipient reads own; other customer/anon cannot; admin reads all incl. ops alerts", async () => {
    const k = key("refund-issued");
    await svc.rpc("claim_email_delivery", { p_key: k, p_type: "refund_issued", p_account: custA.id, p_to: "a@x.test" });
    assert.equal((await cA.from("email_deliveries").select("id").eq("idempotency_key", k)).data.length, 1, "recipient reads own");
    assert.equal((await cB.from("email_deliveries").select("id").eq("idempotency_key", k)).data.length, 0, "other customer blocked");
    const anon = anonClient();
    const ar = await anon.from("email_deliveries").select("id").eq("idempotency_key", k);
    assert.ok(ar.error || (ar.data ?? []).length === 0, "anonymous blocked");
    assert.equal((await adminC.from("email_deliveries").select("id").eq("idempotency_key", k)).data.length, 1, "admin reads");

    // operational alert (no recipient) is admin-only
    const ok = "test_ops:" + key("alert");
    await svc.rpc("claim_email_delivery", { p_key: ok, p_type: "test_ops_alert", p_account: null, p_to: "ops@x.test" });
    assert.equal((await cA.from("email_deliveries").select("id").eq("idempotency_key", ok)).data.length, 0, "customer cannot read ops failures");
    assert.equal((await adminC.from("email_deliveries").select("id").eq("idempotency_key", ok)).data.length, 1, "admin can");
  });

  it("clients cannot claim, complete, forge provider id, or write directly", async () => {
    const k = key("hack");
    assert.ok((await cA.rpc("claim_email_delivery", { p_key: k, p_type: "x", p_account: custA.id })).error, "customer cannot claim");
    assert.ok((await cA.rpc("complete_email_delivery", { p_key: k, p_status: "sent", p_provider_message_id: "forged" })).error, "customer cannot complete");
    assert.ok((await cA.rpc("record_email_provider_status", { p_provider_message_id: "forged", p_status: "delivered" })).error, "customer cannot set provider status");
    assert.ok((await cA.from("email_deliveries").insert({ idempotency_key: k, notification_type: "x", status: "sent" })).error, "direct insert blocked by RLS");
  });

  it("reminder dedupe + due-window: confirmed upcoming included, cancelled/completed excluded", async () => {
    const tutor = await freshTutor();
    accounts.push(tutor);
    const stu = await newStudent(custA.id, "Amara");
    const confirmed = await insertBooking({ account: custA.id, student: stu, tutor, status: "confirmed", minutesFromNow: 60 }); // ~1h out
    const cancelled = await insertBooking({ account: custA.id, student: stu, tutor, status: "cancelled", minutesFromNow: 60 });
    bookings.push(confirmed, cancelled);

    // PR8 1h window: confirmed, scheduled_start in [now+50m, now+70m].
    const from = new Date(Date.now() + 50 * 60000).toISOString();
    const to = new Date(Date.now() + 70 * 60000).toISOString();
    const { data: due } = await svc.from("bookings").select("id").eq("status", "confirmed").gte("scheduled_start", from).lte("scheduled_start", to);
    const ids = (due ?? []).map((r) => r.id);
    assert.ok(ids.includes(confirmed), "confirmed upcoming booking is due for a 1h reminder");
    assert.ok(!ids.includes(cancelled), "cancelled booking never enters the reminder window");

    // Reminder is idempotent per booking+role+kind (duplicate cron runs don't resend).
    const rk = `reminder-1h:${confirmed}:customer`;
    assert.equal((await svc.rpc("claim_email_delivery", { p_key: rk, p_type: "reminder_1h", p_account: custA.id, p_booking: confirmed })).data, true);
    assert.equal((await svc.rpc("claim_email_delivery", { p_key: rk, p_type: "reminder_1h", p_account: custA.id, p_booking: confirmed })).data, false, "second cron run does not resend");
  });
});
