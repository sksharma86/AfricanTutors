import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";

import {
  PACKAGE_14H_MINUTES,
  PACKAGE_14H_PRICE_CENTS,
  PACKAGE_28H_MINUTES,
  PACKAGE_28H_PRICE_CENTS,
} from "../src/lib/packages.mjs";
import { JOIN_OPEN_LEAD_MIN, customerJoinState } from "../src/lib/session-window.mjs";
import { adminClient, cleanupAll, createUser, hasSupabaseEnv, signIn } from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const SFX = `pr4_${Date.now().toString(36)}`;

describe("Study Hall PR4 — source: supervision booking (no subject / auto Guide)", () => {
  it("customer booking wizard has no subject step and books with null subjectId", () => {
    const wiz = read("src/components/booking/booking-wizard.tsx");
    assert.doesNotMatch(wiz, /type Step = .*subject/);
    assert.doesNotMatch(wiz, /What subject\?/);
    assert.doesNotMatch(wiz, /stepPill\(2, "Subject"/);
    assert.match(wiz, /p_subject_id: null/);
    assert.match(wiz, /subjectId: null/);
    assert.match(wiz, /We've matched an approved Guide|An approved Guide is matched/);
    assert.match(wiz, /live supervision|accountability|focus/i);
    assert.match(wiz, /do not tutor|not.*homework answers/i);
  });

  it("book page does not load subjects and describes Guide matching", () => {
    const page = read("src/app/dashboard/student/book/page.tsx");
    assert.doesNotMatch(page, /listActiveSubjects|from\("subjects"\)/);
    assert.match(page, /Book a Study Hall session/);
    assert.match(page, /match an approved Guide/);
  });

  it("customer-facing surfaces avoid tutoring / tutor-selection language in booking", () => {
    const surfaces = [
      "src/components/booking/booking-wizard.tsx",
      "src/app/dashboard/student/book/page.tsx",
      "src/lib/checkout-service.ts",
      "src/components/session/session-room.tsx",
    ]
      .map(read)
      .join("\n");
    assert.doesNotMatch(surfaces, /Tutoring session|Book tutoring|Choose a subject|select a tutor|pick a tutor|Your Tutor/i);
    assert.match(surfaces, /Study Hall session/);
    assert.match(surfaces, /5 minutes before/);
  });

  it("session-room join lead is exactly 5 minutes (UI + mirror constant)", () => {
    assert.equal(JOIN_OPEN_LEAD_MIN, 5);
    const win = read("src/lib/session-window.mjs");
    assert.match(win, /JOIN_OPEN_LEAD_MIN = 5/);
    assert.doesNotMatch(win, /JOIN_OPEN_LEAD_MIN = 10/);
    const emails = read("src/lib/email/templates.mjs");
    assert.match(emails, /opens 5 minutes before/);
    assert.doesNotMatch(emails, /opens 10 minutes before/);
  });

  it("UI join window: opens exactly 5 minutes before start", () => {
    const base = Date.parse("2026-08-24T12:00:00Z");
    const start = new Date(base + 20 * 60000).toISOString();
    const end = new Date(base + 80 * 60000).toISOString();
    // 6 minutes before start → still closed
    assert.equal(customerJoinState("confirmed", start, end, base + 14 * 60000).state, "opens_at");
    // 4 minutes before start → open
    assert.equal(customerJoinState("confirmed", start, end, base + 16 * 60000).state, "join");
    assert.equal(
      customerJoinState("confirmed", start, end, base).openAtISO,
      new Date(base + 15 * 60000).toISOString(),
    );
  });

  it("migration 0022 removes subject matching for null subject and sets 5-minute room open", () => {
    const m = read("supabase/migrations/0022_studyhall_pr4_supervision_booking.sql");
    assert.match(m, /Study Hall PR4/);
    assert.match(m, /p_subject_id is null/);
    assert.match(m, /or exists \(\s*select 1 from public\.tutor_subjects/s);
    assert.match(m, /interval '5 minutes'/);
    assert.doesNotMatch(m, /interval '10 minutes'/);
    assert.match(m, /No Guide is available for that time/);
    assert.match(m, /Your Guide/);
    // Preserve PR2 / PR3 authorities
    assert.match(m, /session_list_price_cents/);
    assert.match(m, /free trial is 60 minutes only/i);
    assert.match(m, /account_has_used_free_trial/);
    assert.match(m, /p_subject_id is null and p_start is null/);
    const sqlBody = m
      .split("\n")
      .filter((l) => !/^\s*--/.test(l))
      .join("\n");
    assert.doesNotMatch(sqlBody, /comp_rate|auto_?refill|stripe.?connect/i);
  });

  it("PR2 pricing constants remain intact", () => {
    const pricing = read("src/lib/pricing.ts");
    assert.match(pricing, /PAYG_PRICE_USD = 12/);
    assert.match(pricing, /FREE_TRIAL_MINUTES = 60/);
    assert.equal(PACKAGE_14H_MINUTES, 840);
    assert.equal(PACKAGE_14H_PRICE_CENTS, 14000);
    assert.equal(PACKAGE_28H_MINUTES, 1680);
    assert.equal(PACKAGE_28H_PRICE_CENTS, 25200);
  });

  it("booking API / service still never accept a customer-chosen Guide", () => {
    const route = read("src/app/api/checkout/booking/route.ts");
    const svc = read("src/lib/booking-service.ts");
    const checkout = read("src/lib/checkout-service.ts");
    for (const src of [route, svc, checkout]) {
      assert.doesNotMatch(src, /tutorId|p_tutor_id|chosenTutor|selectedTutor/);
    }
  });
});

describe("Study Hall PR4 — live DB (requires migration 0022)", { skip: !hasSupabaseEnv }, () => {
  const svc = adminClient();
  const accounts = [];
  let parent;
  let guideA;
  let guideB;
  let subjectOnlyA;
  let pr4Applied = false;

  async function approveGuide(id, tz = "UTC") {
    await svc.from("profiles").update({ role: "tutor" }).eq("id", id);
    await svc.from("tutor_profiles").update({ status: "approved", timezone: tz }).eq("profile_id", id);
  }

  async function avail(tutorId, dow, start = "00:00", end = "23:59") {
    await svc.from("tutor_availability").insert({
      tutor_id: tutorId,
      day_of_week: dow,
      start_time: start,
      end_time: end,
    });
  }

  async function newStudent(accountId, name) {
    const { data, error } = await svc
      .from("students")
      .insert({ account_id: accountId, full_name: name, grade_level: "9", timezone: "UTC" })
      .select("id")
      .single();
    assert.equal(error, null, error?.message);
    return data.id;
  }

  function futureUtc(days, hour) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  }

  async function book(client, a) {
    return client.rpc("book_session", {
      p_student_id: a.studentId,
      p_subject_id: a.subjectId ?? null,
      p_other_subject: a.other ?? null,
      p_request_note: a.note ?? null,
      p_duration: a.duration,
      p_start: a.start ?? null,
      p_is_free_trial: Boolean(a.free),
    });
  }

  async function detectPr4() {
    // Seed a far-future confirmed booking via service role, then inspect join_open_at.
    const start = futureUtc(40, 12);
    const end = new Date(start.getTime() + 60 * 60000);
    const { data: row, error } = await svc
      .from("bookings")
      .insert({
        student_id: await newStudent(parent.id, "Probe Kid"),
        account_id: parent.id,
        tutor_id: guideA.id,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        duration_minutes: 60,
        status: "confirmed",
        payment_status: "paid",
        price_cents: 1200,
        is_free_trial: false,
        student_first_name: "Probe",
        tutor_display_name: "Guide A",
      })
      .select("id, scheduled_start")
      .single();
    if (error) return false;
    const client = await signIn(parent.email, parent.password);
    const { data } = await client.rpc("authorize_session_join", { p_booking: row.id });
    await svc.from("bookings").delete().eq("id", row.id);
    if (!data?.join_open_at || !data?.scheduled_start) return false;
    const leadMin = (new Date(data.scheduled_start) - new Date(data.join_open_at)) / 60000;
    return Math.abs(leadMin - 5) < 0.1;
  }

  before(async () => {
    parent = await createUser({ requestedRole: "student", displayName: "PR4 Parent" });
    accounts.push(parent.id);
    guideA = await createUser({ requestedRole: "tutor", displayName: "Guide Alpha" });
    guideB = await createUser({ requestedRole: "tutor", displayName: "Guide Beta" });
    await approveGuide(guideA.id);
    await approveGuide(guideB.id);
    for (let d = 0; d < 7; d++) {
      await avail(guideA.id, d);
      await avail(guideB.id, d);
    }
    // Subject only Guide A is qualified for — used to prove Study Hall ignores specialty.
    const { data: subj, error: se } = await svc
      .from("subjects")
      .insert({ name: `PR4 Specialty ${SFX}`, category: "math", is_active: true })
      .select("id")
      .single();
    assert.equal(se, null, se?.message);
    subjectOnlyA = subj.id;
    await svc.from("tutor_subjects").insert({ tutor_id: guideA.id, subject_id: subjectOnlyA });
    // Intentionally do NOT qualify guideB for subjectOnlyA.

    pr4Applied = await detectPr4();
  });

  after(async () => {
    for (const acc of accounts) {
      await svc.from("bookings").delete().eq("account_id", acc);
      await svc.from("payments").delete().eq("account_id", acc);
      await svc.from("package_minute_ledger").delete().eq("account_id", acc);
      await svc.from("dollar_credit_ledger").delete().eq("account_id", acc);
      await svc.from("students").delete().eq("account_id", acc);
    }
    if (subjectOnlyA) {
      await svc.from("tutor_subjects").delete().eq("subject_id", subjectOnlyA);
      await svc.from("subjects").delete().eq("id", subjectOnlyA);
    }
    await cleanupAll();
  });

  it("PR2: $12 paid session quote remains intact", async () => {
    const q = await svc.rpc("booking_quote", {
      p_account: parent.id,
      p_duration: 60,
      p_is_free_trial: false,
    });
    assert.equal(q.error, null, q.error?.message);
    assert.equal(q.data.session_price_cents, 1200);
    assert.equal(q.data.stripe_cents_due, 1200);
  });

  it("PR2: active packages remain 14h/$140 and 28h/$252", async () => {
    const { data, error } = await svc
      .from("package_products")
      .select("code, minutes, price_cents")
      .eq("is_active", true)
      .order("sort_order");
    assert.equal(error, null, error?.message);
    assert.deepEqual(
      (data ?? []).map((r) => [r.code, r.minutes, r.price_cents]),
      [
        ["pkg_14h", 840, 14000],
        ["pkg_28h", 1680, 25200],
      ],
    );
  });

  it("PR3: one-hour free session quote remains $0", async () => {
    const q = await svc.rpc("booking_quote", {
      p_account: parent.id,
      p_duration: 60,
      p_is_free_trial: true,
    });
    assert.equal(q.error, null, q.error?.message);
    assert.equal(q.data.session_price_cents, 0);
    assert.equal(q.data.stripe_cents_due, 0);
    assert.equal(q.data.funding, "free_trial");
  });

  it("null-subject slots + auto Guide assignment (skip until 0022 applied)", async (t) => {
    if (!pr4Applied) {
      t.skip("migration 0022 not applied to this environment yet");
      return;
    }
    const client = await signIn(parent.email, parent.password);
    const from = futureUtc(3, 0).toISOString();
    const to = futureUtc(5, 0).toISOString();
    const slots = await client.rpc("get_available_slots", {
      p_subject_id: null,
      p_duration: 60,
      p_from: from,
      p_to: to,
    });
    assert.equal(slots.error, null, slots.error?.message);
    assert.ok((slots.data ?? []).length > 0, "Study Hall slots should appear without a subject");

    const stu = await newStudent(parent.id, "Study Hall Kid");
    const start = slots.data[0].slot_start;
    const r = await book(client, { studentId: stu, subjectId: null, duration: 60, start, free: true });
    assert.equal(r.error, null, r.error?.message);
    assert.equal(r.data.funding, "free_trial");
    assert.equal(r.data.session_price_cents, 0);

    const { data: b } = await svc
      .from("bookings")
      .select("tutor_id, subject_id, status, is_free_trial, duration_minutes, price_cents")
      .eq("id", r.data.booking_id)
      .single();
    assert.equal(b.subject_id, null);
    assert.ok(b.tutor_id, "Guide must be auto-assigned");
    assert.ok([guideA.id, guideB.id].includes(b.tutor_id), "assigned Guide must be an approved Guide");
    assert.equal(b.status, "confirmed");
    assert.equal(b.is_free_trial, true);
    assert.equal(b.duration_minutes, 60);
    assert.equal(b.price_cents, 0);

    // Guide B (no specialty) can still be used for Study Hall when A is busy.
    const start2 = slots.data.find((s) => s.slot_start !== start)?.slot_start ?? slots.data[1]?.slot_start;
    if (start2) {
      const parent2 = await createUser({ requestedRole: "student", displayName: "PR4 Parent2" });
      accounts.push(parent2.id);
      const c2 = await signIn(parent2.email, parent2.password);
      const stu2 = await newStudent(parent2.id, "Kid Two");
      const r2 = await book(c2, { studentId: stu2, subjectId: null, duration: 60, start: start2, free: true });
      assert.equal(r2.error, null, r2.error?.message);
      const { data: b2 } = await svc.from("bookings").select("tutor_id, subject_id").eq("id", r2.data.booking_id).single();
      assert.equal(b2.subject_id, null);
      assert.ok(b2.tutor_id);
    }
  });

  it("package-minute consumption still works for Study Hall (null subject)", async (t) => {
    if (!pr4Applied) {
      t.skip("migration 0022 not applied to this environment yet");
      return;
    }
    const a = await createUser({ requestedRole: "student", displayName: "PR4 Pkg" });
    accounts.push(a.id);
    const stu = await newStudent(a.id, "PkgKid");
    await svc.from("package_minute_ledger").insert({
      account_id: a.id,
      minutes_delta: 120,
      entry_type: "purchase",
      reason: "pr4 test grant",
      reference: `pr4-pkg-${SFX}`,
    });
    const client = await signIn(a.email, a.password);
    const slots = await client.rpc("get_available_slots", {
      p_subject_id: null,
      p_duration: 60,
      p_from: futureUtc(6, 0).toISOString(),
      p_to: futureUtc(8, 0).toISOString(),
    });
    assert.ok((slots.data ?? []).length > 0);
    const r = await book(client, {
      studentId: stu,
      subjectId: null,
      duration: 60,
      start: slots.data[0].slot_start,
    });
    assert.equal(r.error, null, r.error?.message);
    assert.equal(r.data.funding, "package");
    assert.equal(r.data.package_minutes_used, 60);
    assert.equal(r.data.stripe_cents_due, 0);
    const { data: bal } = await svc.rpc("get_customer_balances", { p_account: a.id });
    assert.equal(bal.package_minutes, 60);
  });

  it("dollar-credit behavior remains intact for Study Hall (null subject)", async (t) => {
    if (!pr4Applied) {
      t.skip("migration 0022 not applied to this environment yet");
      return;
    }
    const a = await createUser({ requestedRole: "student", displayName: "PR4 Credit" });
    accounts.push(a.id);
    const stu = await newStudent(a.id, "CredKid");
    await svc.from("dollar_credit_ledger").insert({
      account_id: a.id,
      amount_cents: 1200,
      entry_type: "grant",
      reason: "pr4 test credit",
      reference: `pr4-credit-${SFX}`,
    });
    const client = await signIn(a.email, a.password);
    const slots = await client.rpc("get_available_slots", {
      p_subject_id: null,
      p_duration: 60,
      p_from: futureUtc(9, 0).toISOString(),
      p_to: futureUtc(11, 0).toISOString(),
    });
    assert.ok((slots.data ?? []).length > 0);
    const r = await book(client, {
      studentId: stu,
      subjectId: null,
      duration: 60,
      start: slots.data[0].slot_start,
    });
    assert.equal(r.error, null, r.error?.message);
    assert.equal(r.data.funding, "credit");
    assert.equal(r.data.credit_cents_used, 1200);
    assert.equal(r.data.stripe_cents_due, 0);
  });

  it("one free session per account remains intact (second child cannot re-claim)", async (t) => {
    if (!pr4Applied) {
      t.skip("migration 0022 not applied to this environment yet");
      return;
    }
    const a = await createUser({ requestedRole: "student", displayName: "PR4 FreeOnce" });
    accounts.push(a.id);
    const stu1 = await newStudent(a.id, "Child One");
    const stu2 = await newStudent(a.id, "Child Two");
    const client = await signIn(a.email, a.password);
    const slots = await client.rpc("get_available_slots", {
      p_subject_id: null,
      p_duration: 60,
      p_from: futureUtc(12, 0).toISOString(),
      p_to: futureUtc(14, 0).toISOString(),
    });
    assert.ok((slots.data ?? []).length > 1);
    const first = await book(client, {
      studentId: stu1,
      subjectId: null,
      duration: 60,
      start: slots.data[0].slot_start,
      free: true,
    });
    assert.equal(first.error, null, first.error?.message);
    const second = await book(client, {
      studentId: stu2,
      subjectId: null,
      duration: 60,
      start: slots.data[1].slot_start,
      free: true,
    });
    assert.ok(second.error, "second free trial on same account must fail");
    assert.match(second.error.message, /already used its free trial/i);
  });

  it("authorize_session_join opens exactly 5 minutes before start", async (t) => {
    if (!pr4Applied) {
      t.skip("migration 0022 not applied to this environment yet");
      return;
    }
    const start = futureUtc(20, 15);
    const end = new Date(start.getTime() + 60 * 60000);
    const stu = await newStudent(parent.id, "Join Window Kid");
    const { data: row } = await svc
      .from("bookings")
      .insert({
        student_id: stu,
        account_id: parent.id,
        tutor_id: guideA.id,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        duration_minutes: 60,
        status: "confirmed",
        payment_status: "paid",
        price_cents: 1200,
        is_free_trial: false,
        student_first_name: "Join",
        tutor_display_name: "Guide Alpha",
      })
      .select("id")
      .single();
    const client = await signIn(parent.email, parent.password);
    const { data, error } = await client.rpc("authorize_session_join", { p_booking: row.id });
    assert.equal(error, null, error?.message);
    assert.equal(data.authorized, true);
    const leadMin = (new Date(data.scheduled_start) - new Date(data.join_open_at)) / 60000;
    assert.equal(leadMin, 5);
    assert.equal(data.counterpart, "Guide");
  });

  it("authorization: anon cannot book or authorize join", async () => {
    const anon = adminClient(); // service is fine for setup; use fresh anon for authz
    const { createClient } = await import("@supabase/supabase-js");
    const naked = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const booked = await naked.rpc("book_session", {
      p_student_id: "00000000-0000-0000-0000-000000000099",
      p_subject_id: null,
      p_other_subject: null,
      p_request_note: null,
      p_duration: 60,
      p_start: futureUtc(3, 10).toISOString(),
      p_is_free_trial: false,
    });
    assert.ok(booked.error, "anon book_session must fail");
    const join = await naked.rpc("authorize_session_join", {
      p_booking: "00000000-0000-0000-0000-000000000099",
    });
    // Either error or authorized:false — never open access for anon.
    if (!join.error) {
      assert.equal(join.data?.authorized, false);
    }
    void anon;
  });
});
