import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { adminClient, cleanupAll, createUser, hasSupabaseEnv, signIn } from "./helpers.mjs";

const svc = hasSupabaseEnv ? adminClient() : null;
const SFX = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function futureUtc(days, hour, min = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, min, 0, 0);
  return d;
}

async function newSubject(name) {
  const { data, error } = await svc.from("subjects").insert({ name: `${name} ${SFX}`, category: "other" }).select("id").single();
  if (error) throw new Error("newSubject: " + error.message);
  return data.id;
}

async function approveTutor(id, tz = "UTC") {
  await svc.from("tutor_profiles").update({ status: "approved", timezone: tz }).eq("profile_id", id);
  await svc.from("profiles").update({ role: "tutor" }).eq("id", id);
}

async function qualify(tutorId, subjectId) {
  const { error } = await svc.from("tutor_subjects").insert({ tutor_id: tutorId, subject_id: subjectId });
  if (error) throw new Error("qualify: " + error.message);
}

async function avail(tutorId, dow, start, end) {
  const { error } = await svc
    .from("tutor_availability")
    .insert({ tutor_id: tutorId, day_of_week: dow, start_time: start, end_time: end });
  if (error) throw new Error("avail: " + error.message);
}

async function newStudent(accountId, name, tz = "UTC") {
  const { data, error } = await svc
    .from("students")
    .insert({ account_id: accountId, full_name: name, grade_level: "9", timezone: tz })
    .select("id")
    .single();
  if (error) throw new Error("newStudent: " + error.message);
  return data.id;
}

const book = (client, args) =>
  client.rpc("create_booking", {
    p_student_id: args.studentId,
    p_subject_id: args.subjectId,
    p_other_subject: null,
    p_request_note: null,
    p_duration: args.duration,
    p_start: args.start,
    p_is_free_trial: args.free ?? false,
    p_student_ids: args.studentIds ?? [args.studentId],
  });

function clocksOnDay(rows, day) {
  return (rows ?? [])
    .filter((r) => {
      const t = new Date(r.slot_start);
      return t.getUTCFullYear() === day.getUTCFullYear() && t.getUTCMonth() === day.getUTCMonth() && t.getUTCDate() === day.getUTCDate();
    })
    .map((r) => r.slot_start.slice(11, 16))
    .sort();
}

