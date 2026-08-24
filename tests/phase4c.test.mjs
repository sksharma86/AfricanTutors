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
async function approveTutor(id) {
  await svc.from("tutor_profiles").update({ status: "approved", timezone: "UTC", comp_rate_cents_per_hour: 1000 }).eq("profile_id", id);
  await svc.from("profiles").update({ role: "tutor" }).eq("id", id);
}
async function newStudent(acc, name) {
  const { data, error } = await svc.from("students").insert({ account_id: acc, full_name: name, grade_level: "9", timezone: "UTC" }).select("id").single();
  if (error) throw new Error("newStudent: " + error.message);
  return data.id;
}
const issueMinutes = async (a, m) => svc.rpc("issue_package_minutes", { p_account: a, p_minutes: m, p_reference: ref("min") });
const issueCredit = async (a, c) => svc.rpc("issue_dollar_credit", { p_account: a, p_amount_cents: c, p_entry_type: "admin_adjustment", p_reference: ref("cr") });
const minutes = async (a) => (await svc.rpc("get_package_minutes", { p_account: a })).data;
const credit = async (a) => (await svc.rpc("get_dollar_credit", { p_account: a })).data;
const getBooking = async (id) => (await svc.from("bookings").select("*").eq("id", id).single()).data;
const getPayment = async (id) => (await svc.from("payments").select("*").eq("id", id).single()).data;
const earningFor = async (bookingId) => (await svc.from("tutor_earnings").select("*").eq("booking_id", bookingId).maybeSingle()).data;

async function nextSlot(subject, duration, afterMs = 3 * 3600_000) {
  const from = new Date(Date.now() + afterMs).toISOString();
  const to = new Date(Date.now() + 25 * 86400_000).toISOString();
  const { data, error } = await svc.rpc("get_available_slots", { p_subject_id: subject, p_duration: duration, p_from: from, p_to: to });
  if (error) throw new Error("nextSlot: " + error.message);
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
  return c.rpc("book_session", {
    p_student_id: a.studentId, p_subject_id: a.subjectId ?? null, p_other_subject: a.other ?? null,
    p_request_note: a.note ?? null, p_duration: a.duration, p_start: a.start ?? null, p_is_free_trial: a.free ?? false,
  });
}
// Set the scheduled window to control the 24-hour cancellation boundary.
async function setSchedule(bookingId, hoursFromNow, duration = 60) {
  const start = new Date(Date.now() + hoursFromNow * 3600_000);
  const end = new Date(start.getTime() + duration * 60000);
  await svc.from("bookings").update({ scheduled_start: start.toISOString(), scheduled_end: end.toISOString() }).eq("id", bookingId);
}

