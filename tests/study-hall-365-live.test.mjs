import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PACKAGE_10SH_MINUTES,
  PACKAGE_CODE_10_STUDY_HALLS,
} from "../src/lib/study-hall-365/catalog.mjs";
import {
  adminClient,
  anonClient,
  cleanupAll,
  createUser,
  hasSupabaseEnv,
  isCanonicalDemoProject,
  signIn,
  skipIfPkg10shNotYet99,
} from "./helpers.mjs";

// Configured NEXT_PUBLIC_SUPABASE_URL only. On the locked canonical demo this
// file is SKIP / ENVIRONMENT-BLOCKED (0036 absent; writes refused). Do not
// treat those skips as passes. Authoritative live writes for PR #80 hardening:
// tests/study-hall-365-pg-live.test.mjs against the local throwaway database.
const liveWritesAllowed =
  hasSupabaseEnv &&
  !(isCanonicalDemoProject() && process.env.ALLOW_DEMO_DB_WRITES !== "1") &&
  process.env.DEMO_DB_LOCK !== "1";

async function tablesReady() {
  if (!hasSupabaseEnv) return false;
  const svc = adminClient();
  const { error } = await svc.from("study_hall_365_subscriptions").select("id").limit(1);
  return !error;
}

describe("Study Hall 365 — catalog + RPC presence (live, read-only)", { skip: !hasSupabaseEnv }, () => {
  const svc = adminClient();

  it("pkg_10sh is 600 minutes / $99 when migration 0048 is applied", async (t) => {
    const { data, error } = await svc
      .from("package_products")
      .select("code, minutes, price_cents, is_active")
      .eq("code", PACKAGE_CODE_10_STUDY_HALLS)
      .maybeSingle();
    if (error || !data) {
      t.skip("ENVIRONMENT/BLOCKED: pkg_10sh not in this database yet");
      return;
    }
    assert.equal(data.minutes, PACKAGE_10SH_MINUTES);
    if (skipIfPkg10shNotYet99(t, data)) return;
    assert.equal(data.price_cents, 9900);
    assert.equal(data.is_active, true);
  });

  it("historical pkg_10h remains $190 / inactive (legacy compatibility)", async () => {
    const { data } = await svc
      .from("package_products")
      .select("code, minutes, price_cents, is_active")
      .eq("code", "pkg_10h")
      .maybeSingle();
    if (!data) return;
    assert.equal(data.minutes, 600);
    assert.equal(data.price_cents, 19000);
    assert.equal(data.is_active, false);
  });
});

