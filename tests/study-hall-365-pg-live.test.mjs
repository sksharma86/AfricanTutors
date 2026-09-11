import assert from "node:assert/strict";
import { execSync, spawn } from "node:child_process";
import { describe, it } from "node:test";

const DB = process.env.STUDY_HALL_365_TEST_DB || "studyhall_365_throwaway";
const havePsql = (() => {
  try {
    execSync("pg_isready -q", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

function dataLines(text) {
  return String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !/^(INSERT|UPDATE|DELETE|SELECT \d+|SET|RESET|CREATE|DROP|ALTER|GRANT|REVOKE|BEGIN|COMMIT|NOTIFY)\b/.test(line),
    );
}

function sql(text) {
  const out = execSync(`sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d ${DB} -A -t`, {
    encoding: "utf8",
    input: text,
    maxBuffer: 10 * 1024 * 1024,
  });
  const lines = dataLines(out);
  return lines[lines.length - 1] ?? "";
}

function sqlRaw(text) {
  return execSync(`sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d ${DB} -A -t`, {
    encoding: "utf8",
    input: text,
    maxBuffer: 10 * 1024 * 1024,
  });
}

function asRole(uid, query) {
  return sqlRaw(`
    select set_config('request.jwt.claim.sub', '${uid}', false);
    set role authenticated;
    ${query}
    reset role;
  `);
}

function spawnConsume(accountId, localDate) {
  const query = `select consume_study_hall_365_day('${accountId}'::uuid, '${localDate}'::date, null, '${localDate}T18:00:00Z'::timestamptz);`;
  return new Promise((resolve, reject) => {
    const child = spawn("sudo", ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", DB, "-A", "-t"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(err || out || `psql exit ${code}`));
      else resolve(out.trim());
    });
    child.stdin.write(query);
    child.stdin.end();
  });
}

describe("Study Hall 365 — throwaway Postgres live writes", { skip: !havePsql, concurrency: 1 }, () => {
  const parent = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const other = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const guide = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const booking = "dddddddd-dddd-dddd-dddd-dddddddddddd";
  const periodStart = "2026-09-17T16:00:00+00";
  const periodEnd = "2026-10-17T16:00:00+00";

  it("applies 0036+0037+0039 on an isolated local database (not demo)", () => {
    execSync("bash scripts/setup-study-hall-365-throwaway-db.sh", { stdio: "pipe" });
    const ten = sql(`select minutes::text || ',' || price_cents::text || ',' || is_active::text from package_products where code = 'pkg_10sh'`);
    assert.match(ten, /^600,9900,t/);
    const tables = sql(
      `select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('study_hall_365_subscriptions','study_hall_365_day_usage')`,
    );
    assert.equal(tables, "2");
    const privacy = sql(`
      select count(*) from pg_policies
       where tablename = 'study_hall_365_subscriptions'
         and policyname = 'study_hall_365_sub_select_own'
    `);
    assert.equal(privacy, "0");
    const acl = sql(`
      select string_agg(rolname || ':' || sel::text || '/' || trunc::text, ',' order by rolname)
      from (
        select r.rolname,
               has_table_privilege(r.oid, 'public.study_hall_365_subscriptions'::regclass, 'SELECT') as sel,
               has_table_privilege(r.oid, 'public.study_hall_365_subscriptions'::regclass, 'TRUNCATE') as trunc
        from pg_roles r
        where r.rolname in ('anon','authenticated','service_role')
      ) s
    `);
    assert.match(acl, /anon:f(alse)?\/f(alse)?,authenticated:t(rue)?\/f(alse)?,service_role:t(rue)?\/t(rue)?/);
  });

  it("legacy 420 + 10-pack fulfillment + webhook replay = 1020 once", () => {
    sql(`
      insert into profiles (id, role, display_name) values
        ('${parent}', 'student', 'Parent A'),
        ('${other}', 'student', 'Parent B'),
        ('${guide}', 'tutor', 'Guide')
      on conflict (id) do nothing;
      insert into bookings (id, account_id, status) values ('${booking}', '${parent}', 'confirmed')
      on conflict (id) do nothing;
    `);
    sql(`
      insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
      values ('${parent}', 420, 'admin_adjustment', 'legacy fixture', 'legacy-420-${parent}');
    `);

    const pkg = sql(`select id from package_products where code = 'pkg_10sh'`);
    const pay = sql(`
      insert into payments (account_id, purpose, package_product_id, gross_cents, status)
      values ('${parent}', 'package', '${pkg}', 10000, 'requires_payment')
      returning id;
    `);

    const claim1 = sql(`select begin_stripe_event('evt_10pack_1', 'checkout.session.completed')`);
    assert.equal(claim1, "claimed");
    const fulfill1 = sql(`select fulfill_package_payment('${pay}'::uuid, 10000, 'ch_10pack')`);
    assert.match(fulfill1, /completed/);
    sql(`select complete_stripe_event('evt_10pack_1')`);

    const claim2 = sql(`select begin_stripe_event('evt_10pack_1', 'checkout.session.completed')`);
    assert.equal(claim2, "duplicate");
    const fulfill2 = sql(`select fulfill_package_payment('${pay}'::uuid, 10000, 'ch_10pack')`);
    assert.match(fulfill2, /already_fulfilled/);
    const fulfill3 = sql(`select fulfill_package_payment('${pay}'::uuid, 10000, 'ch_10pack')`);
    assert.match(fulfill3, /already_fulfilled/);

    const sum = sql(`select coalesce(sum(minutes_delta),0) from package_minute_ledger where account_id = '${parent}'`);
    assert.equal(sum, "1020");
    const credits = sql(`
      select count(*) from package_minute_ledger
       where account_id = '${parent}' and reference = 'pkgissue:${pay}'
    `);
    assert.equal(credits, "1");
    const legacy = sql(`
      select minutes_delta from package_minute_ledger
       where reference = 'legacy-420-${parent}'
    `);
    assert.equal(legacy, "420");
  });

  it("subscription replay is one row; stale event is skipped_stale and audited", () => {
    const first = sql(`
      select upsert_study_hall_365_subscription(
        '${parent}'::uuid, 'cus_test', 'sub_test', 'price_test', 'active',
        '${periodStart}'::timestamptz, '${periodEnd}'::timestamptz,
        false, null, null, 'in_1', 'evt_sub_1', 100, null
      );
    `);
    assert.match(first, /inserted|updated/);
    const replay = sql(`
      select upsert_study_hall_365_subscription(
        '${parent}'::uuid, 'cus_test', 'sub_test', 'price_test', 'active',
        '${periodStart}'::timestamptz, '${periodEnd}'::timestamptz,
        false, null, null, 'in_1', 'evt_sub_1_replay', 100, null
      );
    `);
    assert.match(replay, /updated|inserted/);
    const count = sql(`select count(*) from study_hall_365_subscriptions where account_id = '${parent}'`);
    assert.equal(count, "1");

    const stale = sql(`
      select upsert_study_hall_365_subscription(
        '${parent}'::uuid, 'cus_test', 'sub_test', 'price_old', 'past_due',
        '${periodStart}'::timestamptz, '${periodEnd}'::timestamptz,
        false, null, null, 'in_old', 'evt_stale', 50, null
      );
    `);
    assert.match(stale, /skipped_stale/);
    const status = sql(`select status || ',' || stripe_price_id || ',' || cancel_at_period_end::text from study_hall_365_subscriptions where account_id = '${parent}'`);
    assert.match(status, /^active,price_test,f/);
    const audit = sql(`
      select count(*) from financial_audit_log
       where action = 'study_hall_365_stale_event' and reason = 'stale Stripe event ignored'
    `);
    assert.equal(audit, "1");

    const evtClaim = sql(`select begin_stripe_event('evt_sub_1', 'customer.subscription.updated')`);
    sql(`select complete_stripe_event('evt_sub_1')`);
    const evtReplay = sql(`select begin_stripe_event('evt_sub_1', 'customer.subscription.updated')`);
    assert.equal(evtClaim, "claimed");
    assert.equal(evtReplay, "duplicate");
  });

  it("two concurrent same-day consumes: one ok, one already_consumed, one usage row", async () => {
    const results = await Promise.all([
      spawnConsume(parent, "2026-09-21"),
      spawnConsume(parent, "2026-09-21"),
    ]);
    const oks = results.filter((row) => /"ok"\s*:\s*true/.test(row)).length;
    const consumed = results.filter((row) => /already_consumed/.test(row)).length;
    assert.equal(oks, 1, `expected one success, got ${results.join(" | ")}`);
    assert.equal(consumed, 1, `expected one already_consumed, got ${results.join(" | ")}`);
    const usage = sql(`
      select count(*) from study_hall_365_day_usage
       where account_id = '${parent}' and local_date = '2026-09-21'
    `);
    assert.equal(usage, "1");
  });

  it("same day stays consumed; next local day is available; unused days do not mint credits", () => {
    const same = sql(`
      select get_study_hall_365_entitlement('${parent}'::uuid, '2026-09-21'::date, '2026-09-21T20:00:00Z'::timestamptz);
    `);
    assert.match(same, /already_consumed/);
    assert.match(same, /"entitled": false|"entitled":false/);
    const next = sql(`
      select get_study_hall_365_entitlement('${parent}'::uuid, '2026-09-22'::date, '2026-09-22T18:00:00Z'::timestamptz);
    `);
    assert.match(next, /available/);
    assert.match(next, /"entitled": true|"entitled":true/);
    const usageRows = sql(`select count(*) from study_hall_365_day_usage where account_id = '${parent}'`);
    assert.equal(usageRows, "1");
    const mintedCredits = sql(`
      select count(*) from package_minute_ledger
       where account_id = '${parent}' and entry_type = 'purchase' and reason ilike '%365%'
    `);
    assert.equal(mintedCredits, "0");
  });

  it("booking cancel does not delete or restore the usage row", () => {
    sql(`
      select consume_study_hall_365_day(
        '${parent}'::uuid, '2026-09-23'::date, '${booking}'::uuid, '2026-09-23T18:00:00Z'::timestamptz
      );
    `);
    sql(`update bookings set status = 'cancelled' where id = '${booking}'`);
    const afterCancel = sql(`
      select count(*)::text || ',' || coalesce(min(booking_id::text),'') from study_hall_365_day_usage
       where account_id = '${parent}' and local_date = '2026-09-23'
    `);
    assert.match(afterCancel, /^1,/);
    assert.ok(afterCancel.includes(booking), afterCancel);
    sql(`delete from bookings where id = '${booking}'`);
    const afterDelete = sql(`
      select count(*)::text || ',' || coalesce(min(booking_id::text),'null') from study_hall_365_day_usage
       where account_id = '${parent}' and local_date = '2026-09-23'
    `);
    assert.equal(afterDelete, "1,null");
    const still = sql(`
      select get_study_hall_365_entitlement('${parent}'::uuid, '2026-09-23'::date, '2026-09-23T20:00:00Z'::timestamptz);
    `);
    assert.match(still, /already_consumed/);
  });

  it("civil date overlap is not enough when booking start is outside the paid window", () => {
    const morning = sql(`
      select get_study_hall_365_entitlement(
        '${parent}'::uuid, '2026-09-17'::date, '2026-09-17T18:00:00Z'::timestamptz, '2026-09-17T10:00:00Z'::timestamptz
      );
    `);
    assert.match(morning, /booking_outside_paid_window/);
    const afternoon = sql(`
      select get_study_hall_365_entitlement(
        '${parent}'::uuid, '2026-09-17'::date, '2026-09-17T18:00:00Z'::timestamptz, '2026-09-17T17:00:00Z'::timestamptz
      );
    `);
    assert.match(afternoon, /available/);
    assert.match(afternoon, /"entitled": true|"entitled":true/);
  });

  it("parents cannot read raw Stripe ids; Parent B and Guides cannot read Parent A", () => {
    const asParent = asRole(parent, `select count(*)::text from study_hall_365_subscriptions;`);
    assert.equal(dataLines(asParent).filter((line) => /^\d+$/.test(line)).pop(), "0");

    const membership = asRole(parent, `select get_study_hall_365_membership('${parent}'::uuid);`);
    assert.match(membership, /entitled/);
    assert.match(membership, /customer_status/);
    assert.doesNotMatch(
      membership,
      /stripe_subscription_id|stripe_customer_id|stripe_price_id|cus_test|sub_test|price_test|evt_/,
    );

    let otherDenied = false;
    try {
      asRole(other, `select get_study_hall_365_membership('${parent}'::uuid);`);
    } catch {
      otherDenied = true;
    }
    assert.equal(otherDenied, true);

    let guideDenied = false;
    try {
      asRole(guide, `select get_study_hall_365_membership('${parent}'::uuid);`);
    } catch {
      guideDenied = true;
    }
    assert.equal(guideDenied, true);

    const guideSelect = asRole(guide, `select count(*)::text from study_hall_365_subscriptions;`);
    assert.equal(dataLines(guideSelect).filter((line) => /^\d+$/.test(line)).pop(), "0");
    const otherSelect = asRole(other, `select count(*)::text from study_hall_365_subscriptions;`);
    assert.equal(dataLines(otherSelect).filter((line) => /^\d+$/.test(line)).pop(), "0");
  });
});
