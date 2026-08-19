import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe("Phase 6 — tutor-assignment idempotency + failed-delivery retry (live)", { skip: !hasSupabaseEnv }, () => {
  let admin, cust, cC;
  const accounts = [];

  before(async () => {
    admin = await createUser({ requestedRole: "student", displayName: "Admin R" });
    await makeAdmin(admin.id);
    cust = await createUser({ requestedRole: "student", displayName: "Cust R" });
    cC = await signIn(cust.email, cust.password);
    accounts.push(admin.id, cust.id);
  });
  after(async () => {
    await svc.from("email_deliveries").delete().in("recipient_account_id", accounts);
    await cleanupAll();
  });

  const claim = (key, extra = {}) =>
    svc.rpc("claim_email_delivery", { p_key: key, p_type: "tutor_new_session", p_account: cust.id, p_to: "x@x.test", ...extra });

  it("tutor assignment key includes tutor id: A once, B after reassignment, no cross-send", async () => {
    const b = uniq();
    const A = `tutor-new-session:${b}:tutorA`;
    const B = `tutor-new-session:${b}:tutorB`;
    assert.equal((await claim(A)).data, true, "Tutor A assigned once");
    assert.equal((await claim(A)).data, false, "duplicate Tutor A suppressed");
    assert.equal((await claim(B)).data, true, "Tutor B notified after reassignment");
    assert.equal((await claim(B)).data, false, "duplicate Tutor B suppressed");
    // customer booking-confirmation idempotency is independent and unchanged
    const conf = `booking-confirmed:${b}`;
    assert.equal((await svc.rpc("claim_email_delivery", { p_key: conf, p_type: "booking_confirmed", p_account: cust.id, p_to: "x@x.test" })).data, true);
    assert.equal((await svc.rpc("claim_email_delivery", { p_key: conf, p_type: "booking_confirmed", p_account: cust.id, p_to: "x@x.test" })).data, false);
  });

  it("a failed delivery can be retried (attempts increment, content preserved)", async () => {
    const key = `refund-issued:${uniq()}`;
    await svc.rpc("claim_email_delivery", { p_key: key, p_type: "refund_issued", p_account: cust.id, p_to: "x@x.test", p_subject: "S", p_html: "<b>H</b>", p_text: "T" });
    await svc.rpc("complete_email_delivery", { p_key: key, p_status: "failed", p_error: "boom" });
    const { data: row } = await svc.from("email_deliveries").select("id, attempts, subject, body_text").eq("idempotency_key", key).single();
    assert.equal(row.attempts, 1);
    assert.equal(row.body_text, "T", "rendered content stored for retry");

    const r = await svc.rpc("retry_email_delivery", { p_delivery_id: row.id });
    assert.equal(r.data.retried, true);
    assert.equal(r.data.text, "T", "retry returns stored content to re-send");
    const { data: after } = await svc.from("email_deliveries").select("attempts, status").eq("id", row.id).single();
    assert.equal(after.attempts, 2, "attempts incremented");
    assert.equal(after.status, "pending", "flipped back to pending for the resend");
  });

  it("a sent delivery cannot be retried via the failed-only path", async () => {
    const key = `booking-confirmed:${uniq()}`;
    await svc.rpc("claim_email_delivery", { p_key: key, p_type: "booking_confirmed", p_account: cust.id, p_to: "x@x.test" });
    await svc.rpc("complete_email_delivery", { p_key: key, p_status: "sent", p_provider_message_id: "msg" });
    const { data: row } = await svc.from("email_deliveries").select("id").eq("idempotency_key", key).single();
    const r = await svc.rpc("retry_email_delivery", { p_delivery_id: row.id });
    assert.equal(r.data.retried, false, "sent deliveries are not retried");
  });

  it("two concurrent retries cannot both send", async () => {
    const key = `refund-issued:${uniq()}`;
    await svc.rpc("claim_email_delivery", { p_key: key, p_type: "refund_issued", p_account: cust.id, p_to: "x@x.test", p_subject: "S", p_text: "T" });
    await svc.rpc("complete_email_delivery", { p_key: key, p_status: "failed", p_error: "boom" });
    const { data: row } = await svc.from("email_deliveries").select("id").eq("idempotency_key", key).single();
    const [r1, r2] = await Promise.all([
      svc.rpc("retry_email_delivery", { p_delivery_id: row.id }),
      svc.rpc("retry_email_delivery", { p_delivery_id: row.id }),
    ]);
    const won = [r1.data?.retried, r2.data?.retried].filter((x) => x === true).length;
    assert.equal(won, 1, "exactly one concurrent retry claims the failed delivery");
    assert.equal((await svc.from("email_deliveries").select("attempts").eq("id", row.id).single()).data.attempts, 2, "attempts incremented once");
  });

  it("non-admin cannot retry a failed delivery", async () => {
    const key = `refund-issued:${uniq()}`;
    await svc.rpc("claim_email_delivery", { p_key: key, p_type: "refund_issued", p_account: cust.id, p_to: "x@x.test" });
    await svc.rpc("complete_email_delivery", { p_key: key, p_status: "failed", p_error: "boom" });
    const { data: row } = await svc.from("email_deliveries").select("id").eq("idempotency_key", key).single();
    assert.ok((await cC.rpc("retry_email_delivery", { p_delivery_id: row.id })).error, "customer blocked from retry");
  });
});
