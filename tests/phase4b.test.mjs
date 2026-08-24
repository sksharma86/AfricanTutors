import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;
const SFX = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const ref = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function newSubject(name, category = "other") {
  const { data, error } = await svc.from("subjects").insert({ name: `${name} ${SFX}`, category }).select("id").single();
  if (error) throw new Error("newSubject: " + error.message);
  return data.id;
}
async function approveTutor(id, tz = "UTC") {
  await svc.from("tutor_profiles").update({ status: "approved", timezone: tz }).eq("profile_id", id);
  await svc.from("profiles").update({ role: "tutor" }).eq("id", id);
}
async function qualify(t, s) {
  const { error } = await svc.from("tutor_subjects").insert({ tutor_id: t, subject_id: s });
  if (error) throw new Error("qualify: " + error.message);
}
async function avail(t, dow, start, end) {
  const { error } = await svc.from("tutor_availability").insert({ tutor_id: t, day_of_week: dow, start_time: start, end_time: end });
  if (error) throw new Error("avail: " + error.message);
}
async function newStudent(acc, name, tz = "UTC") {
  const { data, error } = await svc.from("students").insert({ account_id: acc, full_name: name, grade_level: "9", timezone: tz }).select("id").single();
  if (error) throw new Error("newStudent: " + error.message);
  return data.id;
}
async function issueMinutes(account, minutes) {
  const { error } = await svc.rpc("issue_package_minutes", { p_account: account, p_minutes: minutes, p_reference: ref("seedmin") });
  if (error) throw new Error("issueMinutes: " + error.message);
}
async function issueCredit(account, cents) {
  const { error } = await svc.rpc("issue_dollar_credit", { p_account: account, p_amount_cents: cents, p_entry_type: "admin_adjustment", p_reference: ref("seedcr") });
  if (error) throw new Error("issueCredit: " + error.message);
}
async function minutes(account) {
  return (await svc.rpc("get_package_minutes", { p_account: account })).data;
}
async function credit(account) {
  return (await svc.rpc("get_dollar_credit", { p_account: account })).data;
}
// Next currently-free slot for a subject/duration (booked/held slots are excluded server-side).
async function nextSlot(subject, duration) {
  const from = new Date(Date.now() + 3 * 3600_000).toISOString();
  const to = new Date(Date.now() + 20 * 86400_000).toISOString();
  const { data, error } = await svc.rpc("get_available_slots", { p_subject_id: subject, p_duration: duration, p_from: from, p_to: to });
  if (error) throw new Error("nextSlot: " + error.message);
  if (!data || data.length === 0) throw new Error("no slots available");
  return data[0].slot_start;
}
// book_session runs the underlying create_booking with the caller's auth.uid(),
// which must own the student — so bookings are placed as the signed-in account.
const clientCache = new Map();
async function clientFor(acct) {
  if (!clientCache.has(acct.email)) clientCache.set(acct.email, await signIn(acct.email, acct.password));
  return clientCache.get(acct.email);
}
async function bookSession(acct, a) {
  const c = await clientFor(acct);
  return c.rpc("book_session", {
    p_student_id: a.studentId,
    p_subject_id: a.subjectId ?? null,
    p_other_subject: a.other ?? null,
    p_request_note: a.note ?? null,
    p_duration: a.duration,
    p_start: a.start ?? null,
    p_is_free_trial: a.free ?? false,
  });
}
// Two currently-free slots at least `duration` apart, so 60-min bookings do not
// overlap and instead contend on the customer's BALANCE.
async function twoDisjointSlots(subject, duration) {
  const from = new Date(Date.now() + 3 * 3600_000).toISOString();
  const to = new Date(Date.now() + 20 * 86400_000).toISOString();
  const { data } = await svc.rpc("get_available_slots", { p_subject_id: subject, p_duration: duration, p_from: from, p_to: to });
  const first = data[0].slot_start;
  const firstEnd = new Date(new Date(first).getTime() + duration * 60000).getTime();
  const second = data.find((r) => new Date(r.slot_start).getTime() >= firstEnd);
  if (!second) throw new Error("need two disjoint slots");
  return [first, second.slot_start];
}
async function getPayment(id) {
  const { data } = await svc.from("payments").select("*").eq("id", id).single();
  return data;
}
async function getBooking(id) {
  const { data } = await svc.from("bookings").select("*").eq("id", id).single();
  return data;
}

