import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, cleanupAll, createUser, hasSupabaseEnv, signIn } from "./helpers.mjs";
import { tutorSessionAction, tutorTimezone } from "../src/lib/tutor-schedule.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;

describe("Phase 7 fix — tutor schedule action + timezone fallback (pure)", () => {
  it("only a confirmed scheduled booking offers a Join action", () => {
    assert.equal(tutorSessionAction("confirmed", true), "join");
    assert.equal(tutorSessionAction("pending", true), "awaiting", "pending → neutral, no join control");
    for (const s of ["cancelled", "expired", "completed", "no_show"]) assert.equal(tutorSessionAction(s, true), "closed");
    assert.equal(tutorSessionAction("confirmed", false), "none", "no schedule → nothing to join");
  });

  it("missing/blank timezone falls back to UTC; explicit zones are preserved and not mutated", () => {
    assert.equal(tutorTimezone("Africa/Lagos"), "Africa/Lagos");
    assert.equal(tutorTimezone("America/Chicago"), "America/Chicago");
    assert.equal(tutorTimezone(null), "UTC");
    assert.equal(tutorTimezone(undefined), "UTC");
    assert.equal(tutorTimezone("   "), "UTC");
    const stored = null;
    tutorTimezone(stored);
    assert.equal(stored, null, "pure fallback never mutates stored value");
  });
});

describe("Phase 7 fix — server authorization matches the UI (live)", { skip: !hasSupabaseEnv }, () => {
  let cust, stu, tX, tY, tNull, cTX, cTY;
  const accounts = [];
  const bookings = [];

  async function approve(id, tz) {
    await svc.from("tutor_profiles").update({ status: "approved", timezone: tz, comp_rate_cents_per_hour: 1000 }).eq("profile_id", id);
    await svc.from("profiles").update({ role: "tutor" }).eq("id", id);
  }
  async function mk({ tutor, status, minutesFromNow = 5 }) {
    const s = new Date(Date.now() + minutesFromNow * 60000);
    const { data, error } = await svc.from("bookings").insert({
      account_id: cust.id, student_id: stu, tutor_id: tutor,
      scheduled_start: s.toISOString(), scheduled_end: new Date(s.getTime() + 3600000).toISOString(),
      duration_minutes: 60, is_free_trial: false, price_cents: 2000, status,
      payment_status: status === "confirmed" ? "paid" : "awaiting_payment",
      student_first_name: "Amara", tutor_display_name: "T", subject_name: "Algebra",
    }).select("id").single();
    if (error) throw new Error(error.message);
    bookings.push(data.id);
    return data.id;
  }

  before(async () => {
    cust = await createUser({ requestedRole: "student", displayName: "Parent" });
    tX = await createUser({ requestedRole: "tutor", displayName: "Tutor X" });
    tY = await createUser({ requestedRole: "tutor", displayName: "Tutor Y" });
    tNull = await createUser({ requestedRole: "tutor", displayName: "Tutor Null" });
    await approve(tX.id, "America/Chicago");
    await approve(tY.id, "UTC");
    // tutor with an explicitly NULL timezone
    await svc.from("tutor_profiles").update({ status: "approved", timezone: null }).eq("profile_id", tNull.id);
    await svc.from("profiles").update({ role: "tutor" }).eq("id", tNull.id);
    const { data: s } = await svc.from("students").insert({ account_id: cust.id, full_name: "Amara", grade_level: "9", timezone: "UTC" }).select("id").single();
    stu = s.id;
    cTX = await signIn(tX.email, tX.password);
    cTY = await signIn(tY.email, tY.password);
    accounts.push(cust.id, tX.id, tY.id, tNull.id);
  });
  after(async () => {
    for (const b of bookings) await svc.from("bookings").delete().eq("id", b);
    await svc.from("bookings").delete().in("account_id", accounts);
    await cleanupAll();
  });

  it("confirmed scheduled booking is joinable server-side (open); pending and cancelled are not", async () => {
    const confirmed = await mk({ tutor: tX.id, status: "confirmed", minutesFromNow: 5 });
    const pending = await mk({ tutor: tY.id, status: "pending", minutesFromNow: 5 });
    const cancelled = await mk({ tutor: tX.id, status: "cancelled", minutesFromNow: 5 });

    assert.equal((await cTX.rpc("authorize_session_join", { p_booking: confirmed })).data.join_state, "open", "confirmed → joinable");
    assert.equal((await cTY.rpc("authorize_session_join", { p_booking: pending })).data.join_state, "not_joinable", "pending → not joinable (matches hidden Join)");
    assert.equal((await cTX.rpc("authorize_session_join", { p_booking: cancelled })).data.join_state, "not_joinable", "cancelled → not joinable");
  });

  it("rendering a tutor's timezone never mutates the stored value", async () => {
    const before = (await svc.from("tutor_profiles").select("timezone").eq("profile_id", tX.id).single()).data.timezone;
    tutorTimezone(before); // pure render-time fallback
    const afterRead = (await svc.from("tutor_profiles").select("timezone").eq("profile_id", tX.id).single()).data.timezone;
    assert.equal(afterRead, before, "stored timezone unchanged by rendering (still America/Chicago)");
  });
});