describe("Half-hour scheduling — live slot generation and booking", { skip: !hasSupabaseEnv }, () => {
  let parent;
  let tutorOnHour;
  let tutorOnHalf;
  let tutorLegacy;
  let tutorTight;
  let tutorChi;
  let childUtc;
  let childChi;
  let child2;
  let subjHour;
  let subjHalf;
  let subjLegacy;
  let subjTight;
  let subjChi;
  let slotDay;

  before(async () => {
    parent = await createUser({ requestedRole: "student", displayName: "Half Hour Parent" });
    tutorOnHour = await createUser({ requestedRole: "tutor", displayName: "Hour Grid Guide" });
    tutorOnHalf = await createUser({ requestedRole: "tutor", displayName: "Half Grid Guide" });
    tutorLegacy = await createUser({ requestedRole: "tutor", displayName: "Legacy 144 Guide" });
    tutorTight = await createUser({ requestedRole: "tutor", displayName: "Tight 144 Guide" });
    tutorChi = await createUser({ requestedRole: "tutor", displayName: "Chicago Grid Guide" });
    await approveTutor(tutorOnHour.id, "UTC");
    await approveTutor(tutorOnHalf.id, "UTC");
    await approveTutor(tutorLegacy.id, "UTC");
    await approveTutor(tutorTight.id, "UTC");
    await approveTutor(tutorChi.id, "America/Chicago");
    childUtc = await newStudent(parent.id, "Grid Kid", "UTC");
    childChi = await newStudent(parent.id, "Chicago Kid", "America/Chicago");
    child2 = await newStudent(parent.id, "Sibling Kid", "UTC");
    subjHour = await newSubject("HourGrid");
    subjHalf = await newSubject("HalfGrid");
    subjLegacy = await newSubject("Legacy144");
    subjTight = await newSubject("Tight144");
    subjChi = await newSubject("ChiGrid");
    await qualify(tutorOnHour.id, subjHour);
    await qualify(tutorOnHalf.id, subjHalf);
    await qualify(tutorLegacy.id, subjLegacy);
    await qualify(tutorTight.id, subjTight);
    await qualify(tutorChi.id, subjChi);
    slotDay = futureUtc(6, 0);
    await avail(tutorOnHour.id, slotDay.getUTCDay(), "17:00", "19:00");
    await avail(tutorOnHalf.id, slotDay.getUTCDay(), "17:30", "19:30");
    await avail(tutorLegacy.id, slotDay.getUTCDay(), "13:44", "20:00");
    await avail(tutorTight.id, slotDay.getUTCDay(), "13:44", "14:50");
    await avail(tutorChi.id, slotDay.getUTCDay(), "12:00", "16:00");
  });

  after(async () => {
    for (const id of [subjHour, subjHalf, subjLegacy, subjTight, subjChi]) {
      if (id) await svc.from("subjects").delete().eq("id", id);
    }
    await cleanupAll();
  });

  it(":00 availability produces valid :00/:30 booking slots", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data, error } = await c.rpc("get_available_slots", {
      p_subject_id: subjHour,
      p_duration: 60,
      p_from: slotDay.toISOString(),
      p_to: futureUtc(7, 0).toISOString(),
    });
    assert.equal(error, null, error?.message);
    assert.deepEqual(clocksOnDay(data, slotDay), ["17:00", "17:30", "18:00"]);
  });

  it(":30 availability produces valid half-hour-grid slots", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data, error } = await c.rpc("get_available_slots", {
      p_subject_id: subjHalf,
      p_duration: 60,
      p_from: slotDay.toISOString(),
      p_to: futureUtc(7, 0).toISOString(),
    });
    assert.equal(error, null, error?.message);
    assert.deepEqual(clocksOnDay(data, slotDay), ["17:30", "18:00", "18:30"]);
  });

  it("legacy 1:44 PM availability never produces a 1:44 PM booking slot", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data } = await c.rpc("get_available_slots", {
      p_subject_id: subjLegacy,
      p_duration: 60,
      p_from: slotDay.toISOString(),
      p_to: futureUtc(7, 0).toISOString(),
    });
    const clocks = clocksOnDay(data, slotDay);
    assert.equal(clocks.includes("13:44"), false);
    assert.equal(clocks.includes("13:14"), false);
    assert.equal(clocks.includes("14:14"), false);
  });

  it("1:44 PM availability snaps the candidate grid forward to 2:00 PM", async () => {
    const c = await signIn(parent.email, parent.password);
    const from = new Date(Date.UTC(slotDay.getUTCFullYear(), slotDay.getUTCMonth(), slotDay.getUTCDate(), 13, 0, 0));
    const to = new Date(Date.UTC(slotDay.getUTCFullYear(), slotDay.getUTCMonth(), slotDay.getUTCDate(), 21, 0, 0));
    const { data } = await c.rpc("get_available_slots", {
      p_subject_id: subjLegacy,
      p_duration: 60,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });
    const clocks = clocksOnDay(data, slotDay);
    assert.equal(clocks[0], "14:00");
    assert.equal(clocks.includes("13:44"), false);
    assert.equal(clocks.includes("13:30"), false);
  });

  it("offers a session only when the entire duration fits inside Guide availability", async () => {
    const c = await signIn(parent.email, parent.password);
    const from = new Date(Date.UTC(slotDay.getUTCFullYear(), slotDay.getUTCMonth(), slotDay.getUTCDate(), 13, 0, 0));
    const to = new Date(Date.UTC(slotDay.getUTCFullYear(), slotDay.getUTCMonth(), slotDay.getUTCDate(), 16, 0, 0));
    const { data } = await c.rpc("get_available_slots", {
      p_subject_id: subjTight,
      p_duration: 60,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });
    assert.deepEqual(clocksOnDay(data, slotDay), []);
  });

  it("direct booking at 1:44 PM is rejected", async () => {
    const c = await signIn(parent.email, parent.password);
    const start = new Date(Date.UTC(slotDay.getUTCFullYear(), slotDay.getUTCMonth(), slotDay.getUTCDate(), 13, 44, 0)).toISOString();
    const { error } = await book(c, { studentId: childUtc, subjectId: subjLegacy, duration: 60, start });
    assert.ok(error, "1:44 booking must fail");
    assert.match(error.message, /half-hour/i);
  });

  it("direct booking at a legitimate half-hour boundary can succeed when eligible", async () => {
    const c = await signIn(parent.email, parent.password);
    const start = new Date(Date.UTC(slotDay.getUTCFullYear(), slotDay.getUTCMonth(), slotDay.getUTCDate(), 14, 0, 0)).toISOString();
    const { data, error } = await book(c, { studentId: childUtc, subjectId: subjLegacy, duration: 60, start });
    assert.equal(error, null, error?.message);
    assert.ok(data);
    const { data: row } = await svc.from("bookings").select("scheduled_start, tutor_id").eq("id", data).single();
    assert.equal(new Date(row.scheduled_start).toISOString().slice(11, 16), "14:00");
    assert.equal(row.tutor_id, tutorLegacy.id);
  });

  it("timezone conversion keeps the customer-facing half-hour grid", async () => {
    const c = await signIn(parent.email, parent.password);
    const { data } = await c.rpc("get_available_slots", {
      p_subject_id: subjChi,
      p_duration: 60,
      p_from: slotDay.toISOString(),
      p_to: futureUtc(7, 0).toISOString(),
    });
    assert.ok((data ?? []).length > 0);
    for (const row of data ?? []) {
      const local = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date(row.slot_start));
      const minute = Number(local.find((p) => p.type === "minute")?.value);
      assert.ok(minute === 0 || minute === 30, `Chicago minute ${minute} for ${row.slot_start}`);
    }
  });

  it("household booking still works on a half-hour start", async () => {
    const c = await signIn(parent.email, parent.password);
    const start = new Date(Date.UTC(slotDay.getUTCFullYear(), slotDay.getUTCMonth(), slotDay.getUTCDate(), 15, 0, 0)).toISOString();
    const { data, error } = await book(c, {
      studentId: childUtc,
      studentIds: [childUtc, child2],
      subjectId: subjLegacy,
      duration: 60,
      start,
    });
    assert.equal(error, null, error?.message);
    const { data: kids } = await svc.from("booking_children").select("student_id").eq("booking_id", data);
    assert.equal((kids ?? []).length, 2);
  });

  it("matching cannot create an off-grid Study Hall", async () => {
    const c = await signIn(parent.email, parent.password);
    // 14:17 UTC sits inside the legacy 13:44–20:00 window, so availability would
    // otherwise match. The half-hour trigger must still reject the booking.
    const start = new Date(Date.UTC(slotDay.getUTCFullYear(), slotDay.getUTCMonth(), slotDay.getUTCDate(), 18, 17, 0)).toISOString();
    const { error } = await book(c, { studentId: childUtc, subjectId: subjLegacy, duration: 60, start });
    assert.ok(error);
    assert.match(error.message, /half-hour/i);
  });
});