describe(
  "Study Hall 365 — live write tests",
  { skip: !liveWritesAllowed },
  () => {
    it("concurrency, replay, lifecycle, legacy balance, security", async (t) => {
      if (!(await tablesReady())) {
        t.skip("ENVIRONMENT/BLOCKED: 0036 tables not applied");
        return;
      }

      const svc = adminClient();
      const parent = await createUser({ requestedRole: "student", displayName: "365 Parent" });
      const other = await createUser({ requestedRole: "student", displayName: "365 Other" });
      const guide = await createUser({ requestedRole: "tutor", displayName: "365 Guide" });

      try {
        const periodStart = new Date("2026-09-17T16:00:00.000Z").toISOString();
        const periodEnd = new Date("2026-10-17T16:00:00.000Z").toISOString();

        const first = await svc.rpc("upsert_study_hall_365_subscription", {
          p_account: parent.id,
          p_stripe_customer_id: "cus_test_365",
          p_stripe_subscription_id: "sub_test_365",
          p_stripe_price_id: "price_test_365",
          p_status: "active",
          p_period_start: periodStart,
          p_period_end: periodEnd,
          p_cancel_at_period_end: false,
          p_canceled_at: null,
          p_ended_at: null,
          p_latest_invoice_id: "in_1",
          p_event_id: "evt_1",
          p_event_created: 100,
          p_payment_id: null,
        });
        assert.equal(first.error, null, first.error?.message);
        assert.ok(["inserted", "updated"].includes(first.data.status));

        const replay = await svc.rpc("upsert_study_hall_365_subscription", {
          p_account: parent.id,
          p_stripe_customer_id: "cus_test_365",
          p_stripe_subscription_id: "sub_test_365",
          p_stripe_price_id: "price_test_365",
          p_status: "active",
          p_period_start: periodStart,
          p_period_end: periodEnd,
          p_cancel_at_period_end: false,
          p_canceled_at: null,
          p_ended_at: null,
          p_latest_invoice_id: "in_1",
          p_event_id: "evt_1_replay",
          p_event_created: 100,
          p_payment_id: null,
        });
        assert.equal(replay.error, null, replay.error?.message);
        const { count: subCount } = await svc
          .from("study_hall_365_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("account_id", parent.id);
        assert.equal(subCount, 1);

        const stale = await svc.rpc("upsert_study_hall_365_subscription", {
          p_account: parent.id,
          p_stripe_customer_id: "cus_test_365",
          p_stripe_subscription_id: "sub_test_365",
          p_stripe_price_id: "price_old",
          p_status: "past_due",
          p_period_start: periodStart,
          p_period_end: periodEnd,
          p_cancel_at_period_end: false,
          p_canceled_at: null,
          p_ended_at: null,
          p_latest_invoice_id: "in_old",
          p_event_id: "evt_stale",
          p_event_created: 50,
          p_payment_id: null,
        });
        assert.equal(stale.data.status, "skipped_stale");
        const { data: afterStale } = await svc
          .from("study_hall_365_subscriptions")
          .select("status")
          .eq("account_id", parent.id)
          .single();
        assert.equal(afterStale.status, "active");

        const asOf = "2026-09-20T18:00:00.000Z";
        const [a, b] = await Promise.all([
          svc.rpc("consume_study_hall_365_day", {
            p_account: parent.id,
            p_local_date: "2026-09-20",
            p_booking_id: null,
            p_as_of: asOf,
          }),
          svc.rpc("consume_study_hall_365_day", {
            p_account: parent.id,
            p_local_date: "2026-09-20",
            p_booking_id: null,
            p_as_of: asOf,
          }),
        ]);
        const results = [a.data, b.data];
        assert.equal(results.filter((r) => r?.ok).length, 1);
        assert.equal(results.filter((r) => r?.reason === "already_consumed").length, 1);
        const { count: usageCount } = await svc
          .from("study_hall_365_day_usage")
          .select("id", { count: "exact", head: true })
          .eq("account_id", parent.id)
          .eq("local_date", "2026-09-20");
        assert.equal(usageCount, 1);

        const nextDay = await svc.rpc("consume_study_hall_365_day", {
          p_account: parent.id,
          p_local_date: "2026-09-21",
          p_as_of: "2026-09-21T18:00:00.000Z",
        });
        assert.equal(nextDay.data.ok, true);

        const unusedRollover = await svc.rpc("get_study_hall_365_entitlement", {
          p_account: parent.id,
          p_local_date: "2026-09-19",
          p_as_of: "2026-09-21T18:00:00.000Z",
        });
        assert.equal(unusedRollover.data.consumed, false);
        assert.equal(unusedRollover.data.entitled, true);

        await svc.rpc("upsert_study_hall_365_subscription", {
          p_account: parent.id,
          p_stripe_customer_id: "cus_test_365",
          p_stripe_subscription_id: "sub_test_365",
          p_stripe_price_id: "price_test_365",
          p_status: "canceled",
          p_period_start: periodStart,
          p_period_end: periodEnd,
          p_cancel_at_period_end: true,
          p_canceled_at: "2026-09-22T00:00:00.000Z",
          p_ended_at: null,
          p_latest_invoice_id: "in_2",
          p_event_id: "evt_cancel",
          p_event_created: 200,
          p_payment_id: null,
        });
        const stillIn = await svc.rpc("get_study_hall_365_entitlement", {
          p_account: parent.id,
          p_local_date: "2026-09-23",
          p_as_of: "2026-09-23T18:00:00.000Z",
        });
        assert.equal(stillIn.data.entitled, true);

        const afterEnd = await svc.rpc("get_study_hall_365_entitlement", {
          p_account: parent.id,
          p_local_date: "2026-10-18",
          p_as_of: "2026-10-18T18:00:00.000Z",
        });
        assert.equal(afterEnd.data.entitled, false);

        const stillConsumed = await svc.rpc("get_study_hall_365_entitlement", {
          p_account: parent.id,
          p_local_date: "2026-09-20",
          p_as_of: "2026-09-23T18:00:00.000Z",
        });
        assert.equal(stillConsumed.data.consumed, true);
        assert.equal(stillConsumed.data.entitled, false);

        const failed = await svc.rpc("upsert_study_hall_365_subscription", {
          p_account: parent.id,
          p_stripe_customer_id: "cus_test_365",
          p_stripe_subscription_id: "sub_test_365",
          p_stripe_price_id: "price_test_365",
          p_status: "past_due",
          p_period_start: periodStart,
          p_period_end: periodEnd,
          p_cancel_at_period_end: false,
          p_canceled_at: null,
          p_ended_at: null,
          p_latest_invoice_id: "in_fail",
          p_event_id: "evt_fail",
          p_event_created: 300,
          p_payment_id: null,
        });
        assert.equal(failed.error, null, failed.error?.message);
        const pastDue = await svc.rpc("get_study_hall_365_entitlement", {
          p_account: parent.id,
          p_local_date: "2026-09-24",
          p_as_of: "2026-09-24T18:00:00.000Z",
        });
        assert.equal(pastDue.data.entitled, false);
        assert.equal(pastDue.data.reason, "status_not_entitled");

        const renewal = await svc.rpc("upsert_study_hall_365_subscription", {
          p_account: parent.id,
          p_stripe_customer_id: "cus_test_365",
          p_stripe_subscription_id: "sub_test_365",
          p_stripe_price_id: "price_test_365",
          p_status: "active",
          p_period_start: "2026-10-17T16:00:00.000Z",
          p_period_end: "2026-11-17T16:00:00.000Z",
          p_cancel_at_period_end: false,
          p_canceled_at: null,
          p_ended_at: null,
          p_latest_invoice_id: "in_renew",
          p_event_id: "evt_renew",
          p_event_created: 400,
          p_payment_id: null,
        });
        assert.equal(renewal.data.status, "updated");

        const dup = await svc.rpc("upsert_study_hall_365_subscription", {
          p_account: parent.id,
          p_stripe_customer_id: "cus_test_365b",
          p_stripe_subscription_id: "sub_test_365_dup",
          p_stripe_price_id: "price_test_365",
          p_status: "active",
          p_period_start: "2026-10-17T16:00:00.000Z",
          p_period_end: "2026-11-17T16:00:00.000Z",
          p_cancel_at_period_end: false,
          p_canceled_at: null,
          p_ended_at: null,
          p_latest_invoice_id: "in_dup",
          p_event_id: "evt_dup",
          p_event_created: 500,
          p_payment_id: null,
        });
        assert.ok(dup.error, "second open membership must be rejected");

        const open = await svc.rpc("start_study_hall_365_checkout", { p_account: parent.id });
        assert.ok(open.error, "checkout must refuse an open membership");

        // Legacy prepaid minutes survive; 10-pack credits 600 once.
        const { error: ledErr } = await svc.from("package_minute_ledger").insert({
          account_id: parent.id,
          minutes_delta: 420,
          entry_type: "admin_adjustment",
          reason: "legacy balance fixture",
          reference: `legacy-365-${parent.id}`,
        });
        assert.equal(ledErr, null, ledErr?.message);
        const issued = await svc.rpc("issue_package_minutes", {
          p_account: parent.id,
          p_minutes: 600,
          p_reference: `pkgissue:tenpack-${parent.id}`,
          p_reason: "10 Study Halls",
        });
        assert.equal(issued.error, null, issued.error?.message);
        const replayCredit = await svc.rpc("issue_package_minutes", {
          p_account: parent.id,
          p_minutes: 600,
          p_reference: `pkgissue:tenpack-${parent.id}`,
          p_reason: "10 Study Halls replay",
        });
        assert.equal(replayCredit.error, null, replayCredit.error?.message);
        const { data: ledgers } = await svc
          .from("package_minute_ledger")
          .select("minutes_delta, reference")
          .eq("account_id", parent.id)
          .order("created_at");
        const sum = (ledgers ?? []).reduce((n, r) => n + r.minutes_delta, 0);
        assert.equal(sum, 1020);
        assert.ok((ledgers ?? []).some((r) => r.reference === `legacy-365-${parent.id}` && r.minutes_delta === 420));
        assert.equal((ledgers ?? []).filter((r) => r.reference === `pkgissue:tenpack-${parent.id}`).length, 1);

        const parentClient = await signIn(parent.email, parent.password);
        const otherClient = await signIn(other.email, other.password);
        const guideClient = await signIn(guide.email, guide.password);
        const anon = anonClient();

        const { data: own } = await parentClient
          .from("study_hall_365_subscriptions")
          .select("account_id, status, stripe_subscription_id, stripe_customer_id, stripe_price_id")
          .eq("account_id", parent.id);
        assert.equal((own ?? []).length, 0, "parents must not SELECT raw subscription rows");

        const ownMembership = await parentClient.rpc("get_study_hall_365_membership", {
          p_account: parent.id,
        });
        assert.equal(ownMembership.error, null, ownMembership.error?.message);
        const memJson = JSON.stringify(ownMembership.data ?? {});
        assert.match(memJson, /entitled|customer_status/);
        assert.doesNotMatch(memJson, /stripe_subscription_id|stripe_customer_id|stripe_price_id|cus_test|sub_test/);

        const { data: peek } = await otherClient
          .from("study_hall_365_subscriptions")
          .select("account_id")
          .eq("account_id", parent.id);
        assert.equal((peek ?? []).length, 0);
        const otherMem = await otherClient.rpc("get_study_hall_365_membership", {
          p_account: parent.id,
        });
        assert.ok(otherMem.error, "Parent B cannot read Parent A membership");

        const { data: guidePeek } = await guideClient
          .from("study_hall_365_subscriptions")
          .select("account_id")
          .eq("account_id", parent.id);
        assert.equal((guidePeek ?? []).length, 0);

        const steal = await otherClient.rpc("consume_study_hall_365_day", {
          p_account: parent.id,
          p_local_date: "2026-09-25",
        });
        assert.ok(steal.error, "parent B / authenticated caller cannot consume");

        const forge = await parentClient
          .from("study_hall_365_subscriptions")
          .update({ status: "active" })
          .eq("account_id", parent.id)
          .select("id");
        assert.ok(forge.error || (forge.data ?? []).length === 0, "client cannot write subscription status");

        const unauth = await anon.rpc("start_study_hall_365_checkout", { p_account: parent.id });
        assert.ok(unauth.error, "unauthenticated caller cannot start a 365 checkout");
      } finally {
        await cleanupAll();
      }
    });
  },
);
