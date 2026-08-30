import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import {
  adminClient,
  cleanupAll,
  createUser,
  hasSupabaseEnv,
  isCanonicalDemoProject,
  signIn,
} from "./helpers.mjs";

const allowDemoWrites = process.env.ALLOW_DEMO_DB_WRITES === "1";
const liveOk = hasSupabaseEnv && !(isCanonicalDemoProject() && !allowDemoWrites);

describe("Guide attendance confirmation — live RPCs", { skip: !liveOk }, () => {
  const svc = adminClient();
  const accounts = [];

  after(async () => {
    await cleanupAll();
  });

  it("assigned Guide can confirm; other Guide cannot; confirm is idempotent", async (t) => {
    const probe = await svc.rpc("sweep_guide_attendance");
    if (probe.error && /could not find|does not exist|schema cache/i.test(probe.error.message)) {
      t.skip("migration 0034 is not applied on this database");
      return;
    }

    const parent = await createUser({ requestedRole: "student", displayName: "Confirm Parent" });
    const guideA = await createUser({ requestedRole: "tutor", displayName: "Confirm Guide A" });
    const guideB = await createUser({ requestedRole: "tutor", displayName: "Confirm Guide B" });
    accounts.push(parent.id, guideA.id, guideB.id);

    await svc.from("profiles").update({ role: "tutor" }).eq("id", guideA.id);
    await svc.from("profiles").update({ role: "tutor" }).eq("id", guideB.id);
    await svc.from("tutor_profiles").update({ status: "approved", timezone: "UTC" }).eq("profile_id", guideA.id);
    await svc.from("tutor_profiles").update({ status: "approved", timezone: "UTC" }).eq("profile_id", guideB.id);

    const { data: student, error: studentErr } = await svc
      .from("students")
      .insert({ account_id: parent.id, full_name: "Jordan Live", grade_level: "6", timezone: "UTC" })
      .select("id")
      .single();
    assert.equal(studentErr, null, studentErr?.message);

    const start = new Date(Date.now() + 25 * 60_000).toISOString();
    const end = new Date(Date.now() + 85 * 60_000).toISOString();
    const { data: booking, error: bookErr } = await svc
      .from("bookings")
      .insert({
        account_id: parent.id,
        student_id: student.id,
        tutor_id: guideA.id,
        tutor_display_name: "Confirm Guide A",
        scheduled_start: start,
        scheduled_end: end,
        duration_minutes: 60,
        status: "confirmed",
        payment_status: "not_required",
        is_free_trial: true,
        student_first_name: "Jordan",
      })
      .select("id")
      .single();
    assert.equal(bookErr, null, bookErr?.message);

    const aClient = await signIn(guideA.email, guideA.password);
    const first = await aClient.rpc("confirm_guide_attendance", { p_booking: booking.id });
    assert.equal(first.error, null, first.error?.message);
    assert.equal(first.data?.status, "confirmed");

    const second = await aClient.rpc("confirm_guide_attendance", { p_booking: booking.id });
    assert.equal(second.error, null, second.error?.message);
    assert.equal(second.data?.idempotent, true);

    const bClient = await signIn(guideB.email, guideB.password);
    const other = await bClient.rpc("confirm_guide_attendance", { p_booking: booking.id });
    assert.ok(other.error);

    const parentClient = await signIn(parent.email, parent.password);
    const parentTry = await parentClient.rpc("confirm_guide_attendance", { p_booking: booking.id });
    assert.ok(parentTry.error);

    const sweep1 = await svc.rpc("sweep_guide_attendance");
    const sweep2 = await svc.rpc("sweep_guide_attendance");
    assert.equal(sweep1.error, null, sweep1.error?.message);
    assert.equal(sweep2.error, null, sweep2.error?.message);
    const { data: rows } = await svc
      .from("guide_attendance_assignments")
      .select("id, status")
      .eq("booking_id", booking.id)
      .eq("status", "missed");
    assert.equal((rows ?? []).length, 0);
  });
});
