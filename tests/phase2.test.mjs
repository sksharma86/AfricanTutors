import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  adminGetProfile,
  adminGetTutor,
  anonClient,
  cleanupAll,
  createUser,
  hasSupabaseEnv,
  makeAdmin,
  signIn,
} from "./helpers.mjs";

// These tests run against the live Supabase project. Skip cleanly when the
// project credentials are not present (e.g. CI without secrets).
describe("Phase 2 — live Supabase auth, roles & RLS", { skip: !hasSupabaseEnv }, () => {
  let student; // { id, email, password }
  let studentClient;
  let tutorApplicant;
  let admin;
  let adminSignedIn;

  before(async () => {
    student = await createUser({ requestedRole: "student", displayName: "Sam Student" });
    tutorApplicant = await createUser({ requestedRole: "tutor", displayName: "Tia Tutor" });
    admin = await createUser({ requestedRole: "student", displayName: "Ada Admin" });
    await makeAdmin(admin.id);

    studentClient = await signIn(student.email, student.password);
    adminSignedIn = await signIn(admin.email, admin.password);
  });

  after(async () => {
    await cleanupAll();
  });

  it("student signup creates a profile with role=student + a student_profiles row (trigger)", async () => {
    const profile = await adminGetProfile(student.id);
    assert.equal(profile.role, "student");
    assert.equal(profile.display_name, "Sam Student");
    const tutor = await adminGetTutor(student.id);
    assert.equal(tutor, null, "student should not have a tutor application");
  });

  it("tutor signup creates a PENDING application and does NOT grant tutor role", async () => {
    const profile = await adminGetProfile(tutorApplicant.id);
    assert.equal(profile.role, "student", "tutor applicants stay student until approved");
    const tutor = await adminGetTutor(tutorApplicant.id);
    assert.equal(tutor.status, "pending");
  });

  it("a student can read ONLY their own profile", async () => {
    const { data } = await studentClient.from("profiles").select("id, role");
    assert.equal(data.length, 1);
    assert.equal(data[0].id, student.id);
  });

  it("a student cannot read another user's profile", async () => {
    const { data } = await studentClient.from("profiles").select("id").eq("id", admin.id);
    assert.equal(data.length, 0, "RLS must hide other users' profiles");
  });

  it("a student cannot read tutor_profiles (tutor/admin data is off-limits)", async () => {
    const { data } = await studentClient.from("tutor_profiles").select("profile_id");
    assert.equal(data.length, 0);
  });

  it("a student cannot read other students' private student_profiles", async () => {
    // studentClient can see its own student_profiles row, but nobody else's.
    const { data } = await studentClient.from("student_profiles").select("profile_id");
    assert.ok(data.every((row) => row.profile_id === student.id));
  });

  it("anon (logged-out) users cannot read any profiles", async () => {
    const anon = anonClient();
    const { data, error } = await anon.from("profiles").select("id");
    // Either an outright permission error or zero rows — both mean no access.
    assert.ok(error || (data ?? []).length === 0, "anon must not read any profiles");
  });

  it("a student cannot escalate their own role to admin", async () => {
    const { error } = await studentClient
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", student.id);
    assert.ok(error, "role escalation must be rejected");
    const profile = await adminGetProfile(student.id);
    assert.equal(profile.role, "student", "role must remain student");
  });

  it("a tutor applicant cannot self-approve their tutor application", async () => {
    const applicantClient = await signIn(tutorApplicant.email, tutorApplicant.password);
    const { error } = await applicantClient
      .from("tutor_profiles")
      .update({ status: "approved" })
      .eq("profile_id", tutorApplicant.id);
    assert.ok(error, "self-approval must be rejected");
    const tutor = await adminGetTutor(tutorApplicant.id);
    assert.equal(tutor.status, "pending");
  });

  it("a non-admin cannot call approve_tutor()", async () => {
    const { error } = await studentClient.rpc("approve_tutor", { target: tutorApplicant.id });
    assert.ok(error, "approve_tutor must reject non-admins");
    const tutor = await adminGetTutor(tutorApplicant.id);
    assert.equal(tutor.status, "pending");
  });

  it("an admin can read all profiles", async () => {
    const { data } = await adminSignedIn.from("profiles").select("id");
    assert.ok(data.length >= 3, "admin should see every profile");
  });

  it("an admin CAN approve a tutor, which grants the tutor role", async () => {
    const { error } = await adminSignedIn.rpc("approve_tutor", { target: tutorApplicant.id });
    assert.equal(error, null);
    const profile = await adminGetProfile(tutorApplicant.id);
    assert.equal(profile.role, "tutor");
    const tutor = await adminGetTutor(tutorApplicant.id);
    assert.equal(tutor.status, "approved");
    assert.equal(tutor.approved_by, admin.id);
    assert.ok(tutor.approved_at);
  });

  it("an approved tutor still cannot read students' private data", async () => {
    const tutorClient = await signIn(tutorApplicant.email, tutorApplicant.password);
    const { data: students } = await tutorClient.from("student_profiles").select("profile_id");
    assert.equal(students.length, 0, "tutors must never read student_profiles");
    const { data: profiles } = await tutorClient.from("profiles").select("id");
    assert.equal(profiles.length, 1, "tutor should only see their own profile");
    assert.equal(profiles[0].id, tutorApplicant.id);
  });
});
