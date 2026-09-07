import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const m39 = read("supabase/migrations/0039_study_hall_365_security_hardening.sql");
const m38 = read("supabase/migrations/0038_one_hour_booking_engine.sql");
const wizard = read("src/components/booking/booking-wizard.tsx");
const membership = read("src/app/api/billing/membership/route.ts");
const stripeSync = read("src/lib/study-hall-365/stripe-sync.ts");
const service = read("src/lib/study-hall-365/service.ts");
const hours = read("src/app/dashboard/student/packages/page.tsx");

function stripSqlComments(sql) {
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("0039 Study Hall 365 security hardening — privileges", () => {
  it("is the next migration after 0038 and does not edit 0036–0038", () => {
    const names = readdirSync(new URL("../supabase/migrations", import.meta.url)).filter((f) => f.endsWith(".sql"));
    assert.ok(names.includes("0039_study_hall_365_security_hardening.sql"));
    assert.ok(names.includes("0038_one_hour_booking_engine.sql"));
    assert.doesNotMatch(read("supabase/migrations/0036_study_hall_365.sql"), /0039_/);
    assert.doesNotMatch(read("supabase/migrations/0037_study_hall_365_parent_privacy.sql"), /0039_/);
  });

  it("revokes all table rights from public, anon, and authenticated on both 365 tables", () => {
    const body = stripSqlComments(m39);
    for (const table of ["study_hall_365_subscriptions", "study_hall_365_day_usage"]) {
      assert.match(body, new RegExp(`revoke all on table public\\.${table} from public`));
      assert.match(body, new RegExp(`revoke all on table public\\.${table} from anon`));
      assert.match(body, new RegExp(`revoke all on table public\\.${table} from authenticated`));
    }
    assert.doesNotMatch(body, /grant (insert|update|delete|truncate|all) on table public\.study_hall_365_\w+ to (anon|authenticated|public)/i);
  });

  it("re-grants SELECT to authenticated and ALL to service_role only", () => {
    const body = stripSqlComments(m39);
    assert.match(body, /grant select on table public\.study_hall_365_subscriptions to authenticated/);
    assert.match(body, /grant select on table public\.study_hall_365_day_usage to authenticated/);
    assert.match(body, /grant all on table public\.study_hall_365_subscriptions to service_role/);
    assert.match(body, /grant all on table public\.study_hall_365_day_usage to service_role/);
    assert.doesNotMatch(body, /grant select on table public\.study_hall_365_\w+ to anon/);
  });

  it("does not weaken RLS or invent parent write policies", () => {
    assert.doesNotMatch(m39, /for insert to authenticated/);
    assert.doesNotMatch(m39, /drop policy if exists study_hall_365_sub_select_admin/);
    assert.doesNotMatch(m39, /disable row level security/);
  });
});

describe("0039 Study Hall 365 security hardening — booking_quote", () => {
  it("drops the ambiguous 3-arg wrapper and keeps the 4-arg execute grant", () => {
    const body = stripSqlComments(m39);
    assert.match(body, /drop function if exists public\.booking_quote\(uuid, integer, boolean\)/);
    assert.doesNotMatch(body, /create or replace function public\.booking_quote\(\s*p_account uuid,\s*p_duration integer,\s*p_is_free_trial boolean\s*\)/);
    assert.match(
      body,
      /grant execute on function public\.booking_quote\(uuid, integer, boolean, timestamp with time zone\)/,
    );
    assert.match(m38, /p_start timestamptz default null/);
  });

  it("does not rewrite booking_quote economics", () => {
    assert.doesNotMatch(m39, /session_list_price_cents|package_minute_ledger|study_hall_365_status_entitled/);
    assert.doesNotMatch(m39, /create or replace function public\.booking_quote/);
  });
});

describe("0039 callers stay on the intended surfaces", () => {
  it("live wizard always sends p_start on booking_quote", () => {
    assert.match(wizard, /rpc\("booking_quote"/);
    assert.match(wizard, /p_start:\s*selectedSlot/);
  });

  it("parent Hours and GET membership use RPCs, not raw table selects", () => {
    assert.match(hours, /get_study_hall_365_membership/);
    assert.doesNotMatch(hours, /from\("study_hall_365_subscriptions"\)/);
    assert.match(membership, /get_study_hall_365_membership/);
    assert.match(service, /get_study_hall_365_entitlement/);
    assert.match(service, /get_study_hall_365_membership/);
  });

  it("raw subscription row reads are service-role only", () => {
    assert.match(membership, /getServiceSupabase/);
    assert.match(membership, /from\("study_hall_365_subscriptions"\)/);
    assert.match(stripeSync, /from\("study_hall_365_subscriptions"\)/);
    assert.match(stripeSync, /upsert_study_hall_365_subscription/);
  });
});
