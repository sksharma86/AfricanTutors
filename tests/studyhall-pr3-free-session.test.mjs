import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, describe, it } from "node:test";

import {
  PACKAGE_14H_MINUTES,
  PACKAGE_14H_PRICE_CENTS,
  PACKAGE_28H_MINUTES,
  PACKAGE_28H_PRICE_CENTS,
} from "../src/lib/packages.mjs";
import { adminClient, cleanupAll, createUser, hasSupabaseEnv, signIn } from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const pricingSrc = read("src/lib/pricing.ts");

describe("Study Hall PR3 — free trial is one complete hour (source)", () => {
  it("FREE_TRIAL_MINUTES is 60 and paid PAYG remains $12", () => {
    assert.match(pricingSrc, /FREE_TRIAL_MINUTES = 60/);
    assert.match(pricingSrc, /PAYG_MINUTES = 60/);
    assert.match(pricingSrc, /PAYG_PRICE_USD = 12/);
    assert.match(pricingSrc, /minutes:\s*60,\s*priceUsd:\s*12/);
  });

  it("customer-facing free-session copy no longer says 30-minute free trial", () => {
    const surfaces = [
      "src/components/booking/booking-wizard.tsx",
      "src/app/dashboard/student/page.tsx",
      "src/lib/faq.ts",
      "src/lib/email/templates.mjs",
      "src/components/marketing/free-trial-section.tsx",
      "src/components/marketing/site-hero.tsx",
      "src/components/marketing/pricing-section.tsx",
    ].map(read).join("\n");
    assert.doesNotMatch(surfaces, /free 30-minute|First 30 minutes|first 30-minute/i);
    assert.match(surfaces, /1-hour|60 minutes|60-minute/i);
    assert.match(surfaces, /No credit card required|no credit card/i);
  });

  it("migration 0021 only changes free-trial duration authority (not PR2 prices)", () => {
    const m = read("supabase/migrations/0021_studyhall_pr3_one_hour_free_trial.sql");
    assert.match(m, /free trial is 60 minutes only/i);
    assert.match(m, /bookings_free_trial_duration/);
    assert.match(m, /duration_minutes in \(30, 60\)/);
    assert.doesNotMatch(m, /pkg_14h|pkg_28h|14000|25200/);
    assert.match(m, /session_list_price_cents/);
    assert.match(m, /v_price := 0;/);
    const sqlBody = m.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
    assert.doesNotMatch(sqlBody, /comp_rate|auto_?refill|stripe.?connect/i);
  });

  it("PR2 package constants remain intact", () => {
    assert.equal(PACKAGE_14H_MINUTES, 840);
    assert.equal(PACKAGE_14H_PRICE_CENTS, 14000);
    assert.equal(PACKAGE_28H_MINUTES, 1680);
    assert.equal(PACKAGE_28H_PRICE_CENTS, 25200);
  });
});

