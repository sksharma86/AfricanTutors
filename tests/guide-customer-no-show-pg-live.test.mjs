import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { describe, it } from "node:test";

const DB = process.env.STUDY_HALL_PR6_TEST_DB || "studyhall_pr6_throwaway";
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

function sqlOk(text) {
  try {
    return { ok: true, out: sql(text) };
  } catch (err) {
    return { ok: false, out: String(err?.stderr || err?.message || err) };
  }
}

const GUIDE = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const OTHER = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const PARENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CHILD = "11111111-1111-1111-1111-111111111111";

function asGuide(guideId, query) {
  return `
    select set_config('request.jwt.claim.sub', '${guideId}', false);
    set role authenticated;
    ${query}
    reset role;
  `;
}

describe("PR6 — throwaway Postgres customer no-show", { skip: !havePsql, concurrency: 1 }, () => {
  it("applies 0043 on the isolated booking throwaway database", () => {
    execSync("bash scripts/setup-study-hall-booking-throwaway-db.sh", {
      stdio: "pipe",
      env: { ...process.env, STUDY_HALL_BOOKING_TEST_DB: DB },
    });
    execSync(`sudo -u postgres psql -v ON_ERROR_STOP=1 -d ${DB} -f scripts/study-hall-pr6-throwaway-extra.sql`, {
      stdio: "pipe",
    });
    execSync(`sudo -u postgres psql -v ON_ERROR_STOP=1 -d ${DB} -f supabase/migrations/0043_guide_customer_no_show.sql`, {
      stdio: "pipe",
    });
    sql(`
      insert into profiles (id, role, display_name, timezone) values
        ('${PARENT}', 'student', 'Parent', 'America/Chicago'),
        ('${GUIDE}', 'tutor', 'Guide', 'Africa/Lagos'),
        ('${OTHER}', 'tutor', 'Other', 'Africa/Lagos')
      on conflict (id) do update set role = excluded.role;
      insert into students (id, account_id, full_name, timezone) values
        ('${CHILD}', '${PARENT}', 'Child', 'America/Chicago')
      on conflict (id) do update set account_id = excluded.account_id;
      insert into tutor_profiles (profile_id, status, timezone, comp_rate_cents_per_hour) values
        ('${GUIDE}', 'approved', 'Africa/Lagos', 1000),
        ('${OTHER}', 'approved', 'Africa/Lagos', 1000)
      on conflict (profile_id) do update set status = excluded.status, comp_rate_cents_per_hour = excluded.comp_rate_cents_per_hour;
    `);
    const grants = sql(`
      select has_function_privilege('anon', 'public.guide_mark_customer_no_show(uuid)', 'execute')::text
        || ',' || has_function_privilege('authenticated', 'public.guide_mark_customer_no_show(uuid)', 'execute')::text
    `);
    assert.equal(grants, "false,true");
  });

  function seedBooking(id, { startOffsetMin = -20, status = "confirmed", payment = "paid", trial = false, funding = "prepaid" } = {}) {
    sql(`
      insert into bookings (
        id, account_id, student_id, tutor_id, status, payment_status, scheduled_start, scheduled_end,
        duration_minutes, is_free_trial, funding_source
      ) values (
        '${id}', '${PARENT}', '${CHILD}', '${GUIDE}', '${status}', '${payment}',
        now() + interval '${startOffsetMin} minutes',
        now() + interval '${startOffsetMin + 60} minutes',
        60, ${trial}, '${funding}'
      )
      on conflict (id) do update set
        status = excluded.status,
        payment_status = excluded.payment_status,
        tutor_id = excluded.tutor_id,
        scheduled_start = excluded.scheduled_start,
        scheduled_end = excluded.scheduled_end,
        is_free_trial = excluded.is_free_trial,
        funding_source = excluded.funding_source;
      delete from tutor_earnings where booking_id = '${id}';
      delete from session_presence where booking_id = '${id}';
    `);
  }

  it("5. rejects no-show before T+15 using database now()", () => {
    seedBooking("10000000-0000-4000-8000-000000000001", { startOffsetMin: -10 });
    const r = sqlOk(asGuide(GUIDE, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000001');`));
    assert.equal(r.ok, false);
    assert.match(r.out, /15 minutes after the scheduled start/);
  });

  it("6-7. assigned Guide can mark at/after T+15 with server time", () => {
    seedBooking("10000000-0000-4000-8000-000000000002", { startOffsetMin: -16 });
    const out = sql(asGuide(GUIDE, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000002');`));
    assert.match(out, /"status"\s*:\s*"no_show"/);
    assert.match(out, /"idempotent"\s*:\s*false/);
    assert.equal(sql(`select status::text from bookings where id = '10000000-0000-4000-8000-000000000002'`), "no_show");
  });

  it("8-9. wrong Guide and unrelated booking are rejected", () => {
    seedBooking("10000000-0000-4000-8000-000000000003", { startOffsetMin: -16 });
    const wrong = sqlOk(asGuide(OTHER, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000003');`));
    assert.equal(wrong.ok, false);
    assert.match(wrong.out, /Not authorized/);
    const missing = sqlOk(asGuide(GUIDE, `select guide_mark_customer_no_show('20000000-0000-4000-8000-000000000099');`));
    assert.equal(missing.ok, false);
    assert.match(missing.out, /Booking not found/);
  });

  it("10-12. cancelled, completed, and awaiting-payment bookings are rejected", () => {
    seedBooking("10000000-0000-4000-8000-000000000004", { startOffsetMin: -16, status: "cancelled" });
    assert.match(
      sqlOk(asGuide(GUIDE, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000004');`)).out,
      /cancelled/i,
    );
    seedBooking("10000000-0000-4000-8000-000000000005", { startOffsetMin: -16, status: "completed" });
    assert.match(
      sqlOk(asGuide(GUIDE, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000005');`)).out,
      /already completed/,
    );
    seedBooking("10000000-0000-4000-8000-000000000006", {
      startOffsetMin: -16,
      status: "confirmed",
      payment: "awaiting_payment",
    });
    assert.match(
      sqlOk(asGuide(GUIDE, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000006');`)).out,
      /awaiting payment/,
    );
  });

  it("13/16/17. duplicate no-show is idempotent and pays once", () => {
    seedBooking("10000000-0000-4000-8000-000000000007", { startOffsetMin: -16 });
    sql(asGuide(GUIDE, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000007');`));
    const again = sql(asGuide(GUIDE, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000007');`));
    assert.match(again, /"idempotent"\s*:\s*true/);
    assert.equal(sql(`select count(*) from tutor_earnings where booking_id = '10000000-0000-4000-8000-000000000007'`), "1");
    assert.equal(sql(`select amount_cents::text from tutor_earnings where booking_id = '10000000-0000-4000-8000-000000000007'`), "1000");
  });

  it("14. parent join before no-show prevents invalid marking", () => {
    seedBooking("10000000-0000-4000-8000-000000000008", { startOffsetMin: -16 });
    sql(`
      insert into session_presence (booking_id, student_first_joined_at)
      values ('10000000-0000-4000-8000-000000000008', now())
      on conflict (booking_id) do update set student_first_joined_at = excluded.student_first_joined_at;
    `);
    const r = sqlOk(asGuide(GUIDE, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000008');`));
    assert.equal(r.ok, false);
    assert.match(r.out, /already joined/);
    assert.equal(sql(`select status::text from bookings where id = '10000000-0000-4000-8000-000000000008'`), "confirmed");
  });

  it("15. cancel vs no-show race leaves cancelled booking unrestored-as-no-show", () => {
    seedBooking("10000000-0000-4000-8000-000000000009", { startOffsetMin: -16 });
    sql(`update bookings set status = 'cancelled' where id = '10000000-0000-4000-8000-000000000009'`);
    const r = sqlOk(asGuide(GUIDE, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000009');`));
    assert.equal(r.ok, false);
    assert.equal(sql(`select status::text from bookings where id = '10000000-0000-4000-8000-000000000009'`), "cancelled");
  });

  it("prepaid / 365 / credit / free trial / PAYG are not restored", () => {
    seedBooking("10000000-0000-4000-8000-000000000010", { startOffsetMin: -16, funding: "prepaid" });
    sql(`
      insert into package_minute_ledger (account_id, minutes_delta, entry_type, booking_id, reason, reference)
      values ('${PARENT}', -60, 'consumption', '10000000-0000-4000-8000-000000000010', 'prepaid consume', 'pr6:pkg:10')
      on conflict (reference) do nothing;
    `);
    seedBooking("10000000-0000-4000-8000-000000000011", { startOffsetMin: -16, funding: "credit" });
    sql(`
      insert into dollar_credit_ledger (account_id, amount_cents, entry_type, booking_id, reason, reference)
      values ('${PARENT}', -1200, 'consumption', '10000000-0000-4000-8000-000000000011', 'credit consume', 'pr6:credit:11')
      on conflict (reference) do nothing;
    `);
    seedBooking("10000000-0000-4000-8000-000000000012", { startOffsetMin: -16, trial: true, funding: "free_trial" });
    seedBooking("10000000-0000-4000-8000-000000000013", { startOffsetMin: -16, funding: "payg" });
    sql(`
      insert into payments (id, account_id, purpose, booking_id, gross_cents, stripe_paid_cents, credit_applied_cents, status)
      values ('30000000-0000-4000-8000-000000000013', '${PARENT}', 'booking', '10000000-0000-4000-8000-000000000013', 1200, 1200, 0, 'succeeded')
      on conflict (id) do nothing;
    `);
    sql(`
      insert into study_hall_365_subscriptions (
        id, account_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status,
        current_period_start, current_period_end
      ) values (
        '40000000-0000-4000-8000-000000000014', '${PARENT}', 'cus_pr6', 'sub_pr6', 'price_pr6', 'active',
        now() - interval '2 days', now() + interval '28 days'
      ) on conflict (id) do nothing;
    `);
    seedBooking("10000000-0000-4000-8000-000000000014", { startOffsetMin: -16, funding: "study_hall_365" });
    sql(`
      insert into study_hall_365_day_usage (account_id, subscription_id, local_date, time_zone, booking_id)
      values ('${PARENT}', '40000000-0000-4000-8000-000000000014', (now() at time zone 'America/Chicago')::date, 'America/Chicago', '10000000-0000-4000-8000-000000000014')
      on conflict (account_id, local_date) do update set booking_id = excluded.booking_id;
    `);

    for (const id of [
      "10000000-0000-4000-8000-000000000010",
      "10000000-0000-4000-8000-000000000011",
      "10000000-0000-4000-8000-000000000012",
      "10000000-0000-4000-8000-000000000013",
      "10000000-0000-4000-8000-000000000014",
    ]) {
      sql(asGuide(GUIDE, `select guide_mark_customer_no_show('${id}');`));
    }

    assert.equal(
      sql(`select coalesce(sum(minutes_delta),0)::text from package_minute_ledger where booking_id = '10000000-0000-4000-8000-000000000010' and entry_type = 'restoration'`),
      "0",
    );
    assert.equal(
      sql(`select coalesce(sum(amount_cents),0)::text from dollar_credit_ledger where booking_id = '10000000-0000-4000-8000-000000000011' and entry_type = 'restoration'`),
      "0",
    );
    assert.equal(sql(`select is_free_trial::text from bookings where id = '10000000-0000-4000-8000-000000000012'`), "true");
    assert.equal(sql(`select status::text from bookings where id = '10000000-0000-4000-8000-000000000012'`), "no_show");
    assert.equal(
      sql(`select coalesce(sum(refunded_cents),0)::text from payments where booking_id = '10000000-0000-4000-8000-000000000013'`),
      "0",
    );
    assert.equal(
      sql(`select count(*) from study_hall_365_day_usage where booking_id = '10000000-0000-4000-8000-000000000014'`),
      "1",
    );
  });

  it("35. unauthenticated callers cannot execute the RPC as anon", () => {
    seedBooking("10000000-0000-4000-8000-000000000015", { startOffsetMin: -16 });
    const r = sqlOk(`
      set role anon;
      select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000015');
    `);
    assert.equal(r.ok, false);
  });

  it("A. HTTP join presence commits first, then Guide no-show is rejected", () => {
    seedBooking("10000000-0000-4000-8000-000000000016", { startOffsetMin: -16 });
    const fin = sql(`select finalize_http_session_join('10000000-0000-4000-8000-000000000016', 'student');`);
    assert.match(fin, /"ok"\s*:\s*true/);
    assert.equal(
      sql(`select (student_first_joined_at is not null)::text from session_presence where booking_id = '10000000-0000-4000-8000-000000000016'`),
      "true",
    );
    const again = sql(`select finalize_http_session_join('10000000-0000-4000-8000-000000000016', 'student');`);
    assert.match(again, /"ok"\s*:\s*true/);
    const r = sqlOk(asGuide(GUIDE, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000016');`));
    assert.equal(r.ok, false);
    assert.match(r.out, /already joined/);
    assert.equal(sql(`select status::text from bookings where id = '10000000-0000-4000-8000-000000000016'`), "confirmed");
  });

  it("B. no-show wins: HTTP join finalize rejects and does not write student presence", () => {
    seedBooking("10000000-0000-4000-8000-000000000017", { startOffsetMin: -16 });
    sql(asGuide(GUIDE, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000017');`));
    assert.equal(sql(`select status::text from bookings where id = '10000000-0000-4000-8000-000000000017'`), "no_show");
    const r = sqlOk(`select finalize_http_session_join('10000000-0000-4000-8000-000000000017', 'student');`);
    assert.equal(r.ok, false);
    assert.match(r.out, /not joinable/);
    assert.equal(
      sql(`select coalesce(student_first_joined_at is not null, false)::text from session_presence where booking_id = '10000000-0000-4000-8000-000000000017'`),
      "false",
    );
  });

  it("C. both orderings are A or B only — never no_show plus student join presence from HTTP finalize", () => {
    seedBooking("10000000-0000-4000-8000-000000000018", { startOffsetMin: -16 });
    sql(`select finalize_http_session_join('10000000-0000-4000-8000-000000000018', 'student');`);
    sqlOk(asGuide(GUIDE, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000018');`));
    const aStatus = sql(`select status::text from bookings where id = '10000000-0000-4000-8000-000000000018'`);
    const aJoined = sql(
      `select (student_first_joined_at is not null)::text from session_presence where booking_id = '10000000-0000-4000-8000-000000000018'`,
    );
    assert.equal(aStatus, "confirmed");
    assert.equal(aJoined, "true");

    seedBooking("10000000-0000-4000-8000-000000000019", { startOffsetMin: -16 });
    sql(asGuide(GUIDE, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000019');`));
    sqlOk(`select finalize_http_session_join('10000000-0000-4000-8000-000000000019', 'student');`);
    const bStatus = sql(`select status::text from bookings where id = '10000000-0000-4000-8000-000000000019'`);
    const bJoined = sql(
      `select coalesce((select student_first_joined_at is not null from session_presence where booking_id = '10000000-0000-4000-8000-000000000019'), false)::text`,
    );
    assert.equal(bStatus, "no_show");
    assert.equal(bJoined, "false");
  });

  it("E. late record_session_presence after no_show is a harmless no-op", () => {
    seedBooking("10000000-0000-4000-8000-000000000020", { startOffsetMin: -16 });
    sql(asGuide(GUIDE, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000020');`));
    sql(`select record_session_presence('10000000-0000-4000-8000-000000000020', 'student', 'join');`);
    assert.equal(sql(`select status::text from bookings where id = '10000000-0000-4000-8000-000000000020'`), "no_show");
    assert.equal(
      sql(`select coalesce((select student_first_joined_at is not null from session_presence where booking_id = '10000000-0000-4000-8000-000000000020'), false)::text`),
      "false",
    );
  });

  it("F. Guide HTTP join presence does not eject or change no-show economics", () => {
    seedBooking("10000000-0000-4000-8000-000000000021", { startOffsetMin: -16 });
    sql(`select finalize_http_session_join('10000000-0000-4000-8000-000000000021', 'tutor');`);
    assert.equal(
      sql(`select (tutor_first_joined_at is not null)::text from session_presence where booking_id = '10000000-0000-4000-8000-000000000021'`),
      "true",
    );
    sql(asGuide(GUIDE, `select guide_mark_customer_no_show('10000000-0000-4000-8000-000000000021');`));
    assert.equal(sql(`select status::text from bookings where id = '10000000-0000-4000-8000-000000000021'`), "no_show");
    assert.equal(sql(`select count(*) from tutor_earnings where booking_id = '10000000-0000-4000-8000-000000000021'`), "1");
  });

  it("ACL: anon cannot execute finalize_http_session_join", () => {
    seedBooking("10000000-0000-4000-8000-000000000022", { startOffsetMin: -16 });
    const grants = sql(`
      select has_function_privilege('anon', 'public.finalize_http_session_join(uuid, text)', 'execute')::text
        || ',' || has_function_privilege('authenticated', 'public.finalize_http_session_join(uuid, text)', 'execute')::text
    `);
    assert.equal(grants, "false,true");
    const r = sqlOk(`
      set role anon;
      select finalize_http_session_join('10000000-0000-4000-8000-000000000022', 'student');
    `);
    assert.equal(r.ok, false);
  });
});
