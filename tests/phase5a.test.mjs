import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { adminClient, anonClient, cleanupAll, createUser, hasSupabaseEnv, makeAdmin, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;

async function approveTutor(id) {
  await svc.from("tutor_profiles").update({ status: "approved", timezone: "UTC", comp_rate_cents_per_hour: 1000 }).eq("profile_id", id);
  await svc.from("profiles").update({ role: "tutor" }).eq("id", id);
}
async function newStudent(acc, name) {
  const { data } = await svc.from("students").insert({ account_id: acc, full_name: name, grade_level: "9", timezone: "UTC" }).select("id").single();
  return data.id;
}
// Insert a booking with precise tutor/account/time/status control (bypasses the
// booking engine so authorization/window logic can be tested deterministically).
async function insertBooking({ account, student, tutor, status = "confirmed", startMinFromNow = 5, duration = 60, subjectName = "Algebra" }) {
  let scheduled_start = null, scheduled_end = null;
  if (startMinFromNow !== null) {
    const s = new Date(Date.now() + startMinFromNow * 60000);
    scheduled_start = s.toISOString();
    scheduled_end = new Date(s.getTime() + duration * 60000).toISOString();
  }
  const row = {
    account_id: account, student_id: student, tutor_id: tutor ?? null,
    scheduled_start, scheduled_end, duration_minutes: duration, is_free_trial: false, price_cents: 2000,
    status, payment_status: status === "confirmed" ? "paid" : "awaiting_payment",
    student_first_name: "Amara", tutor_display_name: "Tomiwa Tutor", subject_name: subjectName,
  };
  const { data, error } = await svc.from("bookings").insert(row).select("id").single();
  if (error) throw new Error("insertBooking: " + error.message);
  return data.id;
}

describe("Phase 5A — session room authorization, window, presence (live)", { skip: !hasSupabaseEnv }, () => {
  let admin, adminC, tutor, tutor2, custA, custB, cA, cB, cT, cT2, stuA;
  const accounts = [];
  const bookings = [];

  before(async () => {
    admin = await createUser({ requestedRole: "student", displayName: "Admin 5A" });
    await makeAdmin(admin.id);
    adminC = await signIn(admin.email, admin.password);
    tutor = await createUser({ requestedRole: "tutor", displayName: "Tomiwa Tutor" });
    tutor2 = await createUser({ requestedRole: "tutor", displayName: "Other Tutor" });
    await approveTutor(tutor.id);
    await approveTutor(tutor2.id);
    custA = await createUser({ requestedRole: "student", displayName: "Parent A" });
    custB = await createUser({ requestedRole: "student", displayName: "Parent B" });
    accounts.push(admin.id, tutor.id, tutor2.id, custA.id, custB.id);
    stuA = await newStudent(custA.id, "Amara");
    cA = await signIn(custA.email, custA.password);
    cB = await signIn(custB.email, custB.password);
    cT = await signIn(tutor.email, tutor.password);
    cT2 = await signIn(tutor2.email, tutor2.password);
  });

  after(async () => {
    for (const b of bookings) await svc.from("session_presence").delete().eq("booking_id", b);
    await svc.from("bookings").delete().in("account_id", accounts);
    await cleanupAll();
  });

  async function freshTutor() {
    const t = await createUser({ requestedRole: "tutor", displayName: "Pool Tutor" });
    await approveTutor(t.id);
    return t.id;
  }
  // Each booking gets its own tutor by default so the tutor/slot exclusion
  // constraint never rejects overlapping near-now confirmed test bookings.
  async function mk(opts) {
    const t = opts.tutor ?? (await freshTutor());
    const id = await insertBooking({ ...opts, tutor: t });
    bookings.push(id);
    return id;
  }
  const authz = (client, id) => client.rpc("authorize_session_join", { p_booking: id });

  it("valid customer within the window is allowed (student role, non-owner, safe name)", async () => {
    const id = await mk({ account: custA.id, student: stuA, startMinFromNow: 5 });
    const { data } = await authz(cA, id);
    assert.equal(data.authorized, true);
    assert.equal(data.role, "student");
    assert.equal(data.join_state, "open");
    assert.equal(data.is_owner, false);
    assert.equal(data.safe_name, "Amara");
    assert.equal(data.room_name, "at-" + id.replace(/-/g, ""), "deterministic, PII-free room name");
    assert.ok(!/@/.test(JSON.stringify(data)), "no email exposed in payload");
  });

  it("valid assigned tutor within the window is allowed (tutor role, non-owner, first-name only)", async () => {
    const id = await mk({ account: custA.id, student: stuA, tutor: tutor.id, startMinFromNow: 6 });
    const { data } = await authz(cT, id);
    assert.equal(data.authorized, true);
    assert.equal(data.role, "tutor");
    assert.equal(data.is_owner, false);
    assert.equal(data.safe_name, "Tomiwa", "tutor shown by first name only");
  });

  it("cross-account and unassigned access is denied", async () => {
    const id = await mk({ account: custA.id, student: stuA, startMinFromNow: 7 });
    assert.equal((await authz(cB, id)).data.authorized, false, "another customer blocked");
    assert.equal((await authz(cT2, id)).data.authorized, false, "unassigned tutor blocked");
    // anonymous cannot even execute the function
    const anon = anonClient();
    const res = await anon.rpc("authorize_session_join", { p_booking: id });
    assert.ok(res.error || res.data?.authorized === false, "anonymous blocked");
  });

  it("invalid booking states are not joinable", async () => {
    for (const status of ["cancelled", "expired", "completed", "no_show", "pending"]) {
      const id = await mk({ account: custA.id, student: stuA, status, startMinFromNow: 8 });
      const { data } = await authz(cA, id);
      assert.equal(data.authorized, true, `${status}: still a party`);
      assert.notEqual(data.join_state, "open", `${status} must not be joinable`);
    }
  });

  it("join window boundaries: too early and too late are blocked; inside is open", async () => {
    const early = await mk({ account: custA.id, student: stuA, startMinFromNow: 30 }); // opens in 20m
    assert.equal((await authz(cA, early)).data.join_state, "too_early");
    const late = await mk({ account: custA.id, student: stuA, startMinFromNow: -120, duration: 60 }); // closed 45m ago
    assert.equal((await authz(cA, late)).data.join_state, "too_late");
    const open = await mk({ account: custA.id, student: stuA, startMinFromNow: -5, duration: 60 }); // in progress
    assert.equal((await authz(cA, open)).data.join_state, "open");
  });

  it("assigned tutor after the close time is blocked (too_late)", async () => {
    const id = await mk({ account: custA.id, student: stuA, tutor: tutor.id, startMinFromNow: -180, duration: 60 });
    const { data } = await authz(cT, id);
    assert.equal(data.role, "tutor");
    assert.equal(data.join_state, "too_late", "tutor cannot join after the 15-min post-end close");
  });

  it("admin is owner and may join a confirmed scheduled session outside the normal window", async () => {
    const id = await mk({ account: custA.id, student: stuA, startMinFromNow: 300 }); // way early for others
    const { data } = await authz(adminC, id);
    assert.equal(data.role, "admin");
    assert.equal(data.is_owner, true);
    assert.equal(data.join_state, "open", "admin override for support");
    // ...but not for a cancelled booking
    const cancelled = await mk({ account: custA.id, student: stuA, status: "cancelled", startMinFromNow: 5 });
    assert.equal((await authz(adminC, cancelled)).data.join_state, "not_joinable");
  });

  it("room name is deterministic and stable across calls", async () => {
    const id = await mk({ account: custA.id, student: stuA, startMinFromNow: 5 });
    const a = (await authz(cA, id)).data.room_name;
    const b = (await authz(adminC, id)).data.room_name;
    assert.equal(a, b);
    assert.equal(a, "at-" + id.replace(/-/g, ""));
  });

  it("presence: service records join once (idempotent) and leave; clients cannot forge or cross-read", async () => {
    const id = await mk({ account: custA.id, student: stuA, startMinFromNow: 5 });
    // service (financial actor) records join twice → first_joined set once
    await svc.rpc("record_session_presence", { p_booking: id, p_role: "student", p_event: "join" });
    const first = (await svc.from("session_presence").select("student_first_joined_at").eq("booking_id", id).single()).data.student_first_joined_at;
    await svc.rpc("record_session_presence", { p_booking: id, p_role: "student", p_event: "join" });
    const again = (await svc.from("session_presence").select("student_first_joined_at, tutor_first_joined_at").eq("booking_id", id).single()).data;
    assert.equal(again.student_first_joined_at, first, "first_joined_at not overwritten");
    assert.equal(again.tutor_first_joined_at, null, "tutor not marked joined");
    await svc.rpc("record_session_presence", { p_booking: id, p_role: "tutor", p_event: "join" });
    await svc.rpc("record_session_presence", { p_booking: id, p_role: "student", p_event: "leave" });
    const row = (await svc.from("session_presence").select("*").eq("booking_id", id).single()).data;
    assert.ok(row.tutor_first_joined_at && row.student_last_left_at);

    // a customer cannot write presence
    assert.ok((await cA.rpc("record_session_presence", { p_booking: id, p_role: "student", p_event: "join" })).error, "client cannot forge presence");
    // owner can read own presence; other customer cannot
    assert.equal((await cA.from("session_presence").select("booking_id").eq("booking_id", id)).data.length, 1);
    assert.equal((await cB.from("session_presence").select("booking_id").eq("booking_id", id)).data.length, 0, "cross-account presence hidden");
  });

  it("concurrent join presence writes converge on a single row / single first_joined", async () => {
    const id = await mk({ account: custA.id, student: stuA, startMinFromNow: 5 });
    await Promise.all([
      svc.rpc("record_session_presence", { p_booking: id, p_role: "student", p_event: "join" }),
      svc.rpc("record_session_presence", { p_booking: id, p_role: "student", p_event: "join" }),
      svc.rpc("record_session_presence", { p_booking: id, p_role: "tutor", p_event: "join" }),
    ]);
    const { count } = await svc.from("session_presence").select("*", { count: "exact", head: true }).eq("booking_id", id);
    assert.equal(count, 1, "exactly one presence row per booking");
  });
});

// Static guard — no DB required: the Daily API key must never reach the browser.
describe("Phase 5A — Daily API key is never exposed client-side", () => {
  const root = path.resolve("src");
  function walk(dir) {
    const out = [];
    for (const e of readdirSync(dir)) {
      const p = path.join(dir, e);
      if (statSync(p).isDirectory()) out.push(...walk(p));
      else if (/\.(ts|tsx|js|jsx|mjs)$/.test(e)) out.push(p);
    }
    return out;
  }
  const files = walk(root);

  it("no client component references DAILY_API_KEY, and no NEXT_PUBLIC_DAILY* exists", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      assert.ok(!/NEXT_PUBLIC_DAILY/.test(src), `${f} must not expose a NEXT_PUBLIC_DAILY var`);
      if (src.includes('"use client"') || src.includes("'use client'")) {
        assert.ok(!src.includes("DAILY_API_KEY"), `${f} is a client component and must not reference DAILY_API_KEY`);
      }
    }
  });

  it("the Daily REST client is server-only", () => {
    const client = readFileSync(path.join(root, "lib/daily/client.ts"), "utf8");
    assert.ok(client.includes('import "server-only"'), "daily/client.ts must be server-only");
  });
});