describe("Phase 4B — checkout & payment fulfillment (live)", { skip: !hasSupabaseEnv }, () => {
  let parent, parent2, admin, tutor;
  let subject, inactivePkg;
  const accounts = [];

  before(async () => {
    parent = await createUser({ requestedRole: "student", displayName: "Parent 4B" });
    parent2 = await createUser({ requestedRole: "student", displayName: "Parent Two 4B" });
    admin = await createUser({ requestedRole: "student", displayName: "Admin 4B" });
    await makeAdmin(admin.id);
    tutor = await createUser({ requestedRole: "tutor", displayName: "Tutor 4B" });
    await approveTutor(tutor.id, "UTC");
    await svc.from("tutor_profiles").update({ comp_rate_cents_per_hour: 1000 }).eq("profile_id", tutor.id);

    subject = await newSubject("Checkout", "math");
    await qualify(tutor.id, subject);
    for (let d = 0; d < 7; d++) await avail(tutor.id, d, "00:00", "23:59");

    accounts.push(parent.id, parent2.id, admin.id);

    // An inactive package for the rejection test.
    const { data } = await svc
      .from("package_products")
      .insert({ code: `pkg_inactive_${SFX}`, name: "Inactive", minutes: 100, price_cents: 5000, is_active: false })
      .select("id")
      .single();
    inactivePkg = data.id;
  });

  after(async () => {
    // Financial FKs are RESTRICT — remove financial rows for our accounts before deleting users.
    for (const acc of accounts) {
      await svc.from("package_minute_ledger").delete().eq("account_id", acc);
      await svc.from("dollar_credit_ledger").delete().eq("account_id", acc);
      await svc.from("payments").delete().eq("account_id", acc);
    }
    await svc.from("tutor_earnings").delete().eq("tutor_id", tutor.id);
    await svc.from("package_products").delete().eq("id", inactivePkg);
    await svc.from("subjects").delete().eq("id", subject);
    await cleanupAll();
  });

  async function pkgId(code) {
    const { data } = await svc.from("package_products").select("id, minutes, price_cents").eq("code", code).single();
    return data;
  }

  // ---- Quote ---------------------------------------------------------------
  it("booking_quote: standard prices, no balances -> full Stripe due", async () => {
    const q30 = (await svc.rpc("booking_quote", { p_account: parent.id, p_duration: 30, p_is_free_trial: false })).data;
    assert.deepEqual([q30.session_price_cents, q30.stripe_cents_due, q30.funding], [1200, 1200, "stripe"]);
    const q60 = (await svc.rpc("booking_quote", { p_account: parent.id, p_duration: 60, p_is_free_trial: false })).data;
    assert.deepEqual([q60.session_price_cents, q60.stripe_cents_due, q60.funding], [1200, 1200, "stripe"]);
    const qf = (await svc.rpc("booking_quote", { p_account: parent.id, p_duration: 60, p_is_free_trial: true })).data;
    assert.deepEqual([qf.session_price_cents, qf.stripe_cents_due, qf.funding], [0, 0, "free_trial"]);
  });

  // ---- Package-minute full coverage ---------------------------------------
  it("package minutes fully cover a session: no Stripe, booking confirmed, minutes consumed", async () => {
    const a = await createUser({ requestedRole: "student", displayName: "PkgFull" });
    accounts.push(a.id);
    const stu = await newStudent(a.id, "PkgKid");
    await issueMinutes(a.id, 600);
    const start = await nextSlot(subject, 60);
    const r = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start });
    assert.equal(r.error, null, r.error && r.error.message);
    assert.equal(r.data.funding, "package");
    assert.deepEqual([r.data.package_minutes_used, r.data.stripe_cents_due], [60, 0]);
    const b = await getBooking(r.data.booking_id);
    assert.equal(b.status, "confirmed");
    assert.equal(b.payment_status, "paid");
    assert.equal(b.payment_hold_expires_at, null);
    const p = await getPayment(r.data.payment_id);
    assert.equal(p.status, "succeeded");
    assert.equal(p.gross_cents, 1200); // server price authority ($12 / 60 min)
    assert.equal(await minutes(a.id), 540);
  });

  it("insufficient package minutes are NOT touched; falls back to credit/Stripe", async () => {
    const a = await createUser({ requestedRole: "student", displayName: "PkgShort" });
    accounts.push(a.id);
    const stu = await newStudent(a.id, "ShortKid");
    await issueMinutes(a.id, 30); // not enough for a 60-min session
    await issueCredit(a.id, 700);
    const start = await nextSlot(subject, 60);
    const r = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start });
    assert.equal(r.error, null, r.error && r.error.message);
    assert.equal(r.data.funding, "stripe");
    // 60-min list $12; $7 credit → $5 Stripe due.
    assert.deepEqual([r.data.package_minutes_used, r.data.credit_cents_used, r.data.stripe_cents_due], [0, 700, 500]);
    assert.equal(await minutes(a.id), 30, "package minutes must be untouched");
  });

  // ---- Full dollar credit --------------------------------------------------
  it("dollar credit fully covers a session: no Stripe, confirmed, credit consumed", async () => {
    const a = await createUser({ requestedRole: "student", displayName: "CreditFull" });
    accounts.push(a.id);
    const stu = await newStudent(a.id, "CredKid");
    await issueCredit(a.id, 1200);
    const start = await nextSlot(subject, 60);
    const r = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start });
    assert.equal(r.error, null, r.error && r.error.message);
    assert.equal(r.data.funding, "credit");
    assert.equal(r.data.stripe_cents_due, 0);
    const b = await getBooking(r.data.booking_id);
    assert.equal(b.status, "confirmed");
    const p = await getPayment(r.data.payment_id);
    assert.deepEqual([p.status, p.credit_applied_cents], ["succeeded", 1200]);
    assert.equal(await credit(a.id), 0);
  });

  // ---- Mixed credit + Stripe ----------------------------------------------
  it("mixed credit + Stripe: booking pending, credit reserved, webhook confirms", async () => {
    const a = await createUser({ requestedRole: "student", displayName: "Mixed" });
    accounts.push(a.id);
    const stu = await newStudent(a.id, "MixKid");
    await issueCredit(a.id, 700);
    const start = await nextSlot(subject, 60);
    const r = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start });
    assert.equal(r.error, null, r.error && r.error.message);
    assert.deepEqual([r.data.funding, r.data.credit_cents_used, r.data.stripe_cents_due], ["stripe", 700, 500]);
    const b = await getBooking(r.data.booking_id);
    assert.equal(b.status, "pending");
    assert.equal(b.payment_status, "awaiting_payment");
    const p = await getPayment(r.data.payment_id);
    assert.deepEqual([p.status, p.credit_applied_cents], ["requires_payment", 700]);
    assert.equal(await credit(a.id), 0, "credit reserved (consumed) while awaiting Stripe");

    // Webhook fulfillment (amount must match expected Stripe amount).
    const mism = await svc.rpc("fulfill_booking_payment", { p_payment_id: r.data.payment_id, p_amount_cents: 999 });
    assert.ok(mism.error, "amount mismatch rejected");
    const ok = await svc.rpc("fulfill_booking_payment", { p_payment_id: r.data.payment_id, p_amount_cents: 500, p_charge_id: "pi_test" });
    assert.equal(ok.error, null, ok.error && ok.error.message);
    assert.equal(ok.data.status, "confirmed");
    const b2 = await getBooking(r.data.booking_id);
    assert.equal(b2.status, "confirmed");
    assert.equal(b2.payment_status, "paid");
    const p2 = await getPayment(r.data.payment_id);
    assert.deepEqual([p2.status, p2.stripe_paid_cents], ["succeeded", 500]);
    assert.equal(await credit(a.id), 0, "reserved credit stays consumed after success");

    // Idempotent: duplicate webhook is a safe no-op.
    const dup = await svc.rpc("fulfill_booking_payment", { p_payment_id: r.data.payment_id, p_amount_cents: 500 });
    assert.equal(dup.data.status, "already_fulfilled");
  });
  // ---- Free trial ----------------------------------------------------------
  it("free trial: $0 confirmed, no Stripe, one-per-account enforced", async () => {
    const a = await createUser({ requestedRole: "student", displayName: "FreeTrial" });
    accounts.push(a.id);
    const stu = await newStudent(a.id, "FreeKid");
    const start = await nextSlot(subject, 60);
    const r = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start, free: true });
    assert.equal(r.error, null, r.error && r.error.message);
    assert.equal(r.data.funding, "free_trial");
    assert.equal(r.data.session_price_cents, 0);
    assert.equal(r.data.package_minutes_used, 0);
    assert.equal(r.data.credit_cents_used, 0);
    const b = await getBooking(r.data.booking_id);
    assert.deepEqual([b.status, b.payment_status, b.price_cents, b.is_free_trial, b.duration_minutes], ["confirmed", "not_required", 0, true, 60]);
    const p = await getPayment(r.data.payment_id);
    assert.deepEqual([p.status, p.gross_cents], ["succeeded", 0]);
    // second free trial for the same student rejected
    const start2 = await nextSlot(subject, 60);
    const r2 = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start: start2, free: true });
    assert.ok(r2.error, "one free trial per account");
    // 30-min cannot be a free trial under PR3
    const r3 = await bookSession(a, { studentId: stu, subjectId: subject, duration: 30, start: await nextSlot(subject, 30), free: true });
    assert.ok(r3.error, "free trial is 60 minutes only");
  });

  // ---- Package purchase: full credit --------------------------------------
  it("package purchase fully funded by credit: minutes issued once, no Stripe", async () => {
    const a = await createUser({ requestedRole: "student", displayName: "PkgBuyCredit" });
    accounts.push(a.id);
    const pkg = await pkgId("pkg_14h");
    await issueCredit(a.id, pkg.price_cents);
    const r = await svc.rpc("purchase_package", { p_package_id: pkg.id, p_account: a.id });
    assert.equal(r.error, null, r.error && r.error.message);
    assert.deepEqual([r.data.funding, r.data.status, r.data.stripe_cents_due], ["credit", "completed", 0]);
    assert.equal(await minutes(a.id), pkg.minutes); // 840
    assert.equal(await credit(a.id), 0);
    const p = await getPayment(r.data.payment_id);
    assert.deepEqual([p.status, p.credit_applied_cents], ["succeeded", pkg.price_cents]); // 14000
  });

  // ---- Package purchase: partial credit + Stripe --------------------------
  it("package purchase partial credit: minutes issued only after webhook", async () => {
    const a = await createUser({ requestedRole: "student", displayName: "PkgBuyPartial" });
    accounts.push(a.id);
    const pkg = await pkgId("pkg_14h");
    await issueCredit(a.id, 5000);
    const r = await svc.rpc("purchase_package", { p_package_id: pkg.id, p_account: a.id });
    assert.equal(r.error, null, r.error && r.error.message);
    assert.deepEqual([r.data.funding, r.data.stripe_cents_due], ["stripe", pkg.price_cents - 5000]); // 9000
    assert.equal(await minutes(a.id), 0, "minutes NOT issued before Stripe verification");
    assert.equal(await credit(a.id), 0, "credit reserved");
    // wrong amount rejected, then correct amount fulfills once
    assert.ok((await svc.rpc("fulfill_package_payment", { p_payment_id: r.data.payment_id, p_amount_cents: 1 })).error);
    const ok = await svc.rpc("fulfill_package_payment", { p_payment_id: r.data.payment_id, p_amount_cents: pkg.price_cents - 5000 });
    assert.equal(ok.data.status, "completed");
    assert.equal(await minutes(a.id), pkg.minutes);
    // duplicate webhook does not double-issue
    const dup = await svc.rpc("fulfill_package_payment", { p_payment_id: r.data.payment_id, p_amount_cents: pkg.price_cents - 5000 });
    assert.equal(dup.data.status, "already_fulfilled");
    assert.equal(await minutes(a.id), pkg.minutes, "minutes issued exactly once");
  });

  it("package purchase Stripe-only (no credit): minutes only after webhook", async () => {
    const a = await createUser({ requestedRole: "student", displayName: "PkgBuyStripe" });
    accounts.push(a.id);
    const pkg = await pkgId("pkg_28h");
    const r = await svc.rpc("purchase_package", { p_package_id: pkg.id, p_account: a.id });
    assert.deepEqual([r.data.funding, r.data.stripe_cents_due], ["stripe", pkg.price_cents]); // 25200
    assert.equal(await minutes(a.id), 0);
    await svc.rpc("fulfill_package_payment", { p_payment_id: r.data.payment_id, p_amount_cents: pkg.price_cents });
    assert.equal(await minutes(a.id), pkg.minutes); // 1680
  });
  it("inactive packages cannot be purchased", async () => {
    const r = await svc.rpc("purchase_package", { p_package_id: inactivePkg, p_account: parent.id });
    assert.ok(r.error);
    assert.match(r.error.message, /not available/i);
  });

  // ---- Expiry restores reserved credit ------------------------------------
  it("expired hold: booking expired, payment canceled, reserved credit restored", async () => {
    const a = await createUser({ requestedRole: "student", displayName: "Expiry" });
    accounts.push(a.id);
    const stu = await newStudent(a.id, "ExpKid");
    await issueCredit(a.id, 700);
    const start = await nextSlot(subject, 60);
    const r = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start });
    assert.equal(r.data.funding, "stripe");
    assert.equal(await credit(a.id), 0);
    // Force the hold to expire, then run the sweeper.
    await svc.from("bookings").update({ payment_hold_expires_at: new Date(Date.now() - 60000).toISOString() }).eq("id", r.data.booking_id);
    const rel = await svc.rpc("release_expired_holds");
    assert.equal(rel.error, null, rel.error && rel.error.message);
    const b = await getBooking(r.data.booking_id);
    assert.equal(b.status, "expired");
    const p = await getPayment(r.data.payment_id);
    assert.equal(p.status, "canceled");
    assert.equal(await credit(a.id), 700, "reserved credit restored on expiry");
    return { paymentId: r.data.payment_id, account: a.id };
  });

  // ---- Delayed payment after expiry ---------------------------------------
  it("delayed Stripe success after expiry: value credited, slot NOT overridden", async () => {
    const a = await createUser({ requestedRole: "student", displayName: "Delayed" });
    accounts.push(a.id);
    const stu = await newStudent(a.id, "DelKid");
    await issueCredit(a.id, 700);
    const start = await nextSlot(subject, 60);
    const r = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start });
    assert.equal(r.data.stripe_cents_due, 500);
    await svc.from("bookings").update({ payment_hold_expires_at: new Date(Date.now() - 60000).toISOString() }).eq("id", r.data.booking_id);
    await svc.rpc("release_expired_holds");
    assert.equal(await credit(a.id), 700); // reserved credit already restored
    // Delayed webhook arrives AFTER expiry.
    const ok = await svc.rpc("fulfill_booking_payment", { p_payment_id: r.data.payment_id, p_amount_cents: 500, p_charge_id: "pi_late" });
    assert.equal(ok.data.status, "credited");
    const b = await getBooking(r.data.booking_id);
    assert.equal(b.status, "expired", "expired slot must not be reactivated");
    // Customer keeps ALL value: restored 700 + credited Stripe 500 = 1200.
    assert.equal(await credit(a.id), 1200, "no stranded customer value");
    const p = await getPayment(r.data.payment_id);
    assert.equal(p.status, "succeeded");
    assert.ok(p.note && /credited/i.test(p.note));
  });

  // ---- Concurrency / double-spend -----------------------------------------
  it("concurrency: two bookings racing the SAME package balance never overspend", async () => {
    const a = await createUser({ requestedRole: "student", displayName: "RacePkg" });
    accounts.push(a.id);
    const stu = await newStudent(a.id, "RaceKid");
    await issueMinutes(a.id, 60); // enough for exactly ONE 60-min session
    const [s1, s2] = await twoDisjointSlots(subject, 60);
    const [r1, r2] = await Promise.all([
      bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start: s1 }),
      bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start: s2 }),
    ]);
    const fundings = [r1.data?.funding, r2.data?.funding].filter(Boolean);
    const pkgCount = fundings.filter((f) => f === "package").length;
    assert.equal(pkgCount, 1, "exactly one booking may use the single package allotment");
    const bal = await minutes(a.id);
    assert.ok(bal >= 0, "package balance never negative");
    assert.equal(bal, 0, "the 60 minutes were consumed exactly once");
  });

  it("concurrency: two bookings racing the SAME dollar credit never overspend", async () => {
    const a = await createUser({ requestedRole: "student", displayName: "RaceCredit" });
    accounts.push(a.id);
    const stu = await newStudent(a.id, "RaceCredKid");
    await issueCredit(a.id, 1200); // exactly one 60-min session at $12
    const [s1, s2] = await twoDisjointSlots(subject, 60);
    const [r1, r2] = await Promise.all([
      bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start: s1 }),
      bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start: s2 }),
    ]);
    const creditFull = [r1.data, r2.data].filter((d) => d && d.funding === "credit").length;
    assert.equal(creditFull, 1, "only one booking fully funded by the single credit");
    assert.ok((await credit(a.id)) >= 0, "credit never negative");
    assert.equal(await credit(a.id), 0, "credit fully consumed once, not double-spent");
  });

  // ---- Authorization / security -------------------------------------------
  it("security: customers cannot call fulfillment functions", async () => {
    const c = await signIn(parent.email, parent.password);
    assert.ok((await c.rpc("fulfill_booking_payment", { p_payment_id: "00000000-0000-0000-0000-000000000000", p_amount_cents: 1 })).error);
    assert.ok((await c.rpc("fulfill_package_payment", { p_payment_id: "00000000-0000-0000-0000-000000000000", p_amount_cents: 1 })).error);
  });

  it("security: a customer cannot book_session for another account's student", async () => {
    const otherStu = await newStudent(parent2.id, "NotYours");
    const c = await signIn(parent.email, parent.password);
    const r = await c.rpc("book_session", {
      p_student_id: otherStu, p_subject_id: subject, p_other_subject: null, p_request_note: null,
      p_duration: 30, p_start: await nextSlot(subject, 30), p_is_free_trial: false,
    });
    assert.ok(r.error, "must not book for a student you do not own");
  });

  it("security: a customer cannot read another account's balance or payments", async () => {
    const c = await signIn(parent.email, parent.password);
    assert.ok((await c.rpc("get_customer_balances", { p_account: parent2.id })).error);
    const { data } = await c.from("payments").select("id").eq("account_id", parent2.id);
    assert.equal((data ?? []).length, 0, "RLS hides other accounts' payments");
  });

  it("security: a customer cannot directly confirm a pending booking or mark payment succeeded", async () => {
    const a = await createUser({ requestedRole: "student", displayName: "TamperGuard" });
    accounts.push(a.id);
    const stu = await newStudent(a.id, "TamperKid");
    const start = await nextSlot(subject, 60);
    const r = await bookSession(a, { studentId: stu, subjectId: subject, duration: 60, start }); // stripe path, pending
    const c = await signIn(a.email, a.password);
    await c.from("bookings").update({ status: "confirmed", payment_status: "paid" }).eq("id", r.data.booking_id);
    await c.from("payments").update({ status: "succeeded", stripe_paid_cents: 1200 }).eq("id", r.data.payment_id);
    const b = await getBooking(r.data.booking_id);
    const p = await getPayment(r.data.payment_id);
    assert.notEqual(b.status, "confirmed", "customer cannot self-confirm a booking");
    assert.equal(p.status, "requires_payment", "customer cannot mark their payment succeeded");
  });
});
