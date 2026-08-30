import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

function stripSqlComments(sql) {
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function identityTypes(argList) {
  return argList
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const noDefault = part.replace(/\s+default\s+[\s\S]+$/i, "").trim();
      const tokens = noDefault.split(/\s+/);
      return tokens[tokens.length - 1].toLowerCase();
    })
    .join(", ");
}

function extractCallArgs(callInner) {
  let depth = 0;
  let current = "";
  const args = [];
  for (const ch of callInner) {
    if (ch === "(") {
      depth += 1;
      current += ch;
      continue;
    }
    if (ch === ")") {
      depth -= 1;
      current += ch;
      continue;
    }
    if (ch === "," && depth === 0) {
      if (current.trim()) args.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function lastCreateIdentity(migrations, name) {
  let found = null;
  for (const file of migrations) {
    const body = stripSqlComments(read(`supabase/migrations/${file}`));
    for (const m of body.matchAll(new RegExp(`create or replace function public\\.${name}\\s*\\(([^)]*)\\)`, "gi"))) {
      found = `${name}(${identityTypes(m[1])})`;
    }
  }
  return found;
}

const migrations = readdirSync(new URL("../supabase/migrations", import.meta.url))
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .sort();
const prior = migrations.filter((f) => f < "0035_guide_emergency_coverage.sql");
const sql = read("supabase/migrations/0035_guide_emergency_coverage.sql");
const body = stripSqlComments(sql);

describe("0035 dependency and function-signature audit", () => {
  it("does not edit installed 0034", () => {
    const att34 = read("supabase/migrations/0034_guide_pre_session_confirmation.sql");
    assert.doesNotMatch(att34, /guide_open_coverage_offers|claim_open_coverage/);
    assert.ok(migrations.includes("0035_guide_emergency_coverage.sql"));
    assert.ok(!migrations.some((f) => f.startsWith("0036_")));
  });

  it("established helpers from 0001–0034 keep their identities", () => {
    assert.equal(lastCreateIdentity(prior, "is_admin"), "is_admin(uuid)");
    assert.equal(lastCreateIdentity(prior, "is_financial_actor"), "is_financial_actor()");
    assert.equal(
      lastCreateIdentity(prior, "log_admin_action"),
      "log_admin_action(text, text, uuid, jsonb, jsonb, text)",
    );
    assert.equal(
      lastCreateIdentity(prior, "tutor_is_available"),
      "tutor_is_available(uuid, text, timestamptz, timestamptz)",
    );
    assert.equal(
      lastCreateIdentity(prior, "open_guide_attendance_assignment"),
      "open_guide_attendance_assignment(uuid, text, timestamptz)",
    );
  });

  it("never invokes the nonexistent zero-argument is_admin()", () => {
    assert.doesNotMatch(body, /is_admin\s*\(\s*\)/);
    assert.equal((body.match(/is_admin\s*\(/g) || []).length, 3);
    assert.match(body, /using \(public\.is_admin\(auth\.uid\(\)\)\)/);
    assert.match(body, /with check \(public\.is_admin\(auth\.uid\(\)\)\)/);
    assert.match(body, /or public\.is_admin\(auth\.uid\(\)\)/);
  });

  it("RLS policies use own-row plus is_admin(auth.uid()), not a zero-arg admin check", () => {
    assert.match(body, /alter table public\.guide_open_coverage_offers enable row level security/);
    assert.match(body, /using \(tutor_id = auth\.uid\(\)\)/);
    assert.match(body, /using \(public\.is_admin\(auth\.uid\(\)\)\)/);
    assert.match(body, /with check \(public\.is_admin\(auth\.uid\(\)\)\)/);
    assert.doesNotMatch(body, /using \(public\.is_admin\(\s*\)\)/);
  });

  it("authorization matches the 0001/0034 is_admin(uuid) pattern and does not weaken it", () => {
    const att34 = read("supabase/migrations/0034_guide_pre_session_confirmation.sql");
    assert.match(att34, /public\.is_admin\(auth\.uid\(\)\)/);
    assert.match(body, /public\.is_admin\(auth\.uid\(\)\)/);
    assert.match(body, /if not public\.is_financial_actor\(\)/);
    assert.doesNotMatch(body, /using \(true\)|with check \(true\)/);
  });

  it("CREATE identities match GRANT/REVOKE identities", () => {
    const created = new Map();
    for (const m of body.matchAll(/create or replace function public\.([a-z0-9_]+)\s*\(([^)]*)\)/gi)) {
      created.set(`${m[1]}(${identityTypes(m[2])})`, true);
    }
    assert.equal(created.get("open_guide_attendance_assignment(uuid, text, timestamptz)"), true);
    assert.equal(created.get("list_emergency_coverage_candidates(uuid)"), true);
    assert.equal(created.get("open_emergency_coverage_search(uuid, uuid)"), true);
    assert.equal(created.get("close_open_coverage_offers(uuid, text)"), true);
    assert.equal(created.get("claim_open_coverage(uuid)"), true);
    assert.equal(created.get("sync_open_coverage_offers()"), true);
    assert.equal(created.has("open_guide_attendance_assignment(uuid, text)"), false);

    const stale = [];
    for (const m of body.matchAll(/(?:revoke all|grant execute) on function public\.([a-z0-9_]+)\s*\(([^)]*)\)/gi)) {
      const ident = `${m[1]}(${identityTypes(m[2])})`;
      if (!created.has(ident)) stale.push(ident);
    }
    assert.deepEqual(stale, []);
  });

  it("helper invocations match established 0001–0034 signatures", () => {
    const logs = [...sql.matchAll(/perform public\.log_admin_action\s*\(/g)];
    assert.equal(logs.length, 3);
    assert.match(
      body,
      /log_admin_action\(\s*case when v_status = 'missed'[\s\S]+?'guide_attendance_assignments',\s*v_id,\s*null,/,
    );
    assert.match(body, /log_admin_action\(\s*'emergency_coverage_search_opened',\s*'bookings',\s*p_booking,\s*null,/);
    assert.match(
      body,
      /log_admin_action\(\s*'emergency_coverage_claimed',\s*'bookings',\s*p_booking,/,
    );

    const avail = [...body.matchAll(/public\.tutor_is_available\s*\(/g)];
    assert.ok(avail.length >= 2);
    for (const m of avail) {
      const start = m.index + m[0].length;
      let depth = 1;
      let i = start;
      while (i < body.length && depth > 0) {
        if (body[i] === "(") depth += 1;
        else if (body[i] === ")") depth -= 1;
        i += 1;
      }
      const inner = body.slice(start, i - 1);
      assert.equal(extractCallArgs(inner).length, 4, inner);
    }

    const financial = [...body.matchAll(/public\.is_financial_actor\s*\(([^)]*)\)/g)];
    assert.ok(financial.length >= 2);
    for (const m of financial) {
      assert.equal(m[1].trim(), "");
    }

    const candidates = [...body.matchAll(/public\.list_emergency_coverage_candidates\s*\(([^)]+)\)/g)];
    assert.ok(candidates.length >= 1);
    for (const m of candidates) {
      if (/p_booking uuid/.test(m[1])) continue;
      assert.equal(m[1].split(",").filter(Boolean).length, 1);
    }
  });

  it("is idempotent for a full SQL Editor rerun after a partial apply", () => {
    assert.doesNotMatch(sql, /^\s*begin\s*;/im);
    assert.doesNotMatch(sql, /^\s*commit\s*;/im);
    assert.match(sql, /drop constraint if exists guide_attendance_assignments_source_check/);
    assert.match(sql, /create table if not exists public\.guide_open_coverage_offers/);
    assert.match(sql, /create index if not exists guide_open_coverage_offers_booking_idx/);
    assert.match(sql, /drop policy if exists guide_open_coverage_offers_select_own/);
    assert.match(sql, /drop policy if exists guide_open_coverage_offers_admin_all/);
    assert.match(sql, /create or replace function public\.open_guide_attendance_assignment/);
    assert.match(sql, /create or replace function public\.list_emergency_coverage_candidates/);
    assert.match(sql, /create or replace function public\.open_emergency_coverage_search/);
    assert.match(sql, /create or replace function public\.close_open_coverage_offers/);
    assert.match(sql, /create or replace function public\.claim_open_coverage/);
    assert.match(sql, /create or replace function public\.sync_open_coverage_offers/);
    assert.match(sql, /drop trigger if exists bookings_open_coverage_aiu/);
  });
});
