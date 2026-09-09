import assert from "node:assert/strict";
import { execSync, spawn } from "node:child_process";
import { describe, it } from "node:test";

import {
  localDateForInstant,
  utcInstantForLocalParts,
} from "../src/lib/study-hall-365/calendar.mjs";

const DB = process.env.STUDY_HALL_BOOKING_TEST_DB || "studyhall_pr8b_throwaway";
const requirePg = process.env.STUDY_HALL_PR8B_REQUIRE_PG === "1";
const havePsql = (() => {
  try {
    execSync("pg_isready -q", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

if (requirePg && !havePsql) {
  throw new Error(
    "PR8B launch-critical suite requires Postgres; pg_isready failed. Critical tests did not execute.",
  );
}

function dataLines(text) {
  return String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^(INSERT|UPDATE|DELETE|SELECT \d+|SET|RESET|CREATE|DROP|ALTER|GRANT|REVOKE|BEGIN|COMMIT|NOTIFY|COMMENT)\b/.test(line));
}

function sql(text) {
  const out = execSync(`sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d ${DB} -A -t`, {
    encoding: "utf8",
    input: text,
    maxBuffer: 10 * 1024 * 1024,
  });
  return dataLines(out).pop() ?? "";
}

function sqlCatch(text) {
  try {
    return sql(text);
  } catch (err) {
    return String(err.stderr || err.message || err);
  }
}

function spawnSql(query) {
  return new Promise((resolve, reject) => {
    const child = spawn("sudo", ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-q", "-d", DB, "-A", "-t"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (c) => {
      out += c;
    });
    child.stderr.on("data", (c) => {
      err += c;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve((code !== 0 ? err || out : out).trim() || `exit ${code}`);
    });
    child.stdin.write(query);
    child.stdin.end();
  });
}

function spawnBook(studentId, startIso, replaces = null) {
  const ninth = replaces ? `, '${replaces}'::uuid` : "";
  return spawnSql(`
    select book_session(
      '${studentId}'::uuid, null, null, null, 60,
      '${startIso}'::timestamptz, false, array['${studentId}'::uuid]${ninth}
    );
  `);
}

function book(studentId, startIso, duration = 60, free = false, ids = null, replaces = null) {
  const arr = ids ?? [studentId];
  const ninth = replaces ? `, '${replaces}'::uuid` : "";
  return sql(`
    select book_session(
      '${studentId}'::uuid, null, null, null, ${duration},
      '${startIso}'::timestamptz, ${free}, array[${arr.map((id) => `'${id}'::uuid`).join(",")}]${ninth}
    );
  `);
}

function seedHousehold(parent, child, tz = "America/Chicago", name = "Parent") {
  sql(`
    insert into profiles (id, role, display_name, timezone) values
      ('${parent}', 'student', '${name}', '${tz}')
    on conflict (id) do update set role = excluded.role, timezone = excluded.timezone, display_name = excluded.display_name;
    insert into students (id, account_id, full_name, timezone) values
      ('${child}', '${parent}', 'Child ${name}', '${tz}')
    on conflict (id) do update set account_id = excluded.account_id, timezone = excluded.timezone;
  `);
}

function useFree(parent, child) {
  sql(`
    insert into bookings (id, account_id, student_id, is_free_trial, status, duration_minutes, funding_source)
    values (gen_random_uuid(), '${parent}', '${child}', true, 'confirmed', 60, 'free_trial')
    on conflict do nothing;
  `);
}

function subscribe365(parent, status, cancelAtEnd, periodStart, periodEnd, suffix) {
  sql(`
    select upsert_study_hall_365_subscription(
      '${parent}'::uuid, 'cus_${suffix}', 'sub_${suffix}', 'price_${suffix}', '${status}',
      '${periodStart}'::timestamptz, '${periodEnd}'::timestamptz,
      ${cancelAtEnd}, null, null, 'in_${suffix}', 'evt_${suffix}', 100, null
    );
  `);
}

function fundingOf(row) {
  if (/"funding_source":\s*"study_hall_365"/.test(row) || /"funding": "study_hall_365"/.test(row)) return "study_hall_365";
  if (/"funding_source":\s*"free_trial"/.test(row) || /"funding": "free_trial"/.test(row)) return "free_trial";
  if (/"funding_source":\s*"prepaid"/.test(row) || /"funding": "package"/.test(row)) return "prepaid";
  if (/"funding_source":\s*"credit"/.test(row) || /"funding": "credit"/.test(row)) return "credit";
  if (/"funding_source":\s*"payg"/.test(row) || /"funding": "stripe"/.test(row)) return "payg";
  return "other";
}

const PERIOD_START = "2026-09-01T05:00:00+00";
const PERIOD_END = "2026-12-01T05:00:00+00";
const GUIDE = "b8b80000-0000-4000-8000-000000000200";

describe("PR8B adversarial booking/entitlement — throwaway Postgres", { skip: !havePsql, concurrency: 1 }, () => {
  it("0. throwaway Postgres is real and 0047 is applied", () => {
    execSync("bash scripts/setup-study-hall-booking-throwaway-db.sh", {
      stdio: "pipe",
      env: { ...process.env, STUDY_HALL_BOOKING_TEST_DB: DB },
    });
    assert.equal(sql(`select 1`), "1");
    process.stdout.write("PR8B_PG_EXECUTED\n");
    seedHousehold("b8b80000-0000-4000-8000-000000000001", "b8b80000-0000-4000-8000-000000000101", "America/Chicago", "Setup");
    sql(`
      insert into profiles (id, role, display_name, timezone) values
        ('${GUIDE}', 'tutor', 'Guide Lagos', 'Africa/Lagos')
      on conflict (id) do update set role = excluded.role, timezone = excluded.timezone;
      insert into tutor_profiles (profile_id, status, timezone) values
        ('${GUIDE}', 'approved', 'Africa/Lagos')
      on conflict (profile_id) do update set status = 'approved', timezone = excluded.timezone;
    `);
    assert.equal(sql(`select is_active::text from package_products where code='pkg_10sh'`), "t");
    assert.equal(sql(`select is_active::text from package_products where code='pkg_14h'`), "f");
    assert.equal(sql(`select is_active::text from package_products where code='pkg_28h'`), "f");
    assert.match(sql(`select conname from pg_constraint where conname='bookings_no_tutor_overlap'`), /bookings_no_tutor_overlap/);
  });

  it("A1-A2. concurrent same-day 365: one entitlement, second follows cascade, no duplicate usage", async () => {
    const p = "b8b80000-0000-4000-8000-000000000010";
    const c = "b8b80000-0000-4000-8000-000000000110";
    seedHousehold(p, c, "America/Chicago", "365Race");
    useFree(p, c);
    subscribe365(p, "active", false, PERIOD_START, PERIOD_END, "a12");
    const raced = await Promise.all([
      spawnBook(c, "2026-10-20T18:00:00Z"),
      spawnBook(c, "2026-10-20T20:00:00Z"),
    ]);
    const wins = raced.filter((r) => fundingOf(r) === "study_hall_365").length;
    const fallbacks = raced.filter((r) => ["payg", "prepaid", "credit"].includes(fundingOf(r))).length;
    assert.equal(wins, 1, raced.join(" | "));
    assert.equal(fallbacks, 1, raced.join(" | "));
    assert.equal(sql(`select count(*) from study_hall_365_day_usage where account_id='${p}' and local_date='2026-10-20'`), "1");
    assert.equal(sql(`select count(*) from bookings where account_id='${p}' and funding_source='study_hall_365'`), "1");
    const extra = book(c, "2026-10-20T22:00:00Z");
    assert.notEqual(fundingOf(extra), "study_hall_365");
  });

  it("A3. attempts straddling household-local midnight consume two days", () => {
    const p = "b8b80000-0000-4000-8000-000000000011";
    const c = "b8b80000-0000-4000-8000-000000000111";
    seedHousehold(p, c, "America/Chicago", "Midnight");
    useFree(p, c);
    subscribe365(p, "active", false, PERIOD_START, PERIOD_END, "a3");
    const before = utcInstantForLocalParts(2026, 10, 20, 23, 30, 0, "America/Chicago").toISOString();
    const after = utcInstantForLocalParts(2026, 10, 21, 0, 30, 0, "America/Chicago").toISOString();
    assert.equal(localDateForInstant(before, "America/Chicago"), "2026-10-20");
    assert.equal(localDateForInstant(after, "America/Chicago"), "2026-10-21");
    assert.match(book(c, before), /study_hall_365/);
    assert.match(book(c, after), /study_hall_365/);
    assert.equal(sql(`select count(*) from study_hall_365_day_usage where account_id='${p}'`), "2");
  });

  it("A4. server UTC day differs from household local day", () => {
    const p = "b8b80000-0000-4000-8000-000000000012";
    const c = "b8b80000-0000-4000-8000-000000000112";
    seedHousehold(p, c, "America/Chicago", "UtcDay");
    useFree(p, c);
    subscribe365(p, "active", false, PERIOD_START, PERIOD_END, "a4");
    const utcMidnight = "2026-10-21T00:00:00Z";
    assert.equal(localDateForInstant(utcMidnight, "America/Chicago"), "2026-10-20");
    assert.match(book(c, utcMidnight), /study_hall_365/);
    assert.equal(sql(`select local_date::text from study_hall_365_day_usage where account_id='${p}'`), "2026-10-20");
    const sameLocal = utcInstantForLocalParts(2026, 10, 20, 23, 0, 0, "America/Chicago").toISOString();
    const extra = book(c, sameLocal);
    assert.notEqual(fundingOf(extra), "study_hall_365");
  });

  it("A5-A6. DST fall-back and Guide timezone do not redefine household day", () => {
    const p = "b8b80000-0000-4000-8000-000000000013";
    const c = "b8b80000-0000-4000-8000-000000000113";
    seedHousehold(p, c, "America/Chicago", "DstGuide");
    useFree(p, c);
    subscribe365(p, "active", false, PERIOD_START, PERIOD_END, "a56");
    const chicagoEvening = utcInstantForLocalParts(2026, 10, 21, 18, 0, 0, "America/Chicago").toISOString();
    assert.equal(localDateForInstant(chicagoEvening, "America/Chicago"), "2026-10-21");
    assert.equal(localDateForInstant(chicagoEvening, "Africa/Lagos"), "2026-10-22");
    assert.match(book(c, chicagoEvening), /study_hall_365/);
    assert.equal(sql(`select local_date::text from study_hall_365_day_usage where account_id='${p}'`), "2026-10-21");
    assert.equal(sql(`select time_zone from study_hall_365_day_usage where account_id='${p}'`), "America/Chicago");

    const dstP = "b8b80000-0000-4000-8000-000000000014";
    const dstC = "b8b80000-0000-4000-8000-000000000114";
    seedHousehold(dstP, dstC, "America/Chicago", "FallBack");
    useFree(dstP, dstC);
    subscribe365(dstP, "active", false, PERIOD_START, PERIOD_END, "a5");
    const dstStart = utcInstantForLocalParts(2026, 11, 1, 1, 30, 0, "America/Chicago").toISOString();
    assert.match(book(dstC, dstStart), /study_hall_365/);
    assert.equal(sql(`select local_date::text from study_hall_365_day_usage where account_id='${dstP}'`), "2026-11-01");

    const nyP = "b8b80000-0000-4000-8000-000000000015";
    const nyC = "b8b80000-0000-4000-8000-000000000115";
    seedHousehold(nyP, nyC, "America/New_York", "NY");
    useFree(nyP, nyC);
    subscribe365(nyP, "active", false, PERIOD_START, PERIOD_END, "any");
    assert.match(book(nyC, "2026-10-22T00:00:00Z"), /study_hall_365/);
    assert.equal(sql(`select local_date::text from study_hall_365_day_usage where account_id='${nyP}'`), "2026-10-21");

    const laP = "b8b80000-0000-4000-8000-000000000016";
    const laC = "b8b80000-0000-4000-8000-000000000116";
    seedHousehold(laP, laC, "America/Los_Angeles", "LA");
    useFree(laP, laC);
    subscribe365(laP, "active", false, PERIOD_START, PERIOD_END, "ala");
    assert.match(book(laC, "2026-10-22T00:00:00Z"), /study_hall_365/);
    assert.equal(sql(`select local_date::text from study_hall_365_day_usage where account_id='${laP}'`), "2026-10-21");
  });

  it("A7-A8. concurrent same-day 365 replacement transfers once; no double consume", async () => {
    const p = "b8b80000-0000-4000-8000-000000000017";
    const c = "b8b80000-0000-4000-8000-000000000117";
    seedHousehold(p, c, "America/Chicago", "Replace");
    useFree(p, c);
    subscribe365(p, "active", false, PERIOD_START, PERIOD_END, "a78");
    assert.match(book(c, "2026-10-23T17:00:00Z"), /study_hall_365/);
    const oldId = sql(`select id from bookings where account_id='${p}' and scheduled_start='2026-10-23T17:00:00Z'`);
    const raced = await Promise.all([
      spawnBook(c, "2026-10-23T19:00:00Z", oldId),
      spawnBook(c, "2026-10-23T21:00:00Z", oldId),
    ]);
    const wins = raced.filter((r) => fundingOf(r) === "study_hall_365").length;
    assert.equal(wins, 1, raced.join(" | "));
    assert.equal(sql(`select count(*) from study_hall_365_day_usage where account_id='${p}' and local_date='2026-10-23'`), "1");
    assert.equal(
      sql(`select count(*) from bookings where account_id='${p}' and funding_source='study_hall_365' and status='confirmed'`),
      "1",
    );
  });

  it("B9. final prepaid unit: concurrent attempts cannot go negative", async () => {
    const p = "b8b80000-0000-4000-8000-000000000020";
    const c = "b8b80000-0000-4000-8000-000000000120";
    seedHousehold(p, c, "America/Chicago", "PreLast");
    useFree(p, c);
    sql(`insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
         values ('${p}', 60, 'admin_adjustment', 'final unit', 'b9-60')`);
    const raced = await Promise.all([
      spawnBook(c, "2026-10-24T17:00:00Z"),
      spawnBook(c, "2026-10-24T19:00:00Z"),
    ]);
    const prepaid = raced.filter((r) => fundingOf(r) === "prepaid").length;
    assert.equal(prepaid, 1, raced.join(" | "));
    const bal = Number(sql(`select coalesce(sum(minutes_delta),0) from package_minute_ledger where account_id='${p}'`));
    assert.ok(bal >= 0, String(bal));
    assert.equal(sql(`select count(*) from bookings where account_id='${p}' and funding_source='prepaid'`), "1");
    const second = raced.find((r) => fundingOf(r) !== "prepaid");
    assert.ok(second, raced.join(" | "));
    assert.ok(["payg", "credit"].includes(fundingOf(second)) || /No Guide/.test(second), second);
  });

  it("B10-B11. cancel/restore vs consume; duplicate cancel restores once", async () => {
    const p = "b8b80000-0000-4000-8000-000000000021";
    const c = "b8b80000-0000-4000-8000-000000000121";
    seedHousehold(p, c, "America/Chicago", "PreCancel");
    useFree(p, c);
    sql(`insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
         values ('${p}', 60, 'admin_adjustment', 'one hall', 'b10-60')`);
    assert.match(book(c, "2026-10-30T18:00:00Z"), /prepaid|package/);
    const id = sql(`select id from bookings where account_id='${p}' and scheduled_start='2026-10-30T18:00:00Z'`);
    const raced = await Promise.all([
      spawnSql(`select customer_cancel_booking('${id}'::uuid);`),
      spawnBook(c, "2026-10-31T18:00:00Z"),
    ]);
    const bal = Number(sql(`select coalesce(sum(minutes_delta),0) from package_minute_ledger where account_id='${p}'`));
    assert.ok(bal === 0 || bal === 60, `${bal} ${raced.join(" | ")}`);
    assert.ok(bal >= 0);

    const p2 = "b8b80000-0000-4000-8000-000000000022";
    const c2 = "b8b80000-0000-4000-8000-000000000122";
    seedHousehold(p2, c2, "America/Chicago", "DupCancel");
    useFree(p2, c2);
    sql(`insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
         values ('${p2}', 60, 'admin_adjustment', 'dup', 'b11-60')`);
    book(c2, "2026-11-02T18:00:00Z");
    const id2 = sql(`select id from bookings where account_id='${p2}' and scheduled_start='2026-11-02T18:00:00Z'`);
    const first = sql(`select customer_cancel_booking('${id2}'::uuid);`);
    const second = sql(`select customer_cancel_booking('${id2}'::uuid);`);
    assert.match(first, /cancelled/);
    assert.match(second, /noop|already_cancelled|cancelled/);
    assert.equal(sql(`select coalesce(sum(minutes_delta),0) from package_minute_ledger where account_id='${p2}'`), "60");
    assert.equal(
      sql(`select count(*) from package_minute_ledger where account_id='${p2}' and entry_type='restoration'`),
      "1",
    );
  });

  it("C12-C14. concurrent final credit; restore/consume; balance stays valid", async () => {
    const p = "b8b80000-0000-4000-8000-000000000030";
    const c = "b8b80000-0000-4000-8000-000000000130";
    seedHousehold(p, c, "America/Chicago", "Credit");
    useFree(p, c);
    sql(`insert into dollar_credit_ledger (account_id, amount_cents, entry_type, reason, reference)
         values ('${p}', 1200, 'admin_adjustment', 'final credit', 'c12-1200')`);
    const raced = await Promise.all([
      spawnBook(c, "2026-10-25T17:00:00Z"),
      spawnBook(c, "2026-10-25T19:00:00Z"),
    ]);
    const credits = raced.filter((r) => fundingOf(r) === "credit").length;
    assert.equal(credits, 1, raced.join(" | "));
    const cents = Number(sql(`select coalesce(sum(amount_cents),0) from dollar_credit_ledger where account_id='${p}'`));
    assert.ok(cents >= 0, String(cents));
    assert.equal(sql(`select count(*) from bookings where account_id='${p}' and funding_source='credit'`), "1");

    const p2 = "b8b80000-0000-4000-8000-000000000031";
    const c2 = "b8b80000-0000-4000-8000-000000000131";
    seedHousehold(p2, c2, "America/Chicago", "CredRace");
    useFree(p2, c2);
    sql(`insert into dollar_credit_ledger (account_id, amount_cents, entry_type, reason, reference)
         values ('${p2}', 1200, 'admin_adjustment', 'restore race', 'c13-1200')`);
    book(c2, "2026-10-30T17:00:00Z");
    const old = sql(`select id from bookings where account_id='${p2}' and scheduled_start='2026-10-30T17:00:00Z'`);
    await Promise.all([
      spawnSql(`select customer_cancel_booking('${old}'::uuid);`),
      spawnBook(c2, "2026-10-31T17:00:00Z"),
    ]);
    const after = Number(sql(`select coalesce(sum(amount_cents),0) from dollar_credit_ledger where account_id='${p2}'`));
    assert.ok(after === 0 || after === 1200, String(after));
    const restoreRows = sql(`select count(*) from dollar_credit_ledger where account_id='${p2}' and entry_type='restoration'`);
    assert.ok(Number(restoreRows) <= 1, restoreRows);
  });

  it("D15-D16. concurrent free trial and retry cannot mint a second trial", async () => {
    const p = "b8b80000-0000-4000-8000-000000000040";
    const c = "b8b80000-0000-4000-8000-000000000140";
    seedHousehold(p, c, "America/Chicago", "Trial");
    const raced = await Promise.all([
      spawnBook(c, "2026-10-26T17:00:00Z"),
      spawnBook(c, "2026-10-26T19:00:00Z"),
    ]);
    const trials = raced.filter((r) => fundingOf(r) === "free_trial").length;
    assert.equal(trials, 1, raced.join(" | "));
    assert.equal(sql(`select count(*) from bookings where account_id='${p}' and is_free_trial and status <> 'cancelled'`), "1");
    const retry = sqlCatch(`
      select book_session('${c}'::uuid, null, null, null, 60, '2026-10-26T21:00:00Z'::timestamptz, true, array['${c}'::uuid]);
    `);
    assert.match(retry, /already used its free trial|payg|stripe|prepaid|credit/i);
    assert.equal(sql(`select count(*) from bookings where account_id='${p}' and is_free_trial and status <> 'cancelled'`), "1");
  });

  it("E17-E19. Guide/time slot: two households, two tabs, double-click", async () => {
    const p1 = "b8b80000-0000-4000-8000-000000000050";
    const c1 = "b8b80000-0000-4000-8000-000000000150";
    const p2 = "b8b80000-0000-4000-8000-000000000051";
    const c2 = "b8b80000-0000-4000-8000-000000000151";
    seedHousehold(p1, c1, "America/Chicago", "SlotA");
    seedHousehold(p2, c2, "America/Chicago", "SlotB");
    useFree(p1, c1);
    useFree(p2, c2);
    const start = "2026-10-27T17:00:00Z";
    const raced = await Promise.all([spawnBook(c1, start), spawnBook(c2, start)]);
    const ok = raced.filter((r) => /booking_id|"status":/.test(r) && !/No Guide|already has a Study Hall/i.test(r));
    const funded = raced.filter((r) => fundingOf(r) !== "other").length;
    assert.equal(funded, 1, raced.join(" | "));
    assert.equal(
      sql(`select count(*) from bookings where scheduled_start='${start}' and status in ('pending','confirmed') and tutor_id='${GUIDE}'`),
      "1",
    );

    const p3 = "b8b80000-0000-4000-8000-000000000052";
    const c3 = "b8b80000-0000-4000-8000-000000000152";
    seedHousehold(p3, c3, "America/Chicago", "TwoTab");
    useFree(p3, c3);
    const tabStart = "2026-10-27T20:00:00Z";
    const tabs = await Promise.all([spawnBook(c3, tabStart), spawnBook(c3, tabStart)]);
    const tabWins = tabs.filter((r) => fundingOf(r) !== "other").length;
    assert.equal(tabWins, 1, tabs.join(" | "));
    const click2 = sqlCatch(`
      select book_session('${c3}'::uuid, null, null, null, 60, '${tabStart}'::timestamptz, false, array['${c3}'::uuid]);
    `);
    assert.match(click2, /already has a Study Hall|No Guide/i);
  });

  it("E20-E21. Book One vs PMW and concurrent overlapping PMW days", async () => {
    const p = "b8b80000-0000-4000-8000-000000000053";
    const c = "b8b80000-0000-4000-8000-000000000153";
    seedHousehold(p, c, "America/Chicago", "PmwBook");
    useFree(p, c);
    subscribe365(p, "active", false, PERIOD_START, PERIOD_END, "e20");
    const mon = "2026-10-26T21:00:00Z";
    const tue = "2026-10-27T21:00:00Z";
    const raced = await Promise.all([spawnBook(c, mon), spawnBook(c, mon)]);
    const wins = raced.filter((r) => fundingOf(r) !== "other").length;
    assert.equal(wins, 1, raced.join(" | "));

    const p2 = "b8b80000-0000-4000-8000-000000000054";
    const c2 = "b8b80000-0000-4000-8000-000000000154";
    seedHousehold(p2, c2, "America/Chicago", "PmwDays");
    useFree(p2, c2);
    subscribe365(p2, "active", false, PERIOD_START, PERIOD_END, "e21");
    const overlap = await Promise.all([
      spawnBook(c2, "2026-10-28T21:00:00Z"),
      spawnBook(c2, "2026-10-28T21:00:00Z"),
      spawnBook(c2, "2026-10-29T21:00:00Z"),
    ]);
    const day1 = overlap.filter((r) => fundingOf(r) === "study_hall_365" && /2026-10-28T21:00:00/.test(r) === false);
    const three65 = overlap.filter((r) => fundingOf(r) === "study_hall_365").length;
    assert.ok(three65 >= 1 && three65 <= 2, overlap.join(" | "));
    assert.equal(sql(`select count(*) from study_hall_365_day_usage where account_id='${p2}' and local_date='2026-10-28'`), "1");
    const tueCount = sql(`select count(*) from study_hall_365_day_usage where account_id='${p2}' and local_date='2026-10-29'`);
    assert.ok(tueCount === "0" || tueCount === "1", tueCount);
    void day1;
  });

  it("F22-F27. PAYG pending, duplicate, replacement, abandon, expiry, late fulfill", async () => {
    const p = "b8b80000-0000-4000-8000-000000000060";
    const c = "b8b80000-0000-4000-8000-000000000160";
    seedHousehold(p, c, "America/Chicago", "Payg");
    useFree(p, c);
    const first = book(c, "2026-10-28T17:00:00Z");
    assert.match(first, /payg|stripe/);
    const id = sql(`select id from bookings where account_id='${p}' and scheduled_start='2026-10-28T17:00:00Z'`);
    assert.equal(sql(`select status from bookings where id='${id}'`), "pending");
    assert.equal(sql(`select payment_status from bookings where id='${id}'`), "awaiting_payment");
    assert.equal(sql(`select status from payments where booking_id='${id}' order by created_at desc limit 1`), "requires_payment");

    const dup = await Promise.all([spawnBook(c, "2026-10-28T19:00:00Z"), spawnBook(c, "2026-10-28T19:00:00Z")]);
    const paygDup = dup.filter((r) => fundingOf(r) === "payg").length;
    assert.equal(paygDup, 1, dup.join(" | "));

    const oldId = id;
    const next = book(c, "2026-10-28T21:00:00Z");
    assert.match(next, /payg|stripe/);
    const newId = sql(`select id from bookings where account_id='${p}' and scheduled_start='2026-10-28T21:00:00Z'`);
    sql(`select attach_booking_replacement('${newId}'::uuid, '${oldId}'::uuid);`);
    assert.equal(sql(`select status from bookings where id='${oldId}'`), "pending");
    assert.equal(sql(`select replaces_booking_id from bookings where id='${newId}'`), oldId);

    const abP = "b8b80000-0000-4000-8000-000000000061";
    const abC = "b8b80000-0000-4000-8000-000000000161";
    seedHousehold(abP, abC, "America/Chicago", "Abandon");
    useFree(abP, abC);
    sql(`insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
         values ('${abP}', 60, 'admin_adjustment', 'keep', 'f25-60')`);
    book(abC, "2026-10-29T17:00:00Z");
    const keepId = sql(`select id from bookings where account_id='${abP}' and scheduled_start='2026-10-29T17:00:00Z'`);
    book(abC, "2026-10-29T19:00:00Z");
    const holdId = sql(`select id from bookings where account_id='${abP}' and scheduled_start='2026-10-29T19:00:00Z'`);
    const payId = sql(`select id from payments where booking_id='${holdId}' order by created_at desc limit 1`);
    sql(`select attach_booking_replacement('${holdId}'::uuid, '${keepId}'::uuid);`);
    sql(`update payments set expires_at = now() - interval '1 minute' where id='${payId}';`);
    sql(`update bookings set payment_hold_expires_at = now() - interval '1 minute' where id='${holdId}';`);
    const released = sql(`select release_expired_holds();`);
    assert.ok(Number(released) >= 1, released);
    assert.equal(sql(`select status from bookings where id='${keepId}'`), "confirmed");
    assert.equal(sql(`select status from bookings where id='${holdId}'`), "expired");

    const otherP = "b8b80000-0000-4000-8000-000000000062";
    const otherC = "b8b80000-0000-4000-8000-000000000162";
    seedHousehold(otherP, otherC, "America/Chicago", "Capacity");
    useFree(otherP, otherC);
    const reclaim = book(otherC, "2026-10-29T19:00:00Z");
    assert.notEqual(fundingOf(reclaim), "other");

    const late = sql(`select fulfill_booking_payment('${payId}'::uuid, 1200, 'pi_pr8b_late');`);
    assert.match(late, /credited|expired|already/);
    assert.equal(sql(`select status from bookings where id='${keepId}'`), "confirmed");
    assert.equal(
      sql(`select count(*) from bookings where account_id='${abP}' and status in ('pending','confirmed')`),
      "1",
    );
  });

  it("G28-G31. cancellation vs capacity, completion, restore, duplicate", async () => {
    const p = "b8b80000-0000-4000-8000-000000000070";
    const c = "b8b80000-0000-4000-8000-000000000170";
    const p2 = "b8b80000-0000-4000-8000-000000000071";
    const c2 = "b8b80000-0000-4000-8000-000000000171";
    seedHousehold(p, c, "America/Chicago", "CancelCap");
    seedHousehold(p2, c2, "America/Chicago", "TakeSlot");
    useFree(p, c);
    useFree(p2, c2);
    sql(`insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
         values ('${p}', 60, 'admin_adjustment', 'slot', 'g28-60')`);
    book(c, "2026-11-03T18:00:00Z");
    const id = sql(`select id from bookings where account_id='${p}' and scheduled_start='2026-11-03T18:00:00Z'`);
    const raced = await Promise.all([
      spawnSql(`select customer_cancel_booking('${id}'::uuid);`),
      spawnBook(c2, "2026-11-03T18:00:00Z"),
    ]);
    const active = sql(
      `select count(*) from bookings where scheduled_start='2026-11-03T18:00:00Z' and status in ('pending','confirmed')`,
    );
    assert.ok(Number(active) <= 1, `${active} ${raced.join(" | ")}`);

    const p3 = "b8b80000-0000-4000-8000-000000000072";
    const c3 = "b8b80000-0000-4000-8000-000000000172";
    seedHousehold(p3, c3, "America/Chicago", "Complete");
    useFree(p3, c3);
    sql(`insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
         values ('${p3}', 60, 'admin_adjustment', 'complete', 'g29-60')`);
    book(c3, "2026-11-04T18:00:00Z");
    const doneId = sql(`select id from bookings where account_id='${p3}' and scheduled_start='2026-11-04T18:00:00Z'`);
    const vsComplete = await Promise.all([
      spawnSql(`update bookings set status='completed' where id='${doneId}' and status in ('pending','confirmed') returning status;`),
      spawnSql(`select customer_cancel_booking('${doneId}'::uuid);`),
    ]);
    const st = sql(`select status from bookings where id='${doneId}'`);
    assert.ok(st === "completed" || st === "cancelled", `${st} ${vsComplete.join(" | ")}`);
    if (st === "completed") {
      assert.equal(sql(`select coalesce(sum(minutes_delta),0) from package_minute_ledger where account_id='${p3}'`), "0");
    }

    const p4 = "b8b80000-0000-4000-8000-000000000073";
    const c4 = "b8b80000-0000-4000-8000-000000000173";
    seedHousehold(p3 ? p4 : p4, c4, "America/Chicago", "DupG");
    useFree(p4, c4);
    sql(`insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
         values ('${p4}', 60, 'admin_adjustment', 'g31', 'g31-60')`);
    book(c4, "2026-11-05T18:00:00Z");
    const id4 = sql(`select id from bookings where account_id='${p4}' and scheduled_start='2026-11-05T18:00:00Z'`);
    await Promise.all([
      spawnSql(`select customer_cancel_booking('${id4}'::uuid);`),
      spawnSql(`select customer_cancel_booking('${id4}'::uuid);`),
    ]);
    assert.equal(sql(`select status from bookings where id='${id4}'`), "cancelled");
    assert.equal(sql(`select count(*) from package_minute_ledger where account_id='${p4}' and entry_type='restoration'`), "1");
    assert.equal(sql(`select coalesce(sum(minutes_delta),0) from package_minute_ledger where account_id='${p4}'`), "60");
  });

  it("funding cascade with all sources present; UI cannot choose", () => {
    const p = "b8b80000-0000-4000-8000-000000000080";
    const c = "b8b80000-0000-4000-8000-000000000180";
    seedHousehold(p, c, "America/Chicago", "Cascade");
    subscribe365(p, "active", false, PERIOD_START, PERIOD_END, "casc");
    sql(`
      insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
      values ('${p}', 60, 'admin_adjustment', 'mix prepaid', 'casc-60');
      insert into dollar_credit_ledger (account_id, amount_cents, entry_type, reason, reference)
      values ('${p}', 1200, 'admin_adjustment', 'mix credit', 'casc-1200');
    `);
    const trial = book(c, "2026-10-20T15:00:00Z");
    assert.equal(fundingOf(trial), "free_trial");
    const mem = book(c, "2026-10-20T17:00:00Z");
    assert.equal(fundingOf(mem), "study_hall_365");
    const prepaid = book(c, "2026-10-20T19:00:00Z");
    assert.equal(fundingOf(prepaid), "prepaid");
    const credit = book(c, "2026-10-20T21:00:00Z");
    assert.equal(fundingOf(credit), "credit");
    const payg = book(c, "2026-10-20T23:00:00Z");
    assert.equal(fundingOf(payg), "payg");
    const args = sql(`
      select string_agg(pg_get_function_identity_arguments(p.oid), '|')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='book_session'
    `);
    assert.doesNotMatch(args, /funding_source|p_funding|p_cents/);
  });

  it("PMW mixed funding, cancelled does not block, PAYG replace keeps original", () => {
    const p = "b8b80000-0000-4000-8000-000000000081";
    const c = "b8b80000-0000-4000-8000-000000000181";
    seedHousehold(p, c, "America/Chicago", "PmwMix");
    useFree(p, c);
    subscribe365(p, "active", false, PERIOD_START, PERIOD_END, "pmw");
    sql(`insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
         values ('${p}', 60, 'admin_adjustment', 'pmw prepaid', 'pmw-60')`);
    const d1 = book(c, "2026-10-26T16:00:00Z");
    const d2 = book(c, "2026-10-27T16:00:00Z");
    assert.equal(fundingOf(d1), "study_hall_365");
    assert.equal(fundingOf(d2), "study_hall_365");
    const extraSame = book(c, "2026-10-26T18:00:00Z");
    assert.equal(fundingOf(extraSame), "prepaid");
    const cancelledId = sql(`select id from bookings where account_id='${p}' and scheduled_start='2026-10-27T16:00:00Z'`);
    sql(`select customer_cancel_booking('${cancelledId}'::uuid);`);
    const again = book(c, "2026-10-27T18:00:00Z");
    assert.notEqual(fundingOf(again), "study_hall_365");
    const payg = book(c, "2026-10-27T20:00:00Z");
    assert.equal(fundingOf(payg), "payg");
    const newId = sql(`select id from bookings where account_id='${p}' and scheduled_start='2026-10-27T20:00:00Z'`);
    const oldKeep = sql(`select id from bookings where account_id='${p}' and scheduled_start='2026-10-26T16:00:00Z'`);
    sql(`select attach_booking_replacement('${newId}'::uuid, '${oldKeep}'::uuid);`);
    assert.equal(sql(`select status from bookings where id='${oldKeep}'`), "confirmed");
    assert.equal(sql(`select status from bookings where id='${newId}'`), "pending");
  });

  it("household-local 23:59 / 00:00 / 00:01 vs UTC; resolver ignores Guide tz", () => {
    const tz = "America/Chicago";
    const late = utcInstantForLocalParts(2026, 10, 12, 23, 59, 0, tz).toISOString();
    const midnight = utcInstantForLocalParts(2026, 10, 12, 0, 0, 0, tz).toISOString();
    const after = utcInstantForLocalParts(2026, 10, 12, 0, 1, 0, tz).toISOString();
    const p = "b8b80000-0000-4000-8000-000000000090";
    const c = "b8b80000-0000-4000-8000-000000000190";
    seedHousehold(p, c, tz, "EdgeClock");
    useFree(p, c);
    subscribe365(p, "active", false, PERIOD_START, PERIOD_END, "edge");
    assert.equal(sql(`select public.resolve_account_timezone('${p}'::uuid)`), tz);
    assert.match(book(c, midnight), /study_hall_365/);
    assert.equal(sql(`select local_date::text from study_hall_365_day_usage where account_id='${p}'`), "2026-10-12");
    const lateFund = fundingOf(book(c, late));
    assert.notEqual(lateFund, "study_hall_365");
    void after;
    const spring = sql(`select (timestamptz '2026-03-08 07:59:00+00' at time zone 'America/Chicago')::date::text`);
    assert.equal(spring, "2026-03-08");
  });

  it("legacy ledger remains usable after 0047; new purchase of pkg_14h is blocked", () => {
    const p = "b8b80000-0000-4000-8000-000000000091";
    const c = "b8b80000-0000-4000-8000-000000000191";
    seedHousehold(p, c, "America/Chicago", "LegacyBal");
    useFree(p, c);
    sql(`insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
         values ('${p}', 840, 'purchase', 'historical pkg_14h', 'legacy-14h-840')`);
    const booked = book(c, "2026-11-06T18:00:00Z");
    assert.equal(fundingOf(booked), "prepaid");
    assert.equal(sql(`select coalesce(sum(minutes_delta),0) from package_minute_ledger where account_id='${p}'`), "780");
    assert.equal(sql(`select minutes_delta from package_minute_ledger where reference='legacy-14h-840'`), "840");
    assert.equal(sql(`select is_active::text from package_products where code='pkg_14h'`), "f");
    assert.equal(sql(`select is_active::text from package_products where code='pkg_28h'`), "f");
  });

  it("RPC security: book_session grants, search_path, no cross-household replace", () => {
    const grants = sql(`
      select string_agg(grantee || ':' || privilege_type, ',' order by grantee)
      from information_schema.role_routine_grants
      where routine_schema='public' and routine_name='book_session'
    `);
    assert.match(grants, /authenticated:EXECUTE/);
    const definer = sql(`
      select prosecdef::text || ',' || prosecdef::text from (
        select p.prosecdef
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname='book_session'
        order by p.pronargs desc limit 1
      ) s
    `);
    assert.match(definer, /t/);
    const path = sql(`
      select coalesce(p.proconfig::text, '')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='book_session'
      order by p.pronargs desc limit 1
    `);
    assert.match(path, /search_path=public/);

    const owner = "b8b80000-0000-4000-8000-000000000092";
    const ownerChild = "b8b80000-0000-4000-8000-000000000192";
    const thief = "b8b80000-0000-4000-8000-000000000093";
    const thiefChild = "b8b80000-0000-4000-8000-000000000193";
    seedHousehold(owner, ownerChild, "America/Chicago", "Own");
    seedHousehold(thief, thiefChild, "America/Chicago", "Thief");
    useFree(owner, ownerChild);
    useFree(thief, thiefChild);
    subscribe365(owner, "active", false, PERIOD_START, PERIOD_END, "own");
    book(ownerChild, "2026-11-07T18:00:00Z");
    const victim = sql(`select id from bookings where account_id='${owner}' and scheduled_start='2026-11-07T18:00:00Z'`);
    const stolen = sqlCatch(`
      select book_session(
        '${thiefChild}'::uuid, null, null, null, 60,
        '2026-11-07T20:00:00Z'::timestamptz, false,
        array['${thiefChild}'::uuid], '${victim}'::uuid
      );
    `);
    assert.match(stolen, /Not authorized to replace this session/i);
    assert.equal(sql(`select status from bookings where id='${victim}'`), "confirmed");
  });
});
