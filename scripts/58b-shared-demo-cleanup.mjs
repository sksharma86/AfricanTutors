/**
 * 58B — Authorized cleanup of the SHARED demo/test Supabase project only.
 *
 * Requires:
 *   CONFIRM=58B-DEMO-CLEANUP
 *   NEXT_PUBLIC_SUPABASE_URL must be the 58A demo project
 *
 * Does NOT touch Stripe/Daily/Resend/Twilio objects.
 * Does NOT delete the three sacred Auth UUIDs.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DEMO_REF = "giozoutlnbiqxlvixkho";
const CONFIRM = "58B-DEMO-CLEANUP";

const PROTECTED = {
  admin: { id: "ba9ce5a6-c8c4-403d-87ac-333710dee27b", email: "1800sumeet@gmail.com" },
  parent: { id: "a60dfd6f-3705-457d-8ccc-799fbd010099", email: "sksharma86@gmail.com" },
  guide: { id: "a99ec117-3f1d-4c37-8a88-19ff7a057edd", email: "halfoffwebhosting@gmail.com" },
};
const PROTECTED_IDS = new Set(Object.values(PROTECTED).map((p) => p.id));
const PARENT_STRIPE = "cus_V6qbjS0UCeC97j";
const NEW_ADMIN_EMAIL = "StudyHallAtHome@gmail.com";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg) {
  console.error(`58B ABORT: ${msg}`);
  process.exit(2);
}

if (process.env.CONFIRM !== CONFIRM) fail(`Set CONFIRM=${CONFIRM} to run this script.`);
if (!url.includes(DEMO_REF)) fail(`Refusing to run: URL is not the 58A demo project (${DEMO_REF}).`);
if (!serviceKey) fail("SUPABASE_SERVICE_ROLE_KEY missing.");
if (process.env.STRIPE_SECRET_KEY) {
  console.log("Note: STRIPE_SECRET_KEY is set in this environment; this script will not call Stripe.");
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function listAllUsers() {
  const users = [];
  for (let page = 1; page <= 80; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users;
}

async function count(table) {
  const { count: n, error } = await sb.from(table).select("*", { count: "exact", head: true });
  if (error) return { table, count: null, error: error.message };
  return { table, count: n };
}

async function deleteAll(table, pk = "id") {
  const { data, error } = await sb.from(table).delete().not(pk, "is", null).select("*");
  if (error) throw new Error(`deleteAll ${table}: ${error.message}`);
  return data?.length ?? 0;
}

function snapshotCounts(label, rows) {
  const obj = Object.fromEntries(rows.map((r) => [r.table, r.count]));
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(obj, null, 2));
  return obj;
}

const TABLES = [
  "profiles",
  "student_profiles",
  "tutor_profiles",
  "students",
  "bookings",
  "booking_children",
  "session_reports",
  "session_report_children",
  "session_recordings",
  "session_presence",
  "payments",
  "package_minute_ledger",
  "dollar_credit_ledger",
  "tutor_earnings",
  "refunds",
  "disputes",
  "email_deliveries",
  "parent_escalation_requests",
  "tutor_cancellation_requests",
  "tutor_availability",
  "tutor_availability_exceptions",
  "tutor_subjects",
  "financial_audit_log",
  "stripe_events",
  "subjects",
  "package_products",
  "compensation_currencies",
];

const beforeUsers = await listAllUsers();
const unexpected = beforeUsers.filter((u) => {
  if (PROTECTED_IDS.has(u.id)) return false;
  const email = (u.email || "").toLowerCase();
  const testish =
    email.endsWith("@example.com") ||
    email.endsWith("@example.test") ||
    email.endsWith("@africantutors.dev") ||
    email.startsWith("phase2-") ||
    email.startsWith("affordance-") ||
    email.startsWith("mgmt-ux-") ||
    email.startsWith("pr10c.") ||
    email.startsWith("demo.");
  return !testish;
});
if (unexpected.length) {
  fail(
    `Found ${unexpected.length} non-test disposable user(s); will not delete them blindly:\n` +
      unexpected.map((u) => `  ${u.id} ${u.email}`).join("\n"),
  );
}

for (const [role, spec] of Object.entries(PROTECTED)) {
  const u = beforeUsers.find((x) => x.id === spec.id);
  if (!u) fail(`Protected ${role} ${spec.id} is missing.`);
  const email = (u.email || "").toLowerCase();
  const allowed = new Set([spec.email.toLowerCase()]);
  if (role === "admin") allowed.add(NEW_ADMIN_EMAIL.toLowerCase());
  if (!allowed.has(email)) {
    fail(`Protected ${role} email mismatch: expected ${[...allowed].join(" or ")}, found ${u.email}`);
  }
}

const desired = beforeUsers.find((u) => (u.email || "").toLowerCase() === NEW_ADMIN_EMAIL.toLowerCase());
if (desired && desired.id !== PROTECTED.admin.id) {
  fail(`${NEW_ADMIN_EMAIL} already belongs to a different user ${desired.id}`);
}

const { data: parentProfile, error: parentErr } = await sb
  .from("profiles")
  .select("id, role, stripe_customer_id, display_name")
  .eq("id", PROTECTED.parent.id)
  .single();
if (parentErr) fail(parentErr.message);
if (parentProfile.role !== "student") fail(`Parent role is ${parentProfile.role}, expected student`);
if (parentProfile.stripe_customer_id !== PARENT_STRIPE) {
  fail(`Parent Stripe customer is ${parentProfile.stripe_customer_id}, expected ${PARENT_STRIPE}`);
}

const { data: guideProfile, error: guideErr } = await sb
  .from("tutor_profiles")
  .select("profile_id, status, approved_by, approved_at, comp_rate_cents_per_hour, comp_currency, timezone")
  .eq("profile_id", PROTECTED.guide.id)
  .single();
if (guideErr) fail(guideErr.message);
if (guideProfile.status !== "approved") fail(`Guide status is ${guideProfile.status}`);

const { data: adminProfile, error: adminErr } = await sb
  .from("profiles")
  .select("id, role")
  .eq("id", PROTECTED.admin.id)
  .single();
if (adminErr) fail(adminErr.message);
if (adminProfile.role !== "admin") fail(`Admin role is ${adminProfile.role}`);

const beforeCounts = snapshotCounts(
  "BEFORE",
  await Promise.all(TABLES.map(count)),
);

console.log(`Auth users before: ${beforeUsers.length}`);
console.log(`Disposable to delete: ${beforeUsers.length - 3}`);

const { error: retargetErr } = await sb
  .from("tutor_profiles")
  .update({ approved_by: PROTECTED.admin.id })
  .not("approved_by", "is", null)
  .neq("approved_by", PROTECTED.admin.id);
if (retargetErr) fail(`approved_by retarget: ${retargetErr.message}`);

const wipeOrder = [
  ["session_report_children", "report_id"],
  ["session_reports", "id"],
  ["session_recordings", "id"],
  ["session_presence", "booking_id"],
  ["disputes", "id"],
  ["tutor_cancellation_requests", "id"],
  ["parent_escalation_requests", "id"],
  ["email_deliveries", "id"],
  ["booking_children", "booking_id"],
  ["bookings", "id"],
  ["students", "id"],
  ["refunds", "id"],
  ["package_minute_ledger", "id"],
  ["dollar_credit_ledger", "id"],
  ["payments", "id"],
  ["tutor_earnings", "id"],
  ["financial_audit_log", "id"],
  ["stripe_events", "id"],
  ["tutor_availability", "id"],
  ["tutor_availability_exceptions", "id"],
];

const deleted = {};
for (const [table, pk] of wipeOrder) {
  deleted[table] = await deleteAll(table, pk);
  console.log(`wiped ${table}: ${deleted[table]}`);
}

const disposable = beforeUsers.filter((u) => !PROTECTED_IDS.has(u.id));
const authFailures = [];
for (const u of disposable) {
  const { error } = await sb.auth.admin.deleteUser(u.id);
  if (error) authFailures.push(`${u.id} ${u.email}: ${error.message}`);
}
if (authFailures.length) {
  fail(`Auth delete failed for ${authFailures.length} users:\n${authFailures.join("\n")}`);
}

const { data: parentAfter } = await sb
  .from("profiles")
  .select("id, role, stripe_customer_id")
  .eq("id", PROTECTED.parent.id)
  .single();
if (parentAfter.stripe_customer_id !== PARENT_STRIPE) {
  fail("Parent stripe_customer_id was changed; aborting email rename.");
}

if (!desired || desired.id === PROTECTED.admin.id) {
  const { data: renamed, error: renameErr } = await sb.auth.admin.updateUserById(PROTECTED.admin.id, {
    email: NEW_ADMIN_EMAIL,
    email_confirm: true,
  });
  if (renameErr) fail(`Admin email rename failed: ${renameErr.message}`);
  console.log(`Admin email now ${renamed.user.email} confirmed=${Boolean(renamed.user.email_confirmed_at)}`);
}

const afterUsers = await listAllUsers();
const afterCounts = snapshotCounts(
  "AFTER",
  await Promise.all(TABLES.map(count)),
);

const { data: guideAfter } = await sb
  .from("tutor_profiles")
  .select("*")
  .eq("profile_id", PROTECTED.guide.id)
  .single();
const { data: adminAfter } = await sb.auth.admin.getUserById(PROTECTED.admin.id);
const { data: parentAuth } = await sb.auth.admin.getUserById(PROTECTED.parent.id);
const { data: guideAuth } = await sb.auth.admin.getUserById(PROTECTED.guide.id);
const { data: parentMinutes } = await sb.rpc("get_customer_balances", { p_account: PROTECTED.parent.id });
const { data: freeUsed } = await sb.rpc("account_has_used_free_trial", { p_account: PROTECTED.parent.id });

const report = {
  generated_at: new Date().toISOString(),
  project_ref: DEMO_REF,
  stripe_touched: false,
  deleted_disposable_auth_users: disposable.length,
  auth_failures: authFailures,
  wiped: deleted,
  before: { auth_users: beforeUsers.length, tables: beforeCounts },
  after: {
    auth_users: afterUsers.map((u) => ({ id: u.id, email: u.email })),
    tables: afterCounts,
  },
  protected: {
    admin: { id: PROTECTED.admin.id, email: adminAfter.user?.email, role: adminProfile.role, confirmed: Boolean(adminAfter.user?.email_confirmed_at) },
    parent: {
      id: PROTECTED.parent.id,
      email: parentAuth.user?.email,
      stripe_customer_id: parentAfter.stripe_customer_id,
      balances: parentMinutes,
      free_trial_used: freeUsed,
    },
    guide: {
      id: PROTECTED.guide.id,
      email: guideAuth.user?.email,
      tutor: guideAfter,
    },
  },
  admin_alert_email_env: process.env.ADMIN_ALERT_EMAIL || null,
};

const outDir = "/opt/cursor/artifacts/58b-cleanup";
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/result.json`, JSON.stringify(report, null, 2));
writeFileSync("docs/58b-cleanup-result.json", JSON.stringify(report, null, 2));
console.log("\n58B cleanup finished. Auth users:", afterUsers.length);
console.log(afterUsers.map((u) => `${u.email} ${u.id}`).join("\n"));
if (afterUsers.length !== 3) fail(`Expected 3 auth users, found ${afterUsers.length}`);
