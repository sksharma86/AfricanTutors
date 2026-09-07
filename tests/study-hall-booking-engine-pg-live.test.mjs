import assert from "node:assert/strict";
import { execSync, spawn } from "node:child_process";
import { describe, it } from "node:test";

const DB = process.env.STUDY_HALL_BOOKING_TEST_DB || "studyhall_booking_throwaway";
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
    .filter((line) => line && !/^(INSERT|UPDATE|DELETE|SELECT \d+|SET|RESET|CREATE|DROP|ALTER|GRANT|REVOKE|BEGIN|COMMIT|NOTIFY)\b/.test(line));
}

function sql(text) {
  const out = execSync(`sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d ${DB} -A -t`, {
    encoding: "utf8",
    input: text,
    maxBuffer: 10 * 1024 * 1024,
  });
  return dataLines(out).pop() ?? "";
}

function sqlAll(text) {
  const out = execSync(`sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d ${DB} -A -t`, {
    encoding: "utf8",
    input: text,
    maxBuffer: 10 * 1024 * 1024,
  });
  return dataLines(out);
}

function spawnBook(studentId, startIso) {
  const query = `
    select book_session(
      '${studentId}'::uuid, null, null, null, 60,
      '${startIso}'::timestamptz, false, array['${studentId}'::uuid]
    );
  `;
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
      if (code !== 0) resolve(err || out || `exit ${code}`);
      else resolve(out.trim());
    });
    child.stdin.write(query);
    child.stdin.end();
  });
}

function book(studentId, startIso, duration = 60, free = false, ids = null) {
  const arr = ids ?? [studentId];
  return sql(`
    select book_session(
      '${studentId}'::uuid, null, null, null, ${duration},
      '${startIso}'::timestamptz, ${free}, array[${arr.map((id) => `'${id}'::uuid`).join(",")}]
    );
  `);
}

