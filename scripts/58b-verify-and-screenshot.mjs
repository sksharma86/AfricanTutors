/**
 * 58B — Live count verification + clean-baseline portal screenshots.
 * Uses Auth Admin generateLink (does not change passwords).
 * After parent Home loads, removes any welcome email_deliveries created by notifyWelcome.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { collectNeedsAttention } from "../src/lib/management-ops.mjs";

const DEMO_REF = "giozoutlnbiqxlvixkho";
const ORIGIN = process.env.VERIFY_ORIGIN || "http://127.0.0.1:3456";
const OUT = "/opt/cursor/artifacts/58b-cleanup";
const PROTECTED = {
  admin: "ba9ce5a6-c8c4-403d-87ac-333710dee27b",
  parent: "a60dfd6f-3705-457d-8ccc-799fbd010099",
  guide: "a99ec117-3f1d-4c37-8a88-19ff7a057edd",
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url.includes(DEMO_REF)) {
  console.error("Refusing: not the 58A demo project");
  process.exit(2);
}
const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

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

async function count(table) {
  const { count: n, error } = await sb.from(table).select("*", { count: "exact", head: true });
  if (error) return { table, count: null, error: error.message };
  return { table, count: n };
}

async function listUsers() {
  const users = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    users.push(...(data?.users ?? []));
    if ((data?.users ?? []).length < 200) break;
  }
  return users;
}

async function snapshot(label) {
  const users = await listUsers();
  const tables = Object.fromEntries((await Promise.all(TABLES.map(count))).map((r) => [r.table, r.count]));
  const { data: profiles } = await sb.from("profiles").select("id, role, display_name, stripe_customer_id");
  const { data: tutors } = await sb.from("tutor_profiles").select("profile_id, status, approved_by, timezone, comp_rate_cents_per_hour, comp_currency");
  const { data: pending } = await sb.from("tutor_profiles").select("profile_id").eq("status", "pending");
  const { data: balances } = await sb.rpc("get_customer_balances", { p_account: PROTECTED.parent });
  const { data: freeUsed } = await sb.rpc("account_has_used_free_trial", { p_account: PROTECTED.parent });
  const attention = collectNeedsAttention({
    bookings: [],
    presenceByBooking: {},
    cancelRequests: [],
    escalations: [],
    emailFailures: [],
    recordingFailures: [],
    disputes: [],
    missingReports: [],
    pendingApplicants: pending ?? [],
  });
  const out = {
    label,
    at: new Date().toISOString(),
    auth_users: users.map((u) => ({ id: u.id, email: u.email })),
    auth_count: users.length,
    tables,
    profiles,
    tutors,
    pending_applicants: pending?.length ?? 0,
    parent_balances: balances,
    parent_free_trial_used: freeUsed,
    parent_stripe: profiles?.find((p) => p.id === PROTECTED.parent)?.stripe_customer_id ?? null,
    needs_attention: attention,
    admin_alert_email_env: process.env.ADMIN_ALERT_EMAIL || null,
  };
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify({ auth_count: out.auth_count, tables, pending: out.pending_applicants, balances, freeUsed, attention: attention.length }, null, 2));
  return out;
}

async function login(page, email) {
  const { data, error } = await sb.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink ${email}: ${error.message}`);
  const hash = data?.properties?.hashed_token;
  if (!hash) throw new Error(`No hashed_token for ${email}`);
  await page.goto(`${ORIGIN}/auth/callback?token_hash=${encodeURIComponent(hash)}&type=magiclink`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(800);
}

async function shot(page, path, name) {
  await page.goto(`${ORIGIN}${path}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(700);
  const file = `${OUT}/${name}`;
  await page.screenshot({ path: file, fullPage: false });
  console.log("shot", name, "url=", page.url());
  return file;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const beforeUi = await snapshot("PRE_UI");

  const { chromium } = await import("/tmp/pw/node_modules/playwright-core/index.mjs");
  const browser = await chromium.launch({
    executablePath: "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await login(page, "StudyHallAtHome@gmail.com");
  const adminHome = await shot(page, "/dashboard/admin", "01-management-home.png");
  const adminHalls = await shot(page, "/dashboard/admin/study-halls", "02-management-study-halls.png");
  const adminGuides = await shot(page, "/dashboard/admin/guides", "03-management-guides.png");
  const adminAttn = await shot(page, "/dashboard/admin/study-halls?view=attention", "04-management-needs-attention.png");
  const adminFin = await shot(page, "/dashboard/admin/finance", "05-management-finance.png");

  await context.clearCookies();
  await login(page, "sksharma86@gmail.com");
  const parentHome = await shot(page, "/dashboard/student", "06-parent-home.png");
  const parentHalls = await shot(page, "/dashboard/student/study-halls", "07-parent-study-halls.png");
  const parentReports = await shot(page, "/dashboard/student/reports", "08-parent-reports.png");
  const parentHours = await shot(page, "/dashboard/student/packages", "09-parent-hours.png");
  const parentBook = await shot(page, "/dashboard/student/book", "14-parent-add-child-path.png");

  await context.clearCookies();
  await login(page, "halfoffwebhosting@gmail.com");
  const guideHome = await shot(page, "/dashboard/tutor", "10-guide-home.png");
  const guideHalls = await shot(page, "/dashboard/tutor/study-halls", "11-guide-study-halls.png");
  const guideEarn = await shot(page, "/dashboard/tutor/earnings", "12-guide-earnings.png");
  const guideAvail = await shot(page, "/dashboard/tutor/availability", "13-guide-availability.png");

  await browser.close();

  const { data: welcomeRows } = await sb
    .from("email_deliveries")
    .select("id, idempotency_key, notification_type, status")
    .or(`idempotency_key.eq.welcome:${PROTECTED.parent},notification_type.eq.welcome`);
  const welcomeDeleted = [];
  if (welcomeRows?.length) {
    const ids = welcomeRows.map((r) => r.id);
    const { error } = await sb.from("email_deliveries").delete().in("id", ids);
    if (error) throw new Error(`welcome cleanup: ${error.message}`);
    welcomeDeleted.push(...welcomeRows);
  }

  const afterUi = await snapshot("POST_UI");
  const report = {
    origin: ORIGIN,
    screenshots: {
      adminHome,
      adminHalls,
      adminGuides,
      adminAttn,
      adminFin,
      parentHome,
      parentHalls,
      parentReports,
      parentHours,
      parentBook,
      guideHome,
      guideHalls,
      guideEarn,
      guideAvail,
    },
    welcome_created_then_removed: welcomeDeleted,
    before_ui: beforeUi,
    after_ui: afterUi,
  };
  writeFileSync(`${OUT}/portal-verify.json`, JSON.stringify(report, null, 2));
  writeFileSync("docs/58b-portal-verify.json", JSON.stringify(report, null, 2));
  if (afterUi.auth_count !== 3) {
    console.error("Auth count is not 3");
    process.exit(2);
  }
  console.log("portal verify complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
