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

describe("Study Hall PR4 — source: supervision + whole-hour bookings", () => {
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

  it("30-minute Study Hall is not offered to customers", () => {
    const pricing = read("src/lib/pricing.ts");
    const wiz = read("src/components/booking/booking-wizard.tsx");
    const cards = read("src/components/dashboard/single-session-cards.tsx");
    const route = read("src/app/api/checkout/booking/route.ts");
    assert.doesNotMatch(pricing, /minutes:\s*30,/);
    assert.match(pricing, /minutes:\s*60,\s*priceUsd:\s*12/);
    assert.match(pricing, /minutes:\s*120,\s*priceUsd:\s*24/);
    assert.match(pricing, /minutes:\s*180,\s*priceUsd:\s*36/);
    assert.match(pricing, /label: "1 hour"/);
    assert.match(pricing, /label: "2 hours"/);
    assert.match(pricing, /label: "3 hours"/);
    assert.doesNotMatch(wiz, /30 minutes|30-minute/i);
    assert.doesNotMatch(cards, /30 minutes|Book 30/i);
    assert.match(route, /isStudyHallDuration/);
    assert.doesNotMatch(route, /duration === 60 \? 60 : 30/);
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
    assert.equal(customerJoinState("confirmed", start, end, base + 14 * 60000).state, "opens_at");
    assert.equal(customerJoinState("confirmed", start, end, base + 16 * 60000).state, "join");
    assert.equal(
      customerJoinState("confirmed", start, end, base).openAtISO,
      new Date(base + 15 * 60000).toISOString(),
    );
  });

  it("migration 0022: subject bypass, 5-min room, whole-hour prices, no comp change", () => {
    const m = read("supabase/migrations/0022_studyhall_pr4_supervision_booking.sql");
    assert.match(m, /Study Hall PR4/);
    assert.match(m, /duration_minutes in \(30, 60, 120, 180\)/);
    assert.match(m, /Study Hall sessions are 1, 2, or 3 hours/);
    assert.match(m, /\(p_duration \/ 60\) \* 1200/);
    assert.match(m, /p_subject_id is null/);
    assert.match(m, /interval '5 minutes'/);
    assert.doesNotMatch(m, /interval '10 minutes'/);
    assert.match(m, /No Guide is available for that time/);
    assert.match(m, /free trial is 60 minutes only/i);
    assert.match(m, /account_has_used_free_trial/);
    assert.match(m, /p_subject_id is null and p_start is null/);
    const sqlBody = m
      .split("\n")
      .filter((l) => !/^\s*--/.test(l))
      .join("\n");
    assert.doesNotMatch(sqlBody, /comp_rate|auto_?refill|stripe.?connect/i);
  });

  it("Guide earnings formula already scales with duration (unchanged architecture)", () => {
    const earn = read("supabase/migrations/0006_phase4a_review_fixes.sql");
    assert.match(earn, /v_rate::numeric \* v_duration \/ 60\.0/);
  });

  it("PR2 package pricing + PR3 free-trial constants remain intact", () => {
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
    await svc.from("tutor_availability").delete().eq("tutor_id", tutorId).eq("day_of_week", dow);
    await svc.from("tutor_availability").insert({
      tutor_id: tutorId,
      day_of_week: dow,
      start_time: start,
      end_time: end,
    });
  }

  async function clearAvail(tutorId) {
    await svc.from("tutor_availability").delete().eq("tutor_id", tutorId);
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

  async function minutes(accountId) {
    const { data } = await svc.rpc("get_customer_balances", { p_account: accountId });
    return data?.package_minutes ?? 0;
  }

  async function detectPr4() {
    const q = await svc.rpc("booking_quote", {
      p_account: parent.id,
      p_duration: 120,
      p_is_free_trial: false,
    });
    if (q.error || q.data?.session_price_cents !== 2400) return false;

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
    await svc.from("tutor_profiles").update({ comp_rate_cents_per_hour: 1000 }).eq("profile_id", guideA.id);
    await svc.from("tutor_profiles").update({ comp_rate_cents_per_hour: 1000 }).eq("profile_id", guideB.id);
    for (let d = 0; d < 7; d++) {
      await avail(guideA.id, d);
      await avail(guideB.id, d);
    }
    const { data: subj, error: se } = await svc
      .from("subjects")
      .insert({ name: `PR4 Specialty ${SFX}`, category: "math", is_active: true })
      .select("id")
      .single();
    assert.equal(se, null, se?.message);
    subjectOnlyA = subj.id;
    await svc.from("tutor_subjects").insert({ tutor_id: guideA.id, subject_id: subjectOnlyA });

    pr4Applied = await detectPr4();
  });

  after(async () => {
    for (const acc of accounts) {
      await svc.from("tutor_earnings").delete().in(
        "booking_id",
        (await svc.from("bookings").select("id").eq("account_id", acc)).data?.map((b) => b.id) ?? [],
      );
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

  it("PR2: packages remain 14h/$140 and 28h/$252; $12/hour rate for 60 min", async () => {
    const q60 = await svc.rpc("booking_quote", {
      p_account: parent.id,
      p_duration: 60,
      p_is_free_trial: false,
    });
    assert.equal(q60.error, null, q60.error?.message);
    assert.equal(q60.data.session_price_cents, 1200);

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

  it("paid Study Hall quotes: 60=$12, 120=$24, 180=$36 (skip until 0022)", async (t) => {
    if (!pr4Applied) {
      t.skip("migration 0022 not applied to this environment yet");
      return;
    }
    for (const [dur, cents] of [
      [60, 1200],
      [120, 2400],
      [180, 3600],
    ]) {
      const q = await svc.rpc("booking_quote", {
        p_account: parent.id,
        p_duration: dur,
        p_is_free_trial: false,
      });
      assert.equal(q.error, null, q.error?.message);
      assert.equal(q.data.session_price_cents, cents, `${dur} min`);
      assert.equal(q.data.stripe_cents_due, cents);
    }
  });

  it("free trial cannot be 120 or 180 minutes", async (t) => {
    if (!pr4Applied) {
      t.skip("migration 0022 not applied to this environment yet");
      return;
    }
    for (const dur of [120, 180]) {
      const q = await svc.rpc("booking_quote", {
        p_account: parent.id,
        p_duration: dur,
        p_is_free_trial: true,
      });
      assert.ok(q.error, `free trial at ${dur} must fail`);
      assert.match(q.error.message, /60 minutes only/i);
    }
  });

  it("scheduled Study Hall rejects 30-minute duration", async (t) => {
    if (!pr4Applied) {
      t.skip("migration 0022 not applied to this environment yet");
      return;
    }
    const client = await signIn(parent.email, parent.password);
    const stu = await newStudent(parent.id, "No Thirty");
    const r = await book(client, {
      studentId: stu,
      subjectId: null,
      duration: 30,
      start: futureUtc(5, 10).toISOString(),
    });
    assert.ok(r.error);
    assert.match(r.error.message, /1, 2, or 3 hours|Invalid duration/i);
  });

  it("null-subject slots + auto Guide assignment for 60-min free session", async (t) => {
    if (!pr4Applied) {
      t.skip("migration 0022 not applied to this environment yet");
      return;
    }
    const client = await signIn(parent.email, parent.password);
    const slots = await client.rpc("get_available_slots", {
      p_subject_id: null,
      p_duration: 60,
      p_from: futureUtc(3, 0).toISOString(),
      p_to: futureUtc(5, 0).toISOString(),
    });
    assert.equal(slots.error, null, slots.error?.message);
    assert.ok((slots.data ?? []).length > 0);

    const stu = await newStudent(parent.id, "Study Hall Kid");
    const r = await book(client, {
      studentId: stu,
      subjectId: null,
      duration: 60,
      start: slots.data[0].slot_start,
      free: true,
    });
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
    assert.equal(b.status, "confirmed");
    assert.equal(b.is_free_trial, true);
    assert.equal(b.duration_minutes, 60);
    assert.equal(b.price_cents, 0);
  });

  it("package booking consumes 60/120/180 correctly; cancel restores exact amount", async (t) => {
    if (!pr4Applied) {
      t.skip("migration 0022 not applied to this environment yet");
      return;
    }
    for (const dur of [60, 120, 180]) {
      const a = await createUser({ requestedRole: "student", displayName: `PR4 Pkg${dur}` });
      accounts.push(a.id);
      const stu = await newStudent(a.id, `PkgKid${dur}`);
      await svc.from("package_minute_ledger").insert({
        account_id: a.id,
        minutes_delta: 400,
        entry_type: "purchase",
        reason: "pr4 test grant",
        reference: `pr4-pkg-${dur}-${SFX}`,
      });
      const client = await signIn(a.email, a.password);
      const slots = await client.rpc("get_available_slots", {
        p_subject_id: null,
        p_duration: dur,
        p_from: futureUtc(6 + dur / 60, 0).toISOString(),
        p_to: futureUtc(10 + dur / 60, 0).toISOString(),
      });
      assert.ok((slots.data ?? []).length > 0, `slots for ${dur}`);
      const r = await book(client, {
        studentId: stu,
        subjectId: null,
        duration: dur,
        start: slots.data[0].slot_start,
      });
      assert.equal(r.error, null, r.error?.message);
      assert.equal(r.data.funding, "package");
      assert.equal(r.data.package_minutes_used, dur);
      assert.equal(r.data.session_price_cents, (dur / 60) * 1200);
      assert.equal(await minutes(a.id), 400 - dur);

      const cancel = await client.rpc("customer_cancel_booking", { p_booking: r.data.booking_id });
      assert.equal(cancel.error, null, cancel.error?.message);
      assert.equal(await minutes(a.id), 400, `${dur}-min cancel must restore exactly`);
    }
  });

  it("2h/3h: assigned Guide must be continuously available for the full interval", async (t) => {
    if (!pr4Applied) {
      t.skip("migration 0022 not applied to this environment yet");
      return;
    }

    // Deterministic continuous-availability rule on a Guide we control (does not
    // assume other Guides are absent from the shared database).
    await clearAvail(guideA.id);
    const probeStart = futureUtc(15, 14); // 14:00 UTC
    const dow = probeStart.getUTCDay();
    await avail(guideA.id, dow, "14:00", "15:30"); // 90 minutes only
    const end2h = new Date(probeStart.getTime() + 120 * 60000).toISOString();
    const short = await svc.rpc("tutor_is_available", {
      p_tutor: guideA.id,
      p_tz: "UTC",
      p_start: probeStart.toISOString(),
      p_end: end2h,
    });
    assert.equal(short.error, null, short.error?.message);
    assert.equal(short.data, false, "a 90-minute availability block must not cover a 2h Study Hall");

    await clearAvail(guideA.id);
    await avail(guideA.id, dow, "14:00", "18:00"); // continuous 4h block
    const end3h = new Date(probeStart.getTime() + 180 * 60000).toISOString();
    const full = await svc.rpc("tutor_is_available", {
      p_tutor: guideA.id,
      p_tz: "UTC",
      p_start: probeStart.toISOString(),
      p_end: end3h,
    });
    assert.equal(full.error, null, full.error?.message);
    assert.equal(full.data, true, "one continuous block must cover a 3h Study Hall");

    // Real bookings: whoever is assigned must own the full continuous span.
    for (const dur of [120, 180]) {
      const a = await createUser({ requestedRole: "student", displayName: `PR4 Contig${dur}` });
      accounts.push(a.id);
      const stu = await newStudent(a.id, `LongKid${dur}`);
      await svc.from("package_minute_ledger").insert({
        account_id: a.id,
        minutes_delta: dur,
        entry_type: "purchase",
        reason: "pr4 contig",
        reference: `pr4-contig-${dur}-${SFX}`,
      });
      const client = await signIn(a.email, a.password);
      const slots = await client.rpc("get_available_slots", {
        p_subject_id: null,
        p_duration: dur,
        p_from: futureUtc(16 + dur / 60, 0).toISOString(),
        p_to: futureUtc(20 + dur / 60, 0).toISOString(),
      });
      assert.ok((slots.data ?? []).length > 0, `need slots for ${dur}-min Study Hall`);
      const r = await book(client, {
        studentId: stu,
        subjectId: null,
        duration: dur,
        start: slots.data[0].slot_start,
      });
      assert.equal(r.error, null, r.error?.message);
      const { data: b } = await svc
        .from("bookings")
        .select("tutor_id, duration_minutes, scheduled_start, scheduled_end")
        .eq("id", r.data.booking_id)
        .single();
      assert.ok(b.tutor_id, "exactly one Guide must own the booking");
      assert.equal(b.duration_minutes, dur);
      const spanMin = (new Date(b.scheduled_end) - new Date(b.scheduled_start)) / 60000;
      assert.equal(spanMin, dur, "scheduled window must equal the full continuous duration");

      // Calendar coverage: assigned Guide has a weekly block spanning the whole local window.
      const { data: tp } = await svc
        .from("tutor_profiles")
        .select("timezone")
        .eq("profile_id", b.tutor_id)
        .single();
      const tz = tp?.timezone && String(tp.timezone).trim() ? tp.timezone : "UTC";
      const localStart = new Date(b.scheduled_start);
      // Compare via tutor_is_available ignoring THIS booking: temporarily mark it cancelled.
      await svc.from("bookings").update({ status: "cancelled" }).eq("id", r.data.booking_id);
      const cov = await svc.rpc("tutor_is_available", {
        p_tutor: b.tutor_id,
        p_tz: tz,
        p_start: b.scheduled_start,
        p_end: b.scheduled_end,
      });
      assert.equal(cov.error, null, cov.error?.message);
      assert.equal(
        cov.data,
        true,
        `assigned Guide must be continuously available for the full ${dur}-min Study Hall`,
      );
      // Restore confirmed for cleanup consistency (ledger already consumed).
      await svc.from("bookings").update({ status: "confirmed" }).eq("id", r.data.booking_id);
      void localStart;
    }

    for (let d = 0; d < 7; d++) {
      await avail(guideA.id, d);
      await avail(guideB.id, d);
    }
  });

  it("Guide earnings scale with duration using the assigned Guide's rate", async (t) => {
    if (!pr4Applied) {
      t.skip("migration 0022 not applied to this environment yet");
      return;
    }

    for (const dur of [60, 120, 180]) {
      const a = await createUser({ requestedRole: "student", displayName: `PR4 Earn${dur}` });
      accounts.push(a.id);
      const stu = await newStudent(a.id, `EarnKid${dur}`);
      await svc.from("package_minute_ledger").insert({
        account_id: a.id,
        minutes_delta: dur,
        entry_type: "purchase",
        reason: "pr4 earn",
        reference: `pr4-earn-${dur}-${SFX}`,
      });
      const client = await signIn(a.email, a.password);
      const slots = await client.rpc("get_available_slots", {
        p_subject_id: null,
        p_duration: dur,
        p_from: futureUtc(18 + dur / 30, 0).toISOString(),
        p_to: futureUtc(22 + dur / 30, 0).toISOString(),
      });
      assert.ok((slots.data ?? []).length > 0, `slots for ${dur}`);
      const r = await book(client, {
        studentId: stu,
        subjectId: null,
        duration: dur,
        start: slots.data[0].slot_start,
      });
      assert.equal(r.error, null, r.error?.message);

      const { data: booking } = await svc
        .from("bookings")
        .select("tutor_id, duration_minutes")
        .eq("id", r.data.booking_id)
        .single();
      assert.ok(booking.tutor_id);
      assert.equal(booking.duration_minutes, dur);

      const { data: profile } = await svc
        .from("tutor_profiles")
        .select("comp_rate_cents_per_hour")
        .eq("profile_id", booking.tutor_id)
        .single();
      assert.ok(
        typeof profile?.comp_rate_cents_per_hour === "number",
        "assigned Guide must have a compensation rate set",
      );

      await svc
        .from("bookings")
        .update({
          status: "completed",
          scheduled_start: new Date(Date.now() - (dur + 60) * 60000).toISOString(),
          scheduled_end: new Date(Date.now() - 60 * 60000).toISOString(),
        })
        .eq("id", r.data.booking_id);

      const { data: earnId, error: ee } = await svc.rpc("record_tutor_earning", {
        p_booking: r.data.booking_id,
        p_reason: `pr4 duration scale ${dur}`,
      });
      assert.equal(ee, null, ee?.message);
      assert.ok(earnId);

      const { data: earn } = await svc
        .from("tutor_earnings")
        .select("duration_minutes, rate_cents_per_hour, amount_cents, tutor_id")
        .eq("booking_id", r.data.booking_id)
        .single();
      assert.equal(earn.tutor_id, booking.tutor_id);
      assert.equal(earn.duration_minutes, dur);
      // Snapshot may equal current profile rate; authority is the earning row itself.
      assert.equal(earn.rate_cents_per_hour, profile.comp_rate_cents_per_hour);
      const expected = Math.round((earn.rate_cents_per_hour * dur) / 60);
      assert.equal(
        earn.amount_cents,
        expected,
        `${dur} min must earn ${dur / 60}× the assigned Guide's hourly rate`,
      );
    }
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
      p_from: futureUtc(22, 0).toISOString(),
      p_to: futureUtc(24, 0).toISOString(),
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
    const start = futureUtc(25, 15);
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
  });

  it("authorization: anon cannot book or authorize join", async () => {
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
    if (!join.error) {
      assert.equal(join.data?.authorized, false);
    }
  });
});