function seedHousehold(parent, child, tz = "America/Chicago", name = "Parent") {
  sql(`
    insert into profiles (id, role, display_name, timezone) values
      ('${parent}', 'student', '${name}', '${tz}')
    on conflict (id) do update set role = excluded.role, timezone = excluded.timezone;
    insert into students (id, account_id, full_name, timezone) values
      ('${child}', '${parent}', 'Child ${name}', '${tz}')
    on conflict (id) do update set account_id = excluded.account_id;
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

describe("PR3 booking engine — throwaway live writes", { skip: !havePsql, concurrency: 1 }, () => {
  const guide = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const parent = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const child = "11111111-1111-1111-1111-111111111111";
  const childB = "11111111-1111-1111-1111-111111111112";
  const childC = "11111111-1111-1111-1111-111111111113";
  const parent365 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1";
  const child365 = "11111111-1111-1111-1111-111111111121";
  const parentPayg = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2";
  const childPayg = "11111111-1111-1111-1111-111111111122";
  const parentPre = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const childPre = "22222222-2222-2222-2222-222222222222";
  const parentB = "dddddddd-dddd-dddd-dddd-dddddddddddd";
  const childOther = "33333333-3333-3333-3333-333333333333";
  const guideUser = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
  const start365 = "2026-09-21T18:00:00Z";
  const start365b = "2026-09-21T20:00:00Z";
  const start365c = "2026-09-21T22:00:00Z";
  const startNext = "2026-09-22T18:00:00Z";
  const startOutside = "2026-09-17T10:00:00Z";
  const periodStart = "2026-09-17T16:00:00+00";
  const periodEnd = "2026-10-17T16:00:00+00";

  it("applies 0036–0040 on an isolated booking throwaway database", () => {
    execSync("bash scripts/setup-study-hall-booking-throwaway-db.sh", { stdio: "pipe" });
    const quoteForms = sql(`
      select count(*) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'booking_quote'
    `);
    assert.equal(quoteForms, "1");
    seedHousehold(parent, child);
    sql(`
      insert into students (id, account_id, full_name, timezone) values
        ('${childB}', '${parent}', 'Child B', 'America/Chicago'),
        ('${childC}', '${parent}', 'Child C', 'America/Chicago')
      on conflict (id) do nothing;
      insert into profiles (id, role, display_name, timezone) values
        ('${guide}', 'tutor', 'Guide', 'Africa/Lagos')
      on conflict (id) do update set role = excluded.role;
      insert into tutor_profiles (profile_id, status, timezone) values
        ('${guide}', 'approved', 'Africa/Lagos')
      on conflict (profile_id) do nothing;
    `);
    seedHousehold(parent365, child365, "America/Chicago", "365");
    seedHousehold(parentPayg, childPayg, "America/Chicago", "PAYG");
    seedHousehold(parentPre, childPre, "America/Chicago", "Prepaid");
    seedHousehold(parentB, childOther, "America/New_York", "Other");
    useFree(parent365, child365);
    useFree(parentPayg, childPayg);
    useFree(parentPre, childPre);
    const threeArg = sql(`select (booking_quote('${parentPayg}'::uuid, 60, false))->>'funding'`);
    assert.equal(threeArg, "stripe");
    assert.equal(sql(`select to_regclass('public.bookings') is not null`), "t");
  });

  it("rejects 120/180/45 for a scheduled customer Study Hall and ignores 180 availability", () => {
    for (const dur of [120, 180, 45]) {
      let failed = false;
      let message = "";
      try {
        book(child, startNext, dur);
      } catch (err) {
        failed = true;
        message = String(err.stderr || err.message || err);
      }
      assert.equal(failed, true, `duration ${dur} must be rejected`);
      if (dur === 45) assert.match(message, /Invalid duration/);
      else assert.match(message, /Study Hall sessions are 60 minutes/);
    }
    let availFailed = false;
    let availMsg = "";
    try {
      sql(`select * from get_available_slots(null, 180, now(), now() + interval '2 days');`);
    } catch (err) {
      availFailed = true;
      availMsg = String(err.stderr || err.message || err);
    }
    assert.equal(availFailed, true);
    assert.match(availMsg, /Study Hall sessions are 60 minutes/);
  });

  it("1. free first Study Hall is 60 minutes, no Stripe, funding_source=free_trial", () => {
    const first = book(child, "2026-09-20T18:00:00Z");
    assert.match(first, /free_trial/);
    assert.match(first, /"stripe_cents_due": 0/);
    assert.equal(sql(`select funding_source from bookings where account_id='${parent}' and is_free_trial order by created_at desc limit 1`), "free_trial");
    assert.equal(sql(`select duration_minutes from bookings where account_id='${parent}' and is_free_trial order by created_at desc limit 1`), "60");
    assert.equal(sql(`select payment_status from bookings where account_id='${parent}' and is_free_trial order by created_at desc limit 1`), "not_required");
  });

  it("3/4. second free attempt is not free; concurrent free cannot double", async () => {
    let secondFree = "";
    try {
      secondFree = sql(`
        select book_session('${child}'::uuid, null, null, null, 60, '2026-09-20T19:00:00Z'::timestamptz, true, array['${child}'::uuid]);
      `);
    } catch (err) {
      secondFree = String(err.stderr || err.message || err);
    }
    assert.match(secondFree, /already used its free trial/i);

    const parentFree = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3";
    const childFree = "11111111-1111-1111-1111-111111111123";
    seedHousehold(parentFree, childFree, "America/Chicago", "FreeRace");
    const results = await Promise.all([
      spawnBook(childFree, "2026-09-23T18:00:00Z"),
      spawnBook(childFree, "2026-09-23T20:00:00Z"),
    ]);
    const frees = results.filter((r) => /free_trial/.test(r)).length;
    assert.equal(sql(`select count(*) from bookings where account_id='${parentFree}' and is_free_trial and status <> 'cancelled'`), "1");
    assert.ok(frees <= 1, results.join(" | "));
  });

  it("5-16. 365 books atomically; concurrency; cancel does not restore; siblings; period rules", async () => {
    subscribe365(parent365, "active", false, periodStart, periodEnd, "b365");

    const outside = sql(`
      select (get_study_hall_365_entitlement('${parent365}'::uuid, '2026-09-17'::date, now(), '${startOutside}'::timestamptz))->>'reason';
    `);
    assert.match(outside, /booking_outside_paid_window/);

    const pastDueParent = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4";
    const pastDueChild = "11111111-1111-1111-1111-111111111124";
    seedHousehold(pastDueParent, pastDueChild);
    useFree(pastDueParent, pastDueChild);
    subscribe365(pastDueParent, "past_due", false, periodStart, periodEnd, "pd");
    const pastDueBook = book(pastDueChild, start365);
    assert.doesNotMatch(pastDueBook, /study_hall_365/);
    assert.match(pastDueBook, /payg|stripe/);

    const cancelingParent = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5";
    const cancelingChild = "11111111-1111-1111-1111-111111111125";
    seedHousehold(cancelingParent, cancelingChild);
    useFree(cancelingParent, cancelingChild);
    subscribe365(cancelingParent, "active", true, periodStart, periodEnd, "cap");
    const cancelingBook = book(cancelingChild, start365);
    assert.match(cancelingBook, /study_hall_365/);

    let failedPast = "";
    try {
      book(child365, "2020-01-01T18:00:00Z");
    } catch (err) {
      failedPast = String(err.stderr || err.message || err);
    }
    assert.match(failedPast, /past/i);
    assert.equal(sql(`select count(*) from study_hall_365_day_usage where account_id='${parent365}'`), "0");

    const results = await Promise.all([spawnBook(child365, start365), spawnBook(child365, start365b)]);
    const joined = results.join(" | ");
    const wins = results.filter((r) => /study_hall_365/.test(r)).length;
    assert.equal(wins, 1, joined);
    assert.doesNotMatch(joined, /already included/i);
    const fallbacks = results.filter((r) => /payg|prepaid|package|stripe|credit/.test(r) && !/study_hall_365/.test(r)).length;
    assert.equal(fallbacks, 1, joined);
    assert.equal(sql(`select count(*) from study_hall_365_day_usage where account_id='${parent365}' and local_date='2026-09-21'`), "1");
    assert.equal(sql(`select funding_source from bookings where account_id='${parent365}' and funding_source='study_hall_365' order by created_at desc limit 1`), "study_hall_365");
    assert.equal(sql(`select duration_minutes from bookings where account_id='${parent365}' and funding_source='study_hall_365' order by created_at desc limit 1`), "60");

    const booking = sql(`select id from bookings where account_id='${parent365}' and funding_source='study_hall_365' order by created_at desc limit 1`);
    sql(`select customer_cancel_booking('${booking}'::uuid);`);
    assert.equal(sql(`select count(*) from study_hall_365_day_usage where account_id='${parent365}' and local_date='2026-09-21'`), "1");
    const secondSameDay = book(child365, start365c);
    assert.doesNotMatch(secondSameDay, /study_hall_365/);
    assert.match(secondSameDay, /payg|prepaid|package|stripe|credit/);

    const next = book(child365, startNext);
    assert.match(next, /study_hall_365/);

    const sibParent = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6";
    const sib1 = "11111111-1111-1111-1111-111111111161";
    const sib2 = "11111111-1111-1111-1111-111111111162";
    const sib3 = "11111111-1111-1111-1111-111111111163";
    seedHousehold(sibParent, sib1);
    sql(`
      insert into students (id, account_id, full_name, timezone) values
        ('${sib2}', '${sibParent}', 'Sib 2', 'America/Chicago'),
        ('${sib3}', '${sibParent}', 'Sib 3', 'America/Chicago')
      on conflict do nothing;
    `);
    useFree(sibParent, sib1);
    subscribe365(sibParent, "active", false, periodStart, periodEnd, "sib");
    const sibBook = book(sib1, "2026-09-23T18:00:00Z", 60, false, [sib1, sib2, sib3]);
    assert.match(sibBook, /study_hall_365/);
    assert.equal(sql(`select child_count from bookings where account_id='${sibParent}' and funding_source='study_hall_365'`), "3");
    assert.equal(sql(`select count(*) from study_hall_365_day_usage where account_id='${sibParent}' and local_date='2026-09-23'`), "1");
  });

  it("17-21. prepaid consumes 60 once; concurrent 60-balance allows one; cancel restores early", async () => {
    sql(`
      insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
      values ('${parentPre}', 600, 'admin_adjustment', 'pack', 'prepaid-600');
    `);
    const booked = book(childPre, "2026-09-24T18:00:00Z");
    assert.match(booked, /prepaid|package/);
    assert.equal(sql(`select coalesce(sum(minutes_delta),0) from package_minute_ledger where account_id='${parentPre}'`), "540");
    assert.equal(sql(`select funding_source from bookings where account_id='${parentPre}' order by created_at desc limit 1`), "prepaid");

    const id540 = sql(`select id from bookings where account_id='${parentPre}' order by created_at desc limit 1`);
    sql(`select customer_cancel_booking('${id540}'::uuid);`);
    assert.equal(sql(`select coalesce(sum(minutes_delta),0) from package_minute_ledger where account_id='${parentPre}'`), "600");

    sql(`select book_session('${childPre}'::uuid, null, null, null, 60, '2026-09-25T18:00:00Z'::timestamptz, false, array['${childPre}'::uuid]);`);
    assert.equal(sql(`select coalesce(sum(minutes_delta),0) from package_minute_ledger where account_id='${parentPre}'`), "540");

    sql(`
      insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
      values ('${parentPre}', -480, 'admin_adjustment', 'trim', 'prepaid-trim-480');
    `);
    assert.equal(sql(`select coalesce(sum(minutes_delta),0) from package_minute_ledger where account_id='${parentPre}'`), "60");

    const raceParent = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7";
    const raceChild = "11111111-1111-1111-1111-111111111127";
    seedHousehold(raceParent, raceChild);
    useFree(raceParent, raceChild);
    sql(`
      insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
      values ('${raceParent}', 60, 'admin_adjustment', 'race', 'prepaid-race-60');
    `);
    const raced = await Promise.all([
      spawnBook(raceChild, "2026-09-26T18:00:00Z"),
      spawnBook(raceChild, "2026-09-26T20:00:00Z"),
    ]);
    const prepaidWins = raced.filter((r) => /"funding_source": "prepaid"|"funding": "package"/.test(r)).length;
    assert.equal(prepaidWins, 1, raced.join(" | "));
    assert.equal(sql(`select coalesce(sum(minutes_delta),0) from package_minute_ledger where account_id='${raceParent}'`), "0");
    assert.equal(sql(`select count(*) from bookings where account_id='${raceParent}' and funding_source='prepaid'`), "1");

    let insufficient = "";
    try {
      book(raceChild, "2026-09-27T18:00:00Z");
    } catch (err) {
      insufficient = String(err.stderr || err.message || err);
    }
    const afterInsufficient = sql(`select funding_source from bookings where account_id='${raceParent}' and scheduled_start='2026-09-27T18:00:00Z'`);
    assert.ok(afterInsufficient === "payg" || /No Guide|payg|stripe/.test(insufficient + afterInsufficient));
  });

  it("22/40/48. PAYG is 1200 cents; 365 and prepaid rollback leave no side effects", () => {
    const q = sql(`select (booking_quote('${parentPayg}'::uuid, 60, false, '2026-09-28T18:00:00Z'::timestamptz))->>'stripe_cents_due';`);
    assert.equal(q, "1200");
    const payg = book(childPayg, "2026-09-28T18:00:00Z");
    assert.match(payg, /"stripe_cents_due": 1200/);
    assert.match(payg, /payg|stripe/);
    assert.equal(sql(`select funding_source from bookings where account_id='${parentPayg}' and scheduled_start='2026-09-28T18:00:00Z'`), "payg");
    assert.equal(sql(`select payment_status from bookings where account_id='${parentPayg}' and scheduled_start='2026-09-28T18:00:00Z'`), "awaiting_payment");
    assert.equal(sql(`select status from payments where account_id='${parentPayg}' order by created_at desc limit 1`), "requires_payment");

    subscribe365(parent365, "active", false, periodStart, periodEnd, "b365");
    try {
      sql(`select set_config('studyhall.debug_fail_after_funding', '1', false);
           select book_session('${child365}'::uuid, null, null, null, 60, '2026-09-29T18:00:00Z'::timestamptz, false, array['${child365}'::uuid]);`);
    } catch {
      /* expected */
    }
    assert.equal(sql(`select count(*) from study_hall_365_day_usage where account_id='${parent365}' and local_date='2026-09-29'`), "0");
    assert.equal(sql(`select count(*) from bookings where account_id='${parent365}' and scheduled_start='2026-09-29T18:00:00Z'`), "0");

    const rollParent = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8";
    const rollChild = "11111111-1111-1111-1111-111111111128";
    seedHousehold(rollParent, rollChild);
    useFree(rollParent, rollChild);
    sql(`
      insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
      values ('${rollParent}', 60, 'admin_adjustment', 'roll', 'prepaid-roll-60');
    `);
    try {
      sql(`select set_config('studyhall.debug_fail_after_funding', '1', false);
           select book_session('${rollChild}'::uuid, null, null, null, 60, '2026-09-30T18:00:00Z'::timestamptz, false, array['${rollChild}'::uuid]);`);
    } catch {
      /* expected */
    }
    assert.equal(sql(`select coalesce(sum(minutes_delta),0) from package_minute_ledger where account_id='${rollParent}'`), "60");
    assert.equal(sql(`select count(*) from bookings where account_id='${rollParent}' and scheduled_start='2026-09-30T18:00:00Z'`), "0");

    const freeRoll = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9";
    const freeRollChild = "11111111-1111-1111-1111-111111111129";
    seedHousehold(freeRoll, freeRollChild);
    try {
      sql(`select set_config('studyhall.debug_fail_after_funding', '1', false);
           select book_session('${freeRollChild}'::uuid, null, null, null, 60, '2026-10-01T18:00:00Z'::timestamptz, false, array['${freeRollChild}'::uuid]);`);
    } catch {
      /* expected */
    }
    assert.match(sql(`select public.account_has_used_free_trial('${freeRoll}'::uuid)::text`), /^(f|false)$/);
    assert.equal(sql(`select count(*) from bookings where account_id='${freeRoll}'`), "0");
  });

  it("28-32. multi-source priority and snapshot; extra same-day uses prepaid/PAYG", () => {
    const mix = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa10";
    const mixChild = "11111111-1111-1111-1111-111111111130";
    seedHousehold(mix, mixChild);
    subscribe365(mix, "active", false, periodStart, periodEnd, "mix");
    sql(`
      insert into package_minute_ledger (account_id, minutes_delta, entry_type, reason, reference)
      values ('${mix}', 300, 'admin_adjustment', 'mix', 'mix-300');
    `);
    const first = book(mixChild, "2026-09-21T17:00:00Z");
    assert.match(first, /free_trial/);
    assert.equal(sql(`select count(*) from study_hall_365_day_usage where account_id='${mix}'`), "0");

    const second = book(mixChild, "2026-09-21T19:00:00Z");
    assert.match(second, /study_hall_365/);
    assert.equal(sql(`select coalesce(sum(minutes_delta),0) from package_minute_ledger where account_id='${mix}'`), "300");

    const third = book(mixChild, "2026-09-21T21:00:00Z");
    assert.match(third, /prepaid|package/);
    assert.equal(sql(`select coalesce(sum(minutes_delta),0) from package_minute_ledger where account_id='${mix}'`), "240");

    sql(`
      update study_hall_365_subscriptions
         set status = 'ended', ended_at = now()
       where account_id = '${mix}';
    `);
    assert.equal(sql(`select funding_source from bookings where account_id='${mix}' and scheduled_start='2026-09-21T19:00:00Z'`), "study_hall_365");

    const creditParent = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa13";
    const creditChild = "11111111-1111-1111-1111-111111111133";
    seedHousehold(creditParent, creditChild);
    useFree(creditParent, creditChild);
    subscribe365(creditParent, "active", false, periodStart, periodEnd, "cred");
    const creditFirst = book(creditChild, "2026-09-21T17:00:00Z");
    assert.match(creditFirst, /study_hall_365/);
    sql(`
      insert into dollar_credit_ledger (account_id, amount_cents, entry_type, reason, reference)
      values ('${creditParent}', 1200, 'admin_adjustment', 'same-day extra', 'credit-1200');
    `);
    const creditSecond = book(creditChild, "2026-09-21T19:00:00Z");
    assert.match(creditSecond, /credit/);
    assert.doesNotMatch(creditSecond, /study_hall_365/);
    assert.equal(sql(`select funding_source from bookings where account_id='${creditParent}' and scheduled_start='2026-09-21T19:00:00Z'`), "credit");
    assert.equal(sql(`select coalesce(sum(amount_cents),0) from dollar_credit_ledger where account_id='${creditParent}'`), "0");
  });

  it("39-42. timezone / UTC midnight / DST / period-end instant", () => {
    const tzParent = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11";
    const tzChild = "11111111-1111-1111-1111-111111111131";
    seedHousehold(tzParent, tzChild, "America/Chicago", "TZ");
    useFree(tzParent, tzChild);
    subscribe365(tzParent, "active", false, periodStart, periodEnd, "tz");

    const utcMidnight = book(tzChild, "2026-09-22T04:00:00Z");
    assert.match(utcMidnight, /study_hall_365/);
    assert.equal(sql(`select local_date::text from study_hall_365_day_usage where account_id='${tzParent}'`), "2026-09-21");
    const sameLocalExtra = book(tzChild, "2026-09-22T03:00:00Z");
    assert.doesNotMatch(sameLocalExtra, /study_hall_365/);
    assert.match(sameLocalExtra, /payg|prepaid|package|stripe|credit/);
    const afterMidnight = book(tzChild, "2026-09-22T05:30:00Z");
    assert.match(afterMidnight, /study_hall_365/);
    assert.equal(sql(`select count(*) from study_hall_365_day_usage where account_id='${tzParent}'`), "2");

    const dstParent = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa12";
    const dstChild = "11111111-1111-1111-1111-111111111132";
    seedHousehold(dstParent, dstChild, "America/Chicago", "DST");
    useFree(dstParent, dstChild);
    subscribe365(dstParent, "active", false, "2026-10-17T16:00:00+00", "2026-11-17T16:00:00+00", "dst");
    const dstBook = book(dstChild, "2026-11-01T07:00:00Z");
    assert.match(dstBook, /study_hall_365/);
    const dstDate = sql(`select local_date::text from study_hall_365_day_usage where account_id='${dstParent}'`);
    assert.ok(dstDate === "2026-11-01" || dstDate === "2026-10-31", dstDate);

    const edge = sql(`
      select (get_study_hall_365_entitlement('${tzParent}'::uuid, null, now(), '2026-10-17T16:00:00Z'::timestamptz))->>'reason';
    `);
    assert.match(edge, /booking_outside_paid_window|status_not_entitled|outside_paid_period/);
  });

  it("43-48. security: household isolation, guide blocked, client cannot force funding", () => {
    subscribe365(parentB, "active", false, periodStart, periodEnd, "other");
    let stolen = "";
    try {
      sql(`
        select book_session(
          '${childOther}'::uuid, null, null, null, 60,
          '2026-09-21T18:00:00Z'::timestamptz, false, array['${child}'::uuid]
        );
      `);
    } catch (err) {
      stolen = String(err.stderr || err.message || err);
    }
    assert.match(stolen, /Not authorized|Student not found/i);

    sql(`
      insert into profiles (id, role, display_name) values ('${guideUser}', 'tutor', 'Guide User')
      on conflict (id) do update set role = 'tutor';
    `);
    let guideBook = "";
    try {
      sql(`
        select set_config('request.jwt.claim.sub', '${guideUser}', false);
        select book_session('${childPayg}'::uuid, null, null, null, 60, '2026-10-02T18:00:00Z'::timestamptz, false, array['${childPayg}'::uuid]);
      `);
    } catch (err) {
      guideBook = String(err.stderr || err.message || err);
    }
    assert.match(guideBook, /Guides cannot book parent Study Halls|Not authorized/);

    const cols = sqlAll(`
      select pg_get_function_identity_arguments(p.oid)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='book_session';
    `).join(" ");
    assert.doesNotMatch(cols, /funding_source|p_price|p_cents/);
  });

  it("38. historical 120/180 rows remain readable", () => {
    sql(`
      insert into bookings (
        account_id, student_id, duration_minutes, status, scheduled_start, scheduled_end, funding_source
      ) values (
        '${parent}', '${child}', 120, 'confirmed', '2026-08-01T18:00:00Z', '2026-08-01T20:00:00Z', null
      );
    `);
    assert.equal(sql(`select duration_minutes from bookings where duration_minutes=120 limit 1`), "120");
    assert.equal(sql(`select funding_source from bookings where duration_minutes=120 limit 1`) || "", "");
  });
});