describe("Study Hall PR3 — live 60-minute free session", { skip: !hasSupabaseEnv }, () => {
  const svc = adminClient();
  const ANY = "00000000-0000-0000-0000-000000000001";
  const accounts = [];

  after(async () => {
    await svc.from("bookings").delete().in("account_id", accounts);
    await svc.from("students").delete().in("account_id", accounts);
    await svc.from("package_minute_ledger").delete().in("account_id", accounts);
    await svc.from("dollar_credit_ledger").delete().in("account_id", accounts);
    await cleanupAll();
  });

  it("free-trial quote at 60 minutes is $0 with no payment / package / credit due", async () => {
    const q = await svc.rpc("booking_quote", { p_account: ANY, p_duration: 60, p_is_free_trial: true });
    assert.equal(q.error, null, q.error?.message);
    assert.equal(q.data.session_price_cents, 0);
    assert.equal(q.data.stripe_cents_due, 0);
    assert.equal(q.data.package_minutes_used, 0);
    assert.equal(q.data.credit_cents_used, 0);
    assert.equal(q.data.funding, "free_trial");
  });

  it("30-minute free-trial quote is rejected", async () => {
    const q = await svc.rpc("booking_quote", { p_account: ANY, p_duration: 30, p_is_free_trial: true });
    assert.ok(q.error, "30-min free trial quote must be rejected");
  });

  it("paid 60-minute quote remains $12 (PR2 intact)", async () => {
    const q = await svc.rpc("booking_quote", { p_account: ANY, p_duration: 60, p_is_free_trial: false });
    assert.equal(q.data.session_price_cents, 1200);
  });

  it("active packages remain 14h/$140 and 28h/$252", async () => {
    const { data } = await svc
      .from("package_products")
      .select("minutes, price_cents")
      .eq("is_active", true)
      .order("sort_order");
    assert.deepEqual(
      (data ?? []).map((r) => [r.minutes, r.price_cents]),
      [
        [840, 14000],
        [1680, 25200],
      ],
    );
  });

  it("first free session can be 60 minutes at $0; balances untouched; second rejected", async () => {
    const parent = await createUser({ requestedRole: "student", displayName: "PR3 Parent" });
    accounts.push(parent.id);
    const client = await signIn(parent.email, parent.password);
    const { data: stu, error: stuErr } = await svc
      .from("students")
      .insert({ account_id: parent.id, full_name: "PR3 Kid", grade_level: "8", timezone: "America/New_York" })
      .select("id")
      .single();
    assert.equal(stuErr, null, stuErr?.message);

    await svc.rpc("issue_package_minutes", {
      p_account: parent.id,
      p_minutes: 600,
      p_reference: `pr3-pkg-${parent.id}`,
    });
    await svc.rpc("issue_dollar_credit", {
      p_account: parent.id,
      p_amount_cents: 5000,
      p_entry_type: "admin_adjustment",
      p_reference: `pr3-cred-${parent.id}`,
    });

    // Use the "Other" subject path so the test does not depend on tutor availability.
    const r = await client.rpc("book_session", {
      p_student_id: stu.id,
      p_subject_id: null,
      p_other_subject: "Homework review",
      p_request_note: null,
      p_duration: 60,
      p_start: null,
      p_is_free_trial: true,
    });
    assert.equal(r.error, null, r.error?.message);
    assert.equal(r.data.funding, "free_trial");
    assert.equal(r.data.session_price_cents, 0);
    assert.equal(r.data.stripe_cents_due, 0);
    assert.equal(r.data.package_minutes_used, 0);
    assert.equal(r.data.credit_cents_used, 0);

    const { data: bk } = await svc
      .from("bookings")
      .select("duration_minutes, price_cents, is_free_trial, payment_status")
      .eq("id", r.data.booking_id)
      .single();
    assert.equal(bk.duration_minutes, 60);
    assert.equal(bk.price_cents, 0);
    assert.equal(bk.is_free_trial, true);
    assert.equal(bk.payment_status, "not_required");

    const bal = (await svc.rpc("get_customer_balances", { p_account: parent.id })).data;
    assert.equal(bal.package_minutes, 600, "package minutes untouched");
    assert.equal(bal.dollar_credit_cents, 5000, "dollar credit untouched");

    const r2 = await client.rpc("book_session", {
      p_student_id: stu.id,
      p_subject_id: null,
      p_other_subject: "More homework",
      p_request_note: null,
      p_duration: 60,
      p_start: null,
      p_is_free_trial: true,
    });
    assert.ok(r2.error, "second free trial must be rejected");

    const r3 = await client.rpc("book_session", {
      p_student_id: stu.id,
      p_subject_id: null,
      p_other_subject: "Should fail",
      p_request_note: null,
      p_duration: 30,
      p_start: null,
      p_is_free_trial: true,
    });
    assert.ok(r3.error, "30-min free trial must be rejected");
  });
});
