import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";

import {
  COMPENSATION_CURRENCIES,
  aggregateCompensationByCurrency,
  formatCompensationHourly,
  formatCompensationMinor,
  formatCompensationTotals,
  isSupportedCompensationCurrency,
  summarizeGuideCompensation,
} from "../src/lib/compensation-currency.mjs";
import { adminClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const svc = hasSupabaseEnv ? adminClient() : null;

describe("Guide compensation currency — display and aggregation", () => {
  it("supports the required ISO currencies and rejects inference-only codes", () => {
    for (const code of ["KES", "USD", "INR", "PHP", "NGN"]) {
      assert.equal(isSupportedCompensationCurrency(code), true);
    }
    assert.deepEqual(COMPENSATION_CURRENCIES, ["KES", "USD", "INR", "PHP", "NGN"]);
    assert.equal(isSupportedCompensationCurrency("XYZ"), false);
    assert.equal(isSupportedCompensationCurrency("kenyan"), false);
  });

  it("formats KES as KSh, not $", () => {
    assert.equal(formatCompensationHourly(50000, "KES"), "KSh 500 / hour");
    assert.equal(formatCompensationMinor(800000, "KES"), "KSh 8,000");
    assert.equal(formatCompensationMinor(350000, "KES"), "KSh 3,500");
    assert.doesNotMatch(formatCompensationMinor(50000, "KES"), /\$/);
  });

  it("formats USD, INR, PHP, and NGN with conventional symbols", () => {
    assert.equal(formatCompensationHourly(800, "USD"), "$8.00 / hour");
    assert.match(formatCompensationMinor(50000, "INR"), /₹\s?500/);
    assert.match(formatCompensationMinor(45000, "PHP"), /₱\s?450/);
    assert.match(formatCompensationMinor(500000, "NGN"), /₦\s?5,000/);
  });

  it("never sums mixed currencies into one total", () => {
    const totals = aggregateCompensationByCurrency([
      { amount_cents: 4250000, status: "earned", currency: "KES" },
      { amount_cents: 6400, status: "outstanding", currency: "USD" },
      { amount_cents: 300000, status: "earned", currency: "INR" },
      { amount_cents: 100, status: "voided", currency: "USD" },
    ]);
    assert.equal(totals.length, 3);
    assert.deepEqual(
      totals.map((t) => t.currency),
      ["KES", "USD", "INR"],
    );
    assert.equal(totals.find((t) => t.currency === "KES").earned, 4250000);
    assert.equal(totals.find((t) => t.currency === "USD").outstanding, 6400);
    assert.equal(totals.find((t) => t.currency === "INR").earned, 300000);
    const label = formatCompensationTotals(totals, "earned");
    assert.match(label, /KSh/);
    assert.match(label, /₹/);
    assert.doesNotMatch(label, /\$412/);
    assert.ok(label.includes(" · "), "mixed totals stay grouped, not collapsed");
  });

  it("paid / outstanding bookkeeping stays in the earning currency", () => {
    const totals = aggregateCompensationByCurrency([
      { amount_cents: 650000, status: "earned", currency: "KES" },
      { amount_cents: 500000, status: "paid", currency: "KES" },
      { amount_cents: 800, status: "paid", currency: "USD" },
    ]);
    const kes = totals.find((t) => t.currency === "KES");
    const usd = totals.find((t) => t.currency === "USD");
    assert.equal(kes.earned, 1_150_000);
    assert.equal(kes.paid, 500000);
    assert.equal(kes.outstanding, 650000);
    assert.equal(usd.earned, 800);
    assert.equal(usd.paid, 800);
    assert.equal(usd.outstanding, 0);
  });

  it("Finance Center per-Guide summary uses configured rate currency and snapshotted earnings", () => {
    const rows = summarizeGuideCompensation(
      [
        { profile_id: "g-ke", name: "Jane Wanjiku", rate_cents: 50000, currency: "KES" },
        { profile_id: "g-us", name: "Alex", rate_cents: 800, currency: "USD" },
      ],
      [
        { tutor_id: "g-ke", amount_cents: 800000, status: "earned", currency: "KES" },
        { tutor_id: "g-ke", amount_cents: 350000, status: "earned", currency: "KES" },
        { tutor_id: "g-ke", amount_cents: 450000, status: "paid", currency: "KES" },
        { tutor_id: "g-us", amount_cents: 800, status: "earned", currency: "USD" },
      ],
    );
    const jane = rows.find((r) => r.profile_id === "g-ke");
    assert.equal(formatCompensationHourly(jane.rate_cents, jane.currency), "KSh 500 / hour");
    assert.equal(formatCompensationTotals(jane.totals, "earned"), "KSh 16,000");
    assert.equal(formatCompensationTotals(jane.totals, "outstanding"), "KSh 11,500");
    assert.equal(formatCompensationTotals(jane.totals, "paid"), "KSh 4,500");
    const historicalMixed = summarizeGuideCompensation(
      [{ profile_id: "g-ke", name: "Jane", rate_cents: 800, currency: "USD" }],
      [
        { tutor_id: "g-ke", amount_cents: 50000, status: "earned", currency: "KES" },
        { tutor_id: "g-ke", amount_cents: 800, status: "earned", currency: "USD" },
      ],
    )[0];
    assert.equal(historicalMixed.currency, "USD");
    assert.equal(historicalMixed.totals.length, 2);
    assert.ok(formatCompensationTotals(historicalMixed.totals, "earned").includes(" · "));
  });
});

describe("Guide compensation currency — source contracts", () => {
  it("migration 0029 labels existing rows USD and snapshots amount + currency", () => {
    const m = read("supabase/migrations/0029_guide_comp_currency.sql");
    assert.match(m, /compensation_currencies/);
    assert.match(m, /'KES'/);
    assert.match(m, /'USD'/);
    assert.match(m, /'INR'/);
    assert.match(m, /'PHP'/);
    assert.match(m, /'NGN'/);
    assert.match(m, /comp_currency/);
    assert.match(m, /set currency = 'USD'/);
    assert.match(m, /set comp_currency = 'USD'/);
    assert.match(m, /Amounts are NOT converted/);
    assert.match(m, /admin_set_tutor_rate\(p_tutor uuid, p_rate_cents integer, p_currency text default 'USD'\)/);
    assert.match(m, /insert into public\.tutor_earnings \([\s\S]*currency/);
    assert.doesNotMatch(m, /timezone|nationality|ip.?address|geo/i);
    assert.doesNotMatch(m, /exchange.?rate|fx_|forex|openexchangerates|exchangerate/i);
    assert.doesNotMatch(m, /stripe.?connect|transfers\.create|payouts\.create/i);
    assert.doesNotMatch(m, /session_list_price_cents|PAYG_PRICE/);
  });

  it("manager rate control sets amount + controlled ISO currency", () => {
    const form = read("src/components/dashboard/tutor-rate-form.tsx");
    assert.match(form, /p_rate_cents: cents/);
    assert.match(form, /p_currency: currency/);
    assert.match(form, /COMPENSATION_CURRENCIES/);
    assert.match(form, /Compensation currency/);
    assert.match(form, /already-earned or paid amounts never change/);
    assert.doesNotMatch(form, /timezone|nationality|navigator\.language/);
  });

  it("Finance Center and Guide portal format compensation currency, not customer formatCents", () => {
    const finance = read("src/components/dashboard/admin-finance-console.tsx");
    const financePage = read("src/app/dashboard/admin/finance/page.tsx");
    const guide = read("src/app/dashboard/tutor/earnings/page.tsx");
    assert.match(finance, /aggregateCompensationByCurrency/);
    assert.match(finance, /formatCompensationTotals/);
    assert.match(finance, /summarizeGuideCompensation/);
    assert.match(finance, /Mixed currencies are never added together/);
    assert.match(finance, /Do not convert currencies/);
    assert.match(financePage, /comp_currency/);
    assert.match(financePage, /currency,/);
    assert.match(guide, /formatCompensationHourly/);
    assert.match(guide, /formatCompensationMinor/);
    assert.match(guide, /comp_currency/);
    const earningsTab = finance.slice(finance.indexOf("function EarningsTab"), finance.indexOf("function DisputesTab"));
    assert.doesNotMatch(earningsTab, /formatCents\(/);
    assert.match(finance, /formatCents\(p\.gross_cents\)/, "customer Stripe payments stay USD formatCents");
  });

  it("customer Stripe pricing / payment math stays USD and is unchanged", () => {
    const pricing = read("src/lib/pricing.ts");
    assert.match(pricing, /PAYG_PRICE_USD = 12/);
    assert.match(pricing, /minutes: 60, priceUsd: 12/);
    assert.match(pricing, /minutes: 120, priceUsd: 24/);
    assert.match(pricing, /minutes: 180, priceUsd: 36/);
    assert.match(pricing, /ONLY customer-facing pricing/);
    assert.match(pricing, /export function formatCents/);
    assert.doesNotMatch(pricing, /comp_currency|KES|COMPENSATION_CURRENCIES/);
    const payments = read("supabase/migrations/0005_phase4a_financial.sql");
    assert.match(payments, /currency\s+text not null default 'usd'/);
    assert.match(read("src/lib/checkout-service.ts"), /formatCents/);
    assert.doesNotMatch(read("supabase/migrations/0029_guide_comp_currency.sql"), /payments|stripe_paid_cents|session_list_price_cents/);
  });

  it("existing earning generation and external mark-paid architecture remain", () => {
    const m10 = read("supabase/migrations/0010_phase4c_admin_ops.sql");
    assert.match(m10, /admin_mark_earning_paid/);
    assert.match(m10, /admin_mark_earnings_paid_batch/);
    assert.match(read("src/components/dashboard/admin-finance-console.tsx"), /admin_mark_earnings_paid_batch/);
    assert.match(read("src/components/dashboard/admin-finance-console.tsx"), /admin_mark_earning_paid/);
    assert.doesNotMatch(read("src/components/dashboard/admin-finance-console.tsx"), /stripeConnect|transfers\.create|payouts\.create/);
    assert.match(read("src/lib/compensation-currency.mjs"), /No FX conversion/);
  });
});

async function currencySchemaReady() {
  if (!svc) return false;
  const probe = await svc.from("tutor_profiles").select("comp_currency").limit(1);
  return !probe.error;
}

const live = hasSupabaseEnv && (await currencySchemaReady());

describe("Guide compensation currency — live snapshot (0029)", { skip: !live }, () => {
  let admin;
  let tutor;
  let parent;
  let studentId;
  let bookingKes;
  let bookingUsd;
  let bookingInr;
  let adminC;

  async function seedBooking() {
    const { data, error } = await svc
      .from("bookings")
      .insert({
        account_id: parent.id,
        student_id: studentId,
        tutor_id: tutor.id,
        status: "completed",
        duration_minutes: 60,
        price_cents: 1200,
      })
      .select("id")
      .single();
    if (error) throw new Error("seedBooking: " + error.message);
    return data.id;
  }

  before(async () => {
    admin = await createUser({ requestedRole: "student", displayName: "Comp Admin" });
    await makeAdmin(admin.id);
    tutor = await createUser({ requestedRole: "tutor", displayName: "Comp Guide" });
    parent = await createUser({ requestedRole: "student", displayName: "Comp Parent" });
    await svc.from("tutor_profiles").update({ status: "approved", timezone: "UTC" }).eq("profile_id", tutor.id);
    const { data: stu } = await svc
      .from("students")
      .insert({ account_id: parent.id, full_name: "Kid", grade_level: "5", timezone: "UTC" })
      .select("id")
      .single();
    studentId = stu.id;
    bookingKes = await seedBooking();
    bookingUsd = await seedBooking();
    bookingInr = await seedBooking();
    adminC = await signIn(admin.email, admin.password);
  });

  after(async () => {
    await svc.from("tutor_earnings").delete().eq("tutor_id", tutor.id);
    await svc.from("payments").delete().eq("account_id", parent.id);
    await svc.from("financial_audit_log").delete().eq("entity_id", tutor.id);
    await cleanupAll();
  });

  it("Guide can have KES compensation and a completed session snapshots amount + currency", async () => {
    const set = await adminC.rpc("admin_set_tutor_rate", {
      p_tutor: tutor.id,
      p_rate_cents: 50000,
      p_currency: "KES",
    });
    assert.equal(set.error, null, set.error?.message);
    const { data: prof } = await svc
      .from("tutor_profiles")
      .select("comp_rate_cents_per_hour, comp_currency")
      .eq("profile_id", tutor.id)
      .single();
    assert.equal(prof.comp_rate_cents_per_hour, 50000);
    assert.equal(prof.comp_currency, "KES");
    const rec = await svc.rpc("record_tutor_earning", { p_booking: bookingKes, p_reason: "kes snapshot" });
    assert.equal(rec.error, null, rec.error?.message);
    const { data: e } = await svc
      .from("tutor_earnings")
      .select("amount_cents, rate_cents_per_hour, currency, status")
      .eq("booking_id", bookingKes)
      .single();
    assert.equal(e.amount_cents, 50000);
    assert.equal(e.rate_cents_per_hour, 50000);
    assert.equal(e.currency, "KES");
    assert.equal(e.status, "earned");
  });

  it("Guide can have USD compensation", async () => {
    const set = await adminC.rpc("admin_set_tutor_rate", {
      p_tutor: tutor.id,
      p_rate_cents: 800,
      p_currency: "USD",
    });
    assert.equal(set.error, null, set.error?.message);
    const rec = await svc.rpc("record_tutor_earning", { p_booking: bookingUsd, p_reason: "usd snapshot" });
    assert.equal(rec.error, null, rec.error?.message);
    const { data: e } = await svc
      .from("tutor_earnings")
      .select("amount_cents, currency")
      .eq("booking_id", bookingUsd)
      .single();
    assert.equal(e.amount_cents, 800);
    assert.equal(e.currency, "USD");
  });

  it("Guide can have another supported currency (INR)", async () => {
    const set = await adminC.rpc("admin_set_tutor_rate", {
      p_tutor: tutor.id,
      p_rate_cents: 50000,
      p_currency: "INR",
    });
    assert.equal(set.error, null, set.error?.message);
    const rec = await svc.rpc("record_tutor_earning", { p_booking: bookingInr, p_reason: "inr snapshot" });
    assert.equal(rec.error, null, rec.error?.message);
    const { data: e } = await svc
      .from("tutor_earnings")
      .select("amount_cents, currency")
      .eq("booking_id", bookingInr)
      .single();
    assert.equal(e.amount_cents, 50000);
    assert.equal(e.currency, "INR");
  });

  it("changing future rate or currency does not change historical earnings", async () => {
    const { data: before } = await svc
      .from("tutor_earnings")
      .select("amount_cents, rate_cents_per_hour, currency")
      .eq("booking_id", bookingKes)
      .single();
    assert.deepEqual(before, { amount_cents: 50000, rate_cents_per_hour: 50000, currency: "KES" });
    const set = await adminC.rpc("admin_set_tutor_rate", {
      p_tutor: tutor.id,
      p_rate_cents: 60000,
      p_currency: "USD",
    });
    assert.equal(set.error, null, set.error?.message);
    const { data: after } = await svc
      .from("tutor_earnings")
      .select("amount_cents, rate_cents_per_hour, currency")
      .eq("booking_id", bookingKes)
      .single();
    assert.deepEqual(after, before, "historical KES earning unchanged after later USD rate");
    const { data: usd } = await svc
      .from("tutor_earnings")
      .select("amount_cents, currency")
      .eq("booking_id", bookingUsd)
      .single();
    assert.deepEqual(usd, { amount_cents: 800, currency: "USD" });
  });

  it("paid / outstanding bookkeeping preserves currency; existing 2-arg rate RPC still works", async () => {
    const { data: e } = await svc.from("tutor_earnings").select("id, currency, amount_cents").eq("booking_id", bookingKes).single();
    const paid = await adminC.rpc("admin_mark_earning_paid", { p_earning_id: e.id, p_note: "external payout" });
    assert.equal(paid.error, null, paid.error?.message);
    const { data: after } = await svc
      .from("tutor_earnings")
      .select("status, currency, amount_cents")
      .eq("id", e.id)
      .single();
    assert.equal(after.status, "paid");
    assert.equal(after.currency, "KES");
    assert.equal(after.amount_cents, 50000);
    const twoArg = await adminC.rpc("admin_set_tutor_rate", { p_tutor: tutor.id, p_rate_cents: 1200 });
    assert.equal(twoArg.error, null, twoArg.error?.message);
    const { data: prof } = await svc
      .from("tutor_profiles")
      .select("comp_rate_cents_per_hour, comp_currency")
      .eq("profile_id", tutor.id)
      .single();
    assert.equal(prof.comp_rate_cents_per_hour, 1200);
    assert.equal(prof.comp_currency, "USD");
  });

  it("customer payment rows remain USD and compensation does not convert them", async () => {
    const { data, error } = await svc
      .from("payments")
      .insert({
        account_id: parent.id,
        purpose: "booking",
        gross_cents: 1200,
        stripe_paid_cents: 1200,
        credit_applied_cents: 0,
        refunded_cents: 0,
        status: "succeeded",
      })
      .select("currency, gross_cents")
      .single();
    assert.equal(error, null, error?.message);
    assert.equal(data.gross_cents, 1200);
    assert.equal(String(data.currency).toLowerCase(), "usd");
  });
});