describe("Phase 4C — admin ops, earnings, cancellations, refunds, disputes (live)", { skip: !hasSupabaseEnv }, () => {
  let admin, adminC, tutorA, tutorB, subject;
  const accounts = [];
  async function acct(name) {
    const u = await createUser({ requestedRole: "student", displayName: name });
    accounts.push(u.id);
    return u;
  }

  before(async () => {
    admin = await createUser({ requestedRole: "student", displayName: "Admin 4C" });
    await makeAdmin(admin.id);
    adminC = await signIn(admin.email, admin.password);
    tutorA = await createUser({ requestedRole: "tutor", displayName: "Tutor A" });
    tutorB = await createUser({ requestedRole: "tutor", displayName: "Tutor B" });
    await approveTutor(tutorA.id);
    await approveTutor(tutorB.id);
    subject = await newSubject("Ops");
    await svc.from("tutor_subjects").insert({ tutor_id: tutorA.id, subject_id: subject });
    await svc.from("tutor_subjects").insert({ tutor_id: tutorB.id, subject_id: subject });
    for (let d = 0; d < 7; d++) {
      await svc.from("tutor_availability").insert({ tutor_id: tutorA.id, day_of_week: d, start_time: "00:00", end_time: "23:59" });
      await svc.from("tutor_availability").insert({ tutor_id: tutorB.id, day_of_week: d, start_time: "00:00", end_time: "23:59" });
    }
  });

  after(async () => {
    await svc.from("disputes").delete().in("account_id", accounts);
    for (const t of [tutorA.id, tutorB.id]) await svc.from("tutor_earnings").delete().eq("tutor_id", t);
    for (const acc of accounts) {
      await svc.from("refunds").delete().eq("account_id", acc);
      await svc.from("package_minute_ledger").delete().eq("account_id", acc);
      await svc.from("dollar_credit_ledger").delete().eq("account_id", acc);
      await svc.from("payments").delete().eq("account_id", acc);
    }
    await svc.from("subjects").delete().eq("id", subject);
    await cleanupAll();
  });

  // Build a confirmed booking with the requested funding; returns {bookingId, paymentId}.
  async function confirmedBooking(a, stu, funding) {
    if (funding === "package") await issueMinutes(a.id, 600);
    if (funding === "credit") await issueCredit(a.id, 1200);
    if (funding === "mixed") await issueCredit(a.id, 700);
    const r = await book(a, { studentId: stu, subjectId: subject, duration: 60, start: await nextSlot(subject, 60) });
    assert.equal(r.error, null, r.error && r.error.message);
    if (funding === "mixed" || funding === "stripe") {
      const due = funding === "mixed" ? 500 : 1200;
      const f = await svc.rpc("fulfill_booking_payment", { p_payment_id: r.data.payment_id, p_amount_cents: due, p_charge_id: "pi_" + ref("x") });
      assert.equal(f.data.status, "confirmed", "fulfillment should confirm");
    }
    return { bookingId: r.data.booking_id, paymentId: r.data.payment_id };
  }

  // ---- CUSTOMER CANCELLATIONS ----
  it("early package-funded cancellation restores exact minutes once (idempotent)", async () => {
    const a = await acct("EarlyPkg");
    const stu = await newStudent(a.id, "Kid");
    const b = await confirmedBooking(a, stu, "package");
    assert.equal(await minutes(a.id), 540);
    await setSchedule(b.bookingId, 48);
    const c = await clientFor(a);
    const r1 = await c.rpc("customer_cancel_booking", { p_booking: b.bookingId });
    assert.equal(r1.data.early, true);
    assert.equal(await minutes(a.id), 600, "minutes restored");
    assert.equal((await getBooking(b.bookingId)).status, "cancelled");
    const r2 = await c.rpc("customer_cancel_booking", { p_booking: b.bookingId });
    assert.equal(r2.data.status, "noop");
    assert.equal(await minutes(a.id), 600, "no double restore");
    assert.equal(await earningFor(b.bookingId), null, "early cancel → no tutor earning");
  });

  it("early Stripe-funded cancellation credits account, no Stripe refund", async () => {
    const a = await acct("EarlyStripe");
    const stu = await newStudent(a.id, "Kid");
    const b = await confirmedBooking(a, stu, "stripe");
    assert.equal(await credit(a.id), 0);
    await setSchedule(b.bookingId, 48);
    await (await clientFor(a)).rpc("customer_cancel_booking", { p_booking: b.bookingId });
    assert.equal(await credit(a.id), 1200, "full value as account credit");
    const { count } = await svc.from("refunds").select("*", { count: "exact", head: true }).eq("payment_id", b.paymentId);
    assert.equal(count, 0, "no Stripe refund created");
  });

  it("early mixed-funding cancellation credits the correct TOTAL, not credit+refund", async () => {
    const a = await acct("EarlyMixed");
    const stu = await newStudent(a.id, "Kid");
    const b = await confirmedBooking(a, stu, "mixed"); // $7 credit + $5 Stripe
    assert.equal(await credit(a.id), 0);
    await setSchedule(b.bookingId, 48);
    await (await clientFor(a)).rpc("customer_cancel_booking", { p_booking: b.bookingId });
    assert.equal(await credit(a.id), 1200, "total $12 as credit (not $7 + refund)");
    const { count } = await svc.from("refunds").select("*", { count: "exact", head: true }).eq("payment_id", b.paymentId);
    assert.equal(count, 0);
  });

  it("late cancellation restores nothing and pays the tutor in full", async () => {
    const a = await acct("Late");
    const stu = await newStudent(a.id, "Kid");
    const b = await confirmedBooking(a, stu, "credit");
    assert.equal(await credit(a.id), 0);
    await setSchedule(b.bookingId, 2); // < 24h
    const r = await (await clientFor(a)).rpc("customer_cancel_booking", { p_booking: b.bookingId });
    assert.equal(r.data.early, false);
    assert.equal(await credit(a.id), 0, "no restoration");
    const e = await earningFor(b.bookingId);
    assert.equal(e.amount_cents, 1000, "tutor earns full (60min @ $10/hr)");
    assert.equal(e.status, "earned");
  });

  // ---- NO-SHOW ----
  it("no-show: no restoration, full tutor earning, duplicate does not duplicate earning", async () => {
    const a = await acct("NoShow");
    const stu = await newStudent(a.id, "Kid");
    const b = await confirmedBooking(a, stu, "credit");
    await setSchedule(b.bookingId, 2);
    const r = await adminC.rpc("admin_no_show", { p_booking: b.bookingId });
    assert.equal(r.data.status, "no_show");
    assert.equal(await credit(a.id), 0);
    assert.equal((await earningFor(b.bookingId)).amount_cents, 1000);
    await adminC.rpc("admin_no_show", { p_booking: b.bookingId }); // duplicate
    const { count } = await svc.from("tutor_earnings").select("*", { count: "exact", head: true }).eq("booking_id", b.bookingId);
    assert.equal(count, 1, "earning not duplicated");
  });

  // ---- TUTOR EARNINGS ----
  it("completed session creates full earning; free trial earns prorated", async () => {
    const a = await acct("Complete");
    const stu = await newStudent(a.id, "Kid");
    const b = await confirmedBooking(a, stu, "credit");
    await adminC.rpc("admin_complete_booking", { p_booking: b.bookingId });
    assert.equal((await earningFor(b.bookingId)).amount_cents, 1000);

    // free trial (60 min) → full hourly rate (duration-prorated; rate itself unchanged)
    const a2 = await acct("Trial");
    const stu2 = await newStudent(a2.id, "Kid");
    const rt = await book(a2, { studentId: stu2, subjectId: subject, duration: 60, start: await nextSlot(subject, 60), free: true });
    assert.equal(rt.error, null, rt.error?.message);
    await adminC.rpc("admin_complete_booking", { p_booking: rt.data.booking_id });
    assert.equal((await earningFor(rt.data.booking_id)).amount_cents, 1000, "60min free trial pays tutor full hourly amount");
  });

  it("historical rate snapshot is preserved when the tutor rate later changes", async () => {
    const a = await acct("Snapshot");
    const stu = await newStudent(a.id, "Kid");
    const b = await confirmedBooking(a, stu, "credit");
    await adminC.rpc("admin_complete_booking", { p_booking: b.bookingId });
    const e1 = await earningFor(b.bookingId);
    await svc.from("tutor_profiles").update({ comp_rate_cents_per_hour: 5000 }).eq("profile_id", e1.tutor_id);
    const e2 = await earningFor(b.bookingId);
    assert.deepEqual([e2.amount_cents, e2.rate_cents_per_hour], [1000, 1000], "old earning unchanged after rate change");
    await svc.from("tutor_profiles").update({ comp_rate_cents_per_hour: 1000 }).eq("profile_id", e1.tutor_id);
  });

  it("tutor (admin) cancellation via release: value restored, no tutor earning", async () => {
    const a = await acct("TutorCancel");
    const stu = await newStudent(a.id, "Kid");
    const b = await confirmedBooking(a, stu, "credit");
    await setSchedule(b.bookingId, 2); // even <24h, release restores because company/tutor-side
    const r = await adminC.rpc("admin_release_booking", { p_booking: b.bookingId, p_reason: "tutor cancelled", p_comp_credit_cents: 500 });
    assert.equal(r.data.status, "cancelled");
    assert.equal(await credit(a.id), 1200 + 500, "restored $12 + $5 courtesy");
    assert.equal(await earningFor(b.bookingId), null, "original tutor earns $0");
  });

  // ---- PAYOUT TRACKING ----
  it("earnings payout: mark paid, batch, no double-pay, audited", async () => {
    const a = await acct("Payout");
    const stu = await newStudent(a.id, "Kid");
    const b1 = await confirmedBooking(a, stu, "credit");
    await issueCredit(a.id, 1200);
    const r2 = await book(a, { studentId: stu, subjectId: subject, duration: 60, start: await nextSlot(subject, 60) });
    await adminC.rpc("admin_complete_booking", { p_booking: b1.bookingId });
    await adminC.rpc("admin_complete_booking", { p_booking: r2.data.booking_id });
    const e1 = await earningFor(b1.bookingId);
    const e2 = await earningFor(r2.data.booking_id);
    const p1 = await adminC.rpc("admin_mark_earning_paid", { p_earning_id: e1.id, p_note: "wire-1" });
    assert.equal(p1.data.status, "paid");
    const dup = await adminC.rpc("admin_mark_earning_paid", { p_earning_id: e1.id });
    assert.equal(dup.data.status, "noop", "cannot double-pay");
    const batch = await adminC.rpc("admin_mark_earnings_paid_batch", { p_ids: [e1.id, e2.id], p_note: "batch" });
    assert.equal(batch.data.paid_count, 1, "only the still-unpaid one is paid");
    assert.equal((await svc.from("tutor_earnings").select("status").eq("id", e2.id).single()).data.status, "paid");
    const { count } = await svc.from("financial_audit_log").select("*", { count: "exact", head: true }).eq("action", "earning_paid").eq("entity_id", e1.id);
    assert.ok(count >= 1, "payout audited");
  });

  it("earning adjustments: adjust preserves original, void blocks pay, restore works", async () => {
    const a = await acct("Adjust");
    const stu = await newStudent(a.id, "Kid");
    const b = await confirmedBooking(a, stu, "credit");
    await adminC.rpc("admin_complete_booking", { p_booking: b.bookingId });
    const e = await earningFor(b.bookingId);
    await adminC.rpc("admin_adjust_earning", { p_earning_id: e.id, p_new_amount_cents: 250, p_reason: "partial credit" });
    const adj = await svc.from("tutor_earnings").select("*").eq("id", e.id).single();
    assert.deepEqual([adj.data.amount_cents, adj.data.adjusted_from_cents, adj.data.status], [250, 1000, "adjusted"]);
    await adminC.rpc("admin_void_earning", { p_earning_id: e.id, p_reason: "quality issue" });
    assert.equal((await svc.from("tutor_earnings").select("status").eq("id", e.id).single()).data.status, "voided");
    assert.ok((await adminC.rpc("admin_mark_earning_paid", { p_earning_id: e.id })).error, "cannot pay a voided earning");
    await adminC.rpc("admin_restore_earning", { p_earning_id: e.id, p_reason: "reinstated" });
    assert.equal((await svc.from("tutor_earnings").select("status").eq("id", e.id).single()).data.status, "earned");
  });

  // ---- ADMIN ADJUSTMENTS ----
  it("admin credit/minute adjustments with negative-balance prevention and auth", async () => {
    const a = await acct("AdminAdj");
    await adminC.rpc("admin_adjust_dollar_credit", { p_account: a.id, p_amount_cents: 5000, p_reason: "goodwill", p_reference: ref("adj") });
    assert.equal(await credit(a.id), 5000);
    await adminC.rpc("admin_adjust_dollar_credit", { p_account: a.id, p_amount_cents: -2000, p_reason: "correction", p_reference: ref("adj") });
    assert.equal(await credit(a.id), 3000);
    const neg = await adminC.rpc("admin_adjust_dollar_credit", { p_account: a.id, p_amount_cents: -9999, p_reason: "overdraw", p_reference: ref("adj") });
    assert.ok(neg.error, "negative balance prevented");

    await adminC.rpc("admin_adjust_package_minutes", { p_account: a.id, p_minutes: 120, p_reason: "comp", p_reference: ref("adj") });
    assert.equal(await minutes(a.id), 120);
    const negm = await adminC.rpc("admin_adjust_package_minutes", { p_account: a.id, p_minutes: -999, p_reason: "x", p_reference: ref("adj") });
    assert.ok(negm.error, "negative minutes prevented");

    const c = await clientFor(a);
    assert.ok((await c.rpc("admin_adjust_dollar_credit", { p_account: a.id, p_amount_cents: 100000, p_reason: "hack", p_reference: ref("adj") })).error, "non-admin blocked");
  });

  // ---- REFUNDS ----
  it("refunds: partial then full, cannot exceed Stripe-paid, duplicate safe, non-admin blocked", async () => {
    const a = await acct("Refund");
    const stu = await newStudent(a.id, "Kid");
    const b = await confirmedBooking(a, stu, "stripe"); // stripe_paid 1200
    const rid = ref("re");
    const r1 = await adminC.rpc("admin_record_refund", { p_payment_id: b.paymentId, p_amount_cents: 500, p_stripe_refund_id: rid + "-a", p_reason: "partial" });
    assert.equal(r1.data.refunded_cents, 500);
    assert.equal((await getPayment(b.paymentId)).status, "partially_refunded");
    const r2 = await adminC.rpc("admin_record_refund", { p_payment_id: b.paymentId, p_amount_cents: 700, p_stripe_refund_id: rid + "-b", p_reason: "rest" });
    assert.equal(r2.data.refunded_cents, 1200);
    assert.equal((await getPayment(b.paymentId)).status, "refunded");
    const over = await adminC.rpc("admin_record_refund", { p_payment_id: b.paymentId, p_amount_cents: 1, p_stripe_refund_id: rid + "-c", p_reason: "x" });
    assert.ok(over.error, "cannot exceed refundable");
    const dup = await adminC.rpc("admin_record_refund", { p_payment_id: b.paymentId, p_amount_cents: 500, p_stripe_refund_id: rid + "-a", p_reason: "dup" });
    assert.equal(dup.data.applied, false, "duplicate refund id is a no-op");
    assert.equal((await getPayment(b.paymentId)).refunded_cents, 1200, "not double-counted");
    const c = await clientFor(a);
    assert.ok((await c.rpc("admin_record_refund", { p_payment_id: b.paymentId, p_amount_cents: 100, p_stripe_refund_id: ref("x"), p_reason: "hack" })).error, "non-admin blocked");
  });

  it("refund cannot exceed the Stripe-paid portion of a mixed booking", async () => {
    const a = await acct("RefundMixed");
    const stu = await newStudent(a.id, "Kid");
    const b = await confirmedBooking(a, stu, "mixed"); // stripe_paid 500
    const over = await adminC.rpc("admin_record_refund", { p_payment_id: b.paymentId, p_amount_cents: 600, p_stripe_refund_id: ref("re"), p_reason: "x" });
    assert.ok(over.error, "cannot refund more than $5 Stripe");
    const ok = await adminC.rpc("admin_record_refund", { p_payment_id: b.paymentId, p_amount_cents: 500, p_stripe_refund_id: ref("re"), p_reason: "ok" });
    assert.equal(ok.data.refunded_cents, 500);
  });

  // ---- REASSIGNMENT ----
  it("reassignment: conflict (double-booked tutor) is rejected", async () => {
    // Two bookings at the SAME earliest slot occupy BOTH tutors (booked via the
    // real engine, so no manual timestamp math / exclusion pitfalls).
    const a1 = await acct("ReassignC1");
    const stu1 = await newStudent(a1.id, "Kid1");
    const slot = await nextSlot(subject, 60, 14 * 86400_000); // far, clean slot: both tutors free
    await issueCredit(a1.id, 1200);
    const r1 = await book(a1, { studentId: stu1, subjectId: subject, duration: 60, start: slot });
    assert.equal(r1.error, null, r1.error && r1.error.message);
    const t1 = (await getBooking(r1.data.booking_id)).tutor_id;

    const a2 = await acct("ReassignC2");
    const stu2 = await newStudent(a2.id, "Kid2");
    await issueCredit(a2.id, 1200);
    const r2 = await book(a2, { studentId: stu2, subjectId: subject, duration: 60, start: slot });
    assert.equal(r2.error, null, r2.error && r2.error.message);
    const t2 = (await getBooking(r2.data.booking_id)).tutor_id;
    assert.notEqual(t1, t2, "the same slot must be served by the two different tutors");

    // Reassigning booking1 to t2 must fail — t2 is busy at that slot.
    const conflict = await adminC.rpc("admin_reassign_tutor", { p_booking: r1.data.booking_id, p_new_tutor: t2, p_reason: "try" });
    assert.ok(conflict.error, "double-booked tutor rejected");
  });

  it("reassignment: eligible switch; earnings follow the current tutor, not the original", async () => {
    // Use a far, clean slot so BOTH tutors are free and one can be reassigned.
    const a = await acct("Reassign");
    const stu = await newStudent(a.id, "Kid");
    await issueCredit(a.id, 1200);
    const slot = await nextSlot(subject, 60, 12 * 86400_000);
    const r = await book(a, { studentId: stu, subjectId: subject, duration: 60, start: slot });
    const bookingId = r.data.booking_id;
    const orig = (await getBooking(bookingId)).tutor_id;
    const other = orig === tutorA.id ? tutorB.id : tutorA.id;

    const ok = await adminC.rpc("admin_reassign_tutor", { p_booking: bookingId, p_new_tutor: other, p_reason: "coverage" });
    assert.equal(ok.error, null, ok.error && ok.error.message);
    assert.equal((await getBooking(bookingId)).tutor_id, other);

    await adminC.rpc("admin_complete_booking", { p_booking: bookingId });
    const e = await earningFor(bookingId);
    assert.equal(e.tutor_id, other, "earning goes to the replacement tutor");
    const { count } = await svc.from("tutor_earnings").select("*", { count: "exact", head: true }).eq("booking_id", bookingId).eq("tutor_id", orig);
    assert.equal(count, 0, "original tutor does not earn");
  });

  // ---- DISPUTES ----
  it("disputes: create own, block others, duplicate active blocked, admin-notes hidden", async () => {
    const a = await acct("Disputer");
    const stu = await newStudent(a.id, "Kid");
    const b = await confirmedBooking(a, stu, "credit");
    await adminC.rpc("admin_complete_booking", { p_booking: b.bookingId });
    const c = await clientFor(a);
    const d = await c.rpc("create_dispute", { p_booking: b.bookingId, p_category: "quality", p_complaint: "unprepared" });
    assert.equal(d.error, null, d.error && d.error.message);
    const disputeId = d.data;
    // duplicate active dispute blocked
    assert.ok((await c.rpc("create_dispute", { p_booking: b.bookingId, p_category: "quality", p_complaint: "again" })).error);
    // another customer cannot dispute this booking
    const other = await acct("Nosy");
    assert.ok((await (await clientFor(other)).rpc("create_dispute", { p_booking: b.bookingId, p_category: "x", p_complaint: "y" })).error);
    // customer cannot read admin base table; get_my_disputes omits admin_notes
    const { data: baseRows } = await c.from("disputes").select("admin_notes");
    assert.equal((baseRows ?? []).length, 0, "customer cannot read disputes base table (admin_notes hidden)");
    const mine = await c.rpc("get_my_disputes");
    assert.ok(mine.data.some((x) => x.id === disputeId) && !("admin_notes" in mine.data[0]));
    // customer cannot resolve
    assert.ok((await c.rpc("admin_resolve_dispute", { p_dispute: disputeId, p_resolution: "upheld", p_credit_cents: 100000 })).error);
    // admin denies
    const res = await adminC.rpc("admin_resolve_dispute", { p_dispute: disputeId, p_resolution: "denied", p_notes: "reviewed recording; fine" });
    assert.equal(res.data.resolution, "denied");
    assert.equal(await credit(a.id), 0, "denied → no customer financial action");
  });

  it("dispute upheld: restore minutes + refund + void earning; courtesy issues credit", async () => {
    // upheld with minutes + refund + earning void
    const a = await acct("Upheld");
    const stu = await newStudent(a.id, "Kid");
    const b = await confirmedBooking(a, stu, "stripe"); // stripe_paid 1200
    await adminC.rpc("admin_complete_booking", { p_booking: b.bookingId });
    const e = await earningFor(b.bookingId);
    const c = await clientFor(a);
    const d = (await c.rpc("create_dispute", { p_booking: b.bookingId, p_category: "quality", p_complaint: "bad" })).data;
    const res = await adminC.rpc("admin_resolve_dispute", {
      p_dispute: d, p_resolution: "upheld", p_notes: "upheld",
      p_restore_minutes: 60, p_refund_payment: b.paymentId, p_refund_cents: 1000, p_refund_stripe_id: ref("re"),
      p_earning_action: "void",
    });
    assert.equal(res.data.resolution, "upheld");
    assert.equal(await minutes(a.id), 60, "minutes restored");
    assert.equal((await getPayment(b.paymentId)).refunded_cents, 1000, "partial refund recorded");
    assert.equal((await svc.from("tutor_earnings").select("status").eq("id", e.id).single()).data.status, "voided");

    // courtesy: credit only, earning intact
    const a2 = await acct("Courtesy");
    const stu2 = await newStudent(a2.id, "Kid");
    const b2 = await confirmedBooking(a2, stu2, "credit");
    await adminC.rpc("admin_complete_booking", { p_booking: b2.bookingId });
    const d2 = (await (await clientFor(a2)).rpc("create_dispute", { p_booking: b2.bookingId, p_category: "quality", p_complaint: "meh" })).data;
    await adminC.rpc("admin_resolve_dispute", { p_dispute: d2, p_resolution: "courtesy", p_credit_cents: 500, p_notes: "goodwill" });
    assert.equal(await credit(a2.id), 500, "courtesy credit issued");
    assert.equal((await earningFor(b2.bookingId)).status, "earned", "tutor earning intact for courtesy");
  });
});
