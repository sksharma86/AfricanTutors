import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabaseEnv = Boolean(url && anonKey && serviceKey);

/** Shared demo/test project identified in the 58A audit. Live tests must clean up. */
export const CANONICAL_DEMO_PROJECT_REF = "giozoutlnbiqxlvixkho";

export function isCanonicalDemoProject(supabaseUrl = url) {
  return Boolean(supabaseUrl && supabaseUrl.includes(CANONICAL_DEMO_PROJECT_REF));
}

/** Service-role client that bypasses RLS. Server-only, never shipped to the browser. */
export function adminClient() {
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Fresh anon client (one per signed-in user so sessions don't collide). */
export function anonClient() {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

const created = [];

function chunk(ids, size = 80) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

async function must(label, result) {
  if (result?.error) throw new Error(`${label}: ${result.error.message}`);
  return result;
}

async function deleteWhereIn(admin, table, column, ids) {
  if (!ids.length) return 0;
  let removed = 0;
  for (const part of chunk(ids)) {
    const { data, error } = await admin.from(table).delete().in(column, part).select("id");
    if (error) {
      const fallback = await admin.from(table).delete().in(column, part).select("*");
      if (fallback.error) throw new Error(`${table}.delete(${column}): ${error.message}`);
      removed += fallback.data?.length ?? 0;
    } else {
      removed += data?.length ?? 0;
    }
  }
  return removed;
}

/**
 * Delete application rows that would RESTRICT Auth user deletion.
 * Scoped to the given user IDs only — never a global wipe.
 */
export async function purgeApplicationDataForUsers(admin, userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return { bookings: 0 };

  await must(
    "retarget approved_by",
    await admin.from("tutor_profiles").update({ approved_by: null }).in("approved_by", ids),
  );

  const students = [];
  for (const part of chunk(ids)) {
    const { data, error } = await admin.from("students").select("id").in("account_id", part);
    if (error) throw new Error(`students lookup: ${error.message}`);
    students.push(...(data ?? []));
  }
  const studentIds = students.map((s) => s.id);

  const bookingIdSet = new Set();
  const collectBookings = async (column, values) => {
    if (!values.length) return;
    for (const part of chunk(values)) {
      const { data, error } = await admin.from("bookings").select("id").in(column, part);
      if (error) throw new Error(`bookings lookup ${column}: ${error.message}`);
      for (const row of data ?? []) bookingIdSet.add(row.id);
    }
  };
  await collectBookings("account_id", ids);
  await collectBookings("tutor_id", ids);
  await collectBookings("student_id", studentIds);
  const bookingIds = [...bookingIdSet];

  const reportIds = [];
  if (bookingIds.length) {
    for (const part of chunk(bookingIds)) {
      const { data, error } = await admin.from("session_reports").select("id").in("booking_id", part);
      if (error) throw new Error(`session_reports lookup: ${error.message}`);
      for (const row of data ?? []) reportIds.push(row.id);
    }
  }
  for (const part of chunk(ids)) {
    const { data, error } = await admin.from("session_reports").select("id").or(`tutor_id.in.(${part.join(",")}),account_id.in.(${part.join(",")})`);
    if (!error) {
      for (const row of data ?? []) if (!reportIds.includes(row.id)) reportIds.push(row.id);
    }
  }

  if (reportIds.length) await deleteWhereIn(admin, "session_report_children", "report_id", reportIds);
  if (bookingIds.length) {
    await deleteWhereIn(admin, "session_report_children", "booking_id", bookingIds);
    await deleteWhereIn(admin, "session_reports", "booking_id", bookingIds);
    await deleteWhereIn(admin, "session_recordings", "booking_id", bookingIds);
    await deleteWhereIn(admin, "session_presence", "booking_id", bookingIds);
    await deleteWhereIn(admin, "disputes", "booking_id", bookingIds);
    await deleteWhereIn(admin, "tutor_cancellation_requests", "booking_id", bookingIds);
    await deleteWhereIn(admin, "parent_escalation_requests", "booking_id", bookingIds);
    await deleteWhereIn(admin, "email_deliveries", "booking_id", bookingIds);
    await deleteWhereIn(admin, "booking_children", "booking_id", bookingIds);
  }
  if (studentIds.length) {
    await deleteWhereIn(admin, "booking_children", "student_id", studentIds);
    await deleteWhereIn(admin, "session_report_children", "student_id", studentIds);
  }

  await deleteWhereIn(admin, "session_reports", "tutor_id", ids);
  await deleteWhereIn(admin, "session_reports", "account_id", ids);
  await deleteWhereIn(admin, "parent_escalation_requests", "account_id", ids);
  await deleteWhereIn(admin, "parent_escalation_requests", "tutor_id", ids);
  await deleteWhereIn(admin, "disputes", "account_id", ids);
  await deleteWhereIn(admin, "email_deliveries", "recipient_account_id", ids);
  await deleteWhereIn(admin, "tutor_cancellation_requests", "tutor_id", ids);

  if (bookingIds.length) await deleteWhereIn(admin, "bookings", "id", bookingIds);

  if (studentIds.length) await deleteWhereIn(admin, "students", "id", studentIds);

  const paymentIds = [];
  for (const part of chunk(ids)) {
    const { data, error } = await admin.from("payments").select("id").in("account_id", part);
    if (error) throw new Error(`payments lookup: ${error.message}`);
    paymentIds.push(...(data ?? []).map((p) => p.id));
  }
  if (paymentIds.length) await deleteWhereIn(admin, "refunds", "payment_id", paymentIds);
  await deleteWhereIn(admin, "refunds", "account_id", ids);
  await deleteWhereIn(admin, "package_minute_ledger", "account_id", ids);
  await deleteWhereIn(admin, "dollar_credit_ledger", "account_id", ids);
  await deleteWhereIn(admin, "payments", "account_id", ids);
  await deleteWhereIn(admin, "tutor_earnings", "tutor_id", ids);
  await deleteWhereIn(admin, "financial_audit_log", "actor_id", ids);
  await deleteWhereIn(admin, "tutor_availability", "tutor_id", ids);
  await deleteWhereIn(admin, "tutor_availability_exceptions", "tutor_id", ids);
  await deleteWhereIn(admin, "tutor_subjects", "tutor_id", ids);

  return { bookings: bookingIds.length, students: studentIds.length, payments: paymentIds.length };
}

async function leftoverBlockers(admin, userId) {
  const checks = [
    ["payments", "account_id"],
    ["package_minute_ledger", "account_id"],
    ["dollar_credit_ledger", "account_id"],
    ["tutor_earnings", "tutor_id"],
    ["session_reports", "account_id"],
    ["session_reports", "tutor_id"],
    ["refunds", "account_id"],
    ["disputes", "account_id"],
    ["parent_escalation_requests", "account_id"],
    ["bookings", "account_id"],
    ["students", "account_id"],
    ["tutor_profiles", "approved_by"],
  ];
  const found = [];
  for (const [table, column] of checks) {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, userId);
    if (error) {
      found.push(`${table}.${column}: lookup failed (${error.message})`);
    } else if (count) {
      found.push(`${table}.${column}=${count}`);
    }
  }
  return found;
}

/**
 * Creates a confirmed auth user (no confirmation email sent). The
 * on_auth_user_created trigger runs, creating the matching profile rows.
 */
export async function createUser({ requestedRole = "student", displayName = "Test User" } = {}) {
  if (isCanonicalDemoProject() && process.env.ALLOW_DEMO_DB_WRITES !== "1") {
    throw new Error(
      "createUser refused: this is the canonical shared demo project. Point tests at a dedicated Supabase project, or set ALLOW_DEMO_DB_WRITES=1 for one isolated throwaway probe. DEMO_DB_LOCK=1 is also honored.",
    );
  }
  if (process.env.DEMO_DB_LOCK === "1" && isCanonicalDemoProject()) {
    throw new Error(
      "createUser refused: DEMO_DB_LOCK=1 is set on the canonical demo project. Use a dedicated test Supabase project.",
    );
  }
  const admin = adminClient();
  const email = `phase2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = `Pw-${Math.random().toString(36).slice(2)}-9!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { requested_role: requestedRole, display_name: displayName },
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  created.push(data.user.id);
  return { id: data.user.id, email, password };
}

/** Promotes a user to admin using the service role (bypasses RLS). */
export async function makeAdmin(userId) {
  const admin = adminClient();
  const { error } = await admin.from("profiles").update({ role: "admin" }).eq("id", userId);
  if (error) throw new Error(`makeAdmin failed: ${error.message}`);
}

/** Returns an anon client signed in as the given user. */
export async function signIn(email, password) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn failed: ${error.message}`);
  return client;
}

/** Reads a profile row using the service role (ground truth, ignores RLS). */
export async function adminGetProfile(userId) {
  const admin = adminClient();
  const { data } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data;
}

export async function adminGetTutor(userId) {
  const admin = adminClient();
  const { data } = await admin.from("tutor_profiles").select("*").eq("profile_id", userId).maybeSingle();
  return data;
}

/**
 * Remove users created by this test file. Fails loudly if Auth deletion is
 * blocked — never swallow RESTRICT errors (that is how the demo DB filled up).
 */
export async function cleanupAll() {
  const ids = created.splice(0);
  if (!ids.length) return;
  const admin = adminClient();
  await purgeApplicationDataForUsers(admin, ids);
  const failures = [];
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && !/not found|already|does not exist/i.test(error.message)) {
      const blockers = await leftoverBlockers(admin, id);
      failures.push(`${id}: ${error.message}${blockers.length ? ` blockers=${blockers.join(", ")}` : ""}`);
    }
  }
  if (failures.length) {
    throw new Error(`cleanupAll failed to delete ${failures.length} auth user(s):\n${failures.join("\n")}`);
  }
}
