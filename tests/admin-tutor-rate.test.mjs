import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";

import { adminClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const svc = hasSupabaseEnv ? adminClient() : null;

describe("Admin set tutor rate — UI wiring", () => {
  const form = read("src/components/dashboard/tutor-rate-form.tsx");
  const page = read("src/app/dashboard/admin/tutors/[tutorId]/page.tsx");

  it("detail page shows a Compensation section using the rate form", () => {
    assert.match(page, /Compensation/);
    assert.match(page, /TutorRateForm/);
    assert.match(page, /initialRateCents=\{profile\?\.comp_rate_cents_per_hour \?\? null\}/);
    assert.match(page, /initialCurrency=\{compCurrency\}/);
  });

  it("form calls the existing admin RPC and converts major units→cents (no duplicate system, no Stripe)", () => {
    assert.match(form, /admin_set_tutor_rate/);
    assert.match(form, /p_currency: currency/);
    assert.match(form, /Math\.round\(major \* 100\)/);
    assert.match(form, /major < 0/); // client guard; server re-validates
    assert.match(form, /COMPENSATION_CURRENCIES/);
    // No Stripe/automated-payout INTEGRATION (prose may still say "paid externally, not through Stripe").
    assert.doesNotMatch(form, /@stripe|loadStripe|getStripe|stripeConnect|stripe_connect|createPayout|payouts\.create|transfers\.create/i);
  });
});

describe("Admin set tutor rate — server behavior (live)", { skip: !hasSupabaseEnv }, () => {
  let admin, tutor, student, adminClientSb, studentClientSb;
  const created = [];

  before(async () => {
    admin = await createUser({ requestedRole: "student", displayName: "Rate Admin" });
    await makeAdmin(admin.id);
    tutor = await createUser({ requestedRole: "tutor", displayName: "Rate Tutor" }); // trigger creates pending tutor_profiles
    student = await createUser({ requestedRole: "student", displayName: "Rate Student" });
    created.push(admin.id, tutor.id, student.id);
    adminClientSb = await signIn(admin.email, admin.password);
    studentClientSb = await signIn(student.email, student.password);
  });

  after(async () => {
    await svc.from("tutor_earnings").delete().eq("tutor_id", tutor.id);
    await svc.from("financial_audit_log").delete().eq("entity_id", tutor.id);
    await cleanupAll();
  });

  it("admin can set the rate; it persists and writes a financial audit entry", async () => {
    const { error } = await adminClientSb.rpc("admin_set_tutor_rate", { p_tutor: tutor.id, p_rate_cents: 3000 });
    assert.equal(error, null, error?.message);
    const { data: prof } = await svc.from("tutor_profiles").select("comp_rate_cents_per_hour").eq("profile_id", tutor.id).single();
    assert.equal(prof.comp_rate_cents_per_hour, 3000);
    const { data: audit } = await svc
      .from("financial_audit_log")
      .select("action, new_state")
      .eq("entity_id", tutor.id)
      .eq("action", "set_tutor_rate");
    assert.ok((audit ?? []).length >= 1, "audit entry written");
  });

  it("a non-admin (student) cannot set a tutor rate", async () => {
    const { error } = await studentClientSb.rpc("admin_set_tutor_rate", { p_tutor: tutor.id, p_rate_cents: 9999 });
    assert.ok(error, "must be rejected");
    assert.match(error.message, /not authorized/i);
    const { data: prof } = await svc.from("tutor_profiles").select("comp_rate_cents_per_hour").eq("profile_id", tutor.id).single();
    assert.equal(prof.comp_rate_cents_per_hour, 3000, "rate unchanged by non-admin attempt");
  });

  it("a negative rate is rejected server-side", async () => {
    const { error } = await adminClientSb.rpc("admin_set_tutor_rate", { p_tutor: tutor.id, p_rate_cents: -100 });
    assert.ok(error, "negative rejected");
    assert.match(error.message, /non-negative|negative/i);
  });

  it("changing the rate does NOT alter existing earnings (snapshot immutability)", async () => {
    // A throwaway earning (no real booking) snapshotting rate=2000, amount=2000.
    const { data: e, error: insErr } = await svc
      .from("tutor_earnings")
      .insert({ tutor_id: tutor.id, booking_id: null, duration_minutes: 60, rate_cents_per_hour: 2000, amount_cents: 2000, status: "earned", earned_at: new Date().toISOString() })
      .select("id")
      .single();
    assert.equal(insErr, null, insErr?.message);

    await adminClientSb.rpc("admin_set_tutor_rate", { p_tutor: tutor.id, p_rate_cents: 5000 });

    const { data: after } = await svc.from("tutor_earnings").select("rate_cents_per_hour, amount_cents").eq("id", e.id).single();
    assert.equal(after.rate_cents_per_hour, 2000, "historical earning rate unchanged");
    assert.equal(after.amount_cents, 2000, "historical earning amount unchanged");
  });
});
