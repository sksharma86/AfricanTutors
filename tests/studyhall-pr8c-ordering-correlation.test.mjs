import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import Stripe from "stripe";

import { STUDY_HALL_365_KIND, STUDY_HALL_365_MONTHLY_CENTS } from "../src/lib/study-hall-365/catalog.mjs";
import {
  applyStudyHall365MembershipSnapshot,
  correlatedStudyHall365PaymentId,
  isStaleStripeEvent,
  paymentMatchesStudyHall365Checkout,
  reconcileStudyHall365WebhookSnapshot,
  shouldFulfillStudyHall365CheckoutPayment,
} from "../src/lib/stripe/study-hall-365-webhook-policy.mjs";
import {
  processVerifiedStripeEvent,
  stripeCheckoutKind,
} from "../src/lib/stripe/webhook-dispatch.mjs";
import { verifyStripeWebhookEvent } from "../src/lib/stripe/webhook-verify.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const WEBHOOK_SECRET = "whsec_pr8c_order_audit";

const ACCOUNT_A = "acct_a";
const ACCOUNT_B = "acct_b";
const CUSTOMER_A = "cus_a";
const CUSTOMER_B = "cus_b";
const SUB_A = "sub_a";
const PAY_A = "pay_a";
const PAY_B = "pay_b";
const SESSION_A = "cs_a";
const SESSION_B = "cs_b";

function paymentRow(overrides = {}) {
  return {
    id: PAY_A,
    account_id: ACCOUNT_A,
    purpose: "subscription",
    stripe_customer_id: CUSTOMER_A,
    stripe_checkout_session_id: SESSION_A,
    status: "requires_payment",
    gross_cents: STUDY_HALL_365_MONTHLY_CENTS,
    ...overrides,
  };
}

function subSnapshot(overrides = {}) {
  return {
    id: SUB_A,
    status: "active",
    customer: CUSTOMER_A,
    cancel_at_period_end: false,
    metadata: { payment_id: PAY_A, account_id: ACCOUNT_A },
    ...overrides,
    metadata: {
      payment_id: PAY_A,
      account_id: ACCOUNT_A,
      ...(overrides.metadata ?? {}),
    },
  };
}

/**
 * Models production: retrieve live Stripe, apply with event.created, maybe fulfill.
 * Payment row mutates only when fulfill is allowed. Throws after apply when asked,
 * so retry with the same event.created can still fulfill.
 */
function runLifecycle(state, event, retrieved, extra = {}) {
  if (extra.retrieveThrows) throw new Error("stripe_retrieve_failed");
  const result = reconcileStudyHall365WebhookSnapshot({
    membership: state.membership,
    event,
    retrievedSubscription: retrieved,
    payment: state.payment,
    explicitPaymentId: extra.explicitPaymentId,
    ended: extra.ended ?? event.type === "customer.subscription.deleted",
  });
  if (result.apply.status !== "skipped_stale") {
    state.membership = result.apply.row;
  }
  if (result.fulfill) {
    if (extra.fulfillThrows) throw new Error("fulfill_rpc_failed");
    if (state.payment.status === "succeeded") {
      state.lastFulfill = "already_fulfilled";
    } else {
      state.payment.status = "succeeded";
      state.fulfillCount += 1;
      state.lastFulfill = "fulfilled";
    }
  } else {
    state.lastFulfill = "skipped";
  }
  if (extra.notifyThrows) {
    state.notifyAttempts += 1;
    throw new Error("notify_failed");
  }
  state.notifyAttempts += extra.notify ? 1 : 0;
  return result;
}

function recordingDeps() {
  const calls = [];
  const claims = new Map();
  const deps = {
    beginStripeEvent: async (id, type) => {
      calls.push(["begin", id, type]);
      const prev = claims.get(id);
      if (prev === "completed") return "duplicate";
      if (prev === "claimed") return "in_progress";
      claims.set(id, "claimed");
      return "claimed";
    },
    completeStripeEvent: async (id) => {
      calls.push(["complete", id]);
      claims.set(id, "completed");
    },
    failStripeEvent: async (id, error) => {
      calls.push(["fail", id, error]);
      claims.delete(id);
    },
    fulfillFromMetadata: async (metadata, amount) => {
      calls.push(["fulfill", stripeCheckoutKind(metadata), metadata?.payment_id, amount]);
    },
    fulfillStudyHall365Checkout: async (session, event) => {
      calls.push(["fulfill365", session.metadata?.payment_id, event.id, event.type]);
    },
    isStudyHall365Session: (session) =>
      session.mode === "subscription" && session.metadata?.kind === STUDY_HALL_365_KIND,
    syncSubscriptionById: async (params) => {
      calls.push(["syncSub", params.subscriptionId, params.ended ?? false, params.eventCreated, params.eventId]);
    },
    syncFromInvoice: async (invoice, event) => {
      calls.push(["syncInvoice", invoice.id, event.type, event.created, event.id]);
    },
    cancelFromMetadata: async (metadata, reason) => {
      calls.push(["cancel", stripeCheckoutKind(metadata), metadata?.payment_id, reason]);
    },
  };
  return { calls, claims, deps };
}

function checkoutSessionEvent(overrides = {}) {
  const session = {
    id: SESSION_A,
    object: "checkout.session",
    mode: "subscription",
    payment_status: "paid",
    amount_total: STUDY_HALL_365_MONTHLY_CENTS,
    payment_intent: "pi_365",
    customer: CUSTOMER_A,
    subscription: SUB_A,
    metadata: { kind: STUDY_HALL_365_KIND, payment_id: PAY_A, account_id: ACCOUNT_A },
    ...overrides.session,
  };
  return {
    id: overrides.id ?? "evt_cs",
    object: "event",
    type: overrides.type ?? "checkout.session.async_payment_succeeded",
    created: overrides.created ?? 300,
    data: { object: session },
  };
}

describe("PR8C audit — event-id idempotency vs event-created ordering", () => {
  it("same Stripe event id is claimed once; a different older event id still reaches sync", async () => {
    const { calls, deps } = recordingDeps();
    const newer = {
      id: "evt_updated_200",
      type: "customer.subscription.updated",
      created: 200,
      data: { object: { id: SUB_A, status: "active", metadata: { account_id: ACCOUNT_A } } },
    };
    const stale = {
      id: "evt_updated_100",
      type: "customer.subscription.updated",
      created: 100,
      data: { object: { id: SUB_A, status: "past_due", metadata: { account_id: ACCOUNT_A } } },
    };
    const first = await processVerifiedStripeEvent(newer, deps);
    const replay = await processVerifiedStripeEvent(newer, deps);
    const late = await processVerifiedStripeEvent(stale, deps);
    assert.equal(first.status, 200);
    assert.equal(replay.body.duplicate, true);
    assert.equal(late.status, 200);
    assert.equal(calls.filter((c) => c[0] === "syncSub").length, 2);
    assert.deepEqual(
      calls.filter((c) => c[0] === "syncSub").map((c) => [c[3], c[4]]),
      [
        [200, "evt_updated_200"],
        [100, "evt_updated_100"],
      ],
    );
  });

  it("SQL and policy treat strictly older created as stale; equal created is a retry", () => {
    const sql = read("supabase/migrations/0044_study_hall_365_lifecycle_snapshot.sql");
    assert.match(sql, /p_event_created.*<.*last_stripe_event_created/);
    assert.doesNotMatch(sql, /p_event_created.*<=.*last_stripe_event_created/);
    assert.equal(isStaleStripeEvent(100, 200), true);
    assert.equal(isStaleStripeEvent(200, 200), false);
    assert.equal(isStaleStripeEvent(300, 200), false);
  });
});

describe("PR8C audit — A: newer active must not be overwritten by stale past_due", () => {
  it("different event ids: created=200 active then created=100 past_due keeps active", () => {
    const state = { membership: null, payment: paymentRow(), fulfillCount: 0, lastFulfill: null, notifyAttempts: 0 };
    const liveActive = subSnapshot({ status: "active" });

    const applied = runLifecycle(state, { id: "evt_u_200", created: 200, type: "customer.subscription.updated" }, liveActive);
    assert.equal(applied.apply.status, "inserted");
    assert.equal(state.membership.status, "active");
    assert.equal(state.fulfillCount, 1);

    // Retrieve now reports past_due (Stripe moved), but the event is older.
    const stale = runLifecycle(
      state,
      { id: "evt_u_100", created: 100, type: "customer.subscription.updated" },
      subSnapshot({ status: "past_due" }),
    );
    assert.equal(stale.apply.status, "skipped_stale");
    assert.equal(state.membership.status, "active");
    assert.equal(state.membership.lastStripeEventCreated, 200);
    assert.equal(state.fulfillCount, 1);
    assert.equal(state.lastFulfill, "skipped");
  });
});

describe("PR8C audit — B: deleted then stale updated must not resurrect", () => {
  it("deleted created=300 then stale updated created=200 active stays ended", () => {
    const state = { membership: null, payment: paymentRow(), fulfillCount: 0, lastFulfill: null, notifyAttempts: 0 };
    runLifecycle(
      state,
      { id: "evt_del_300", created: 300, type: "customer.subscription.deleted" },
      subSnapshot({ status: "canceled", cancel_at_period_end: false }),
      { ended: true },
    );
    assert.equal(state.membership.status, "canceled");
    assert.equal(state.membership.ended, true);
    assert.equal(state.fulfillCount, 0);

    const resurrect = runLifecycle(
      state,
      { id: "evt_u_200", created: 200, type: "customer.subscription.updated" },
      subSnapshot({ status: "active" }),
    );
    assert.equal(resurrect.apply.status, "skipped_stale");
    assert.equal(state.membership.status, "canceled");
    assert.equal(state.membership.ended, true);
    assert.equal(resurrect.fulfill, false);
    assert.equal(state.payment.status, "requires_payment");
  });
});

describe("PR8C audit — C/D: invoice paid vs payment_failed ordering", () => {
  it("C: payment_failed created=300 then stale invoice.paid created=200 does not restore or fulfill", () => {
    const state = { membership: null, payment: paymentRow(), fulfillCount: 0, lastFulfill: null, notifyAttempts: 0 };
    runLifecycle(
      state,
      { id: "evt_fail_300", created: 300, type: "invoice.payment_failed" },
      subSnapshot({ status: "past_due" }),
    );
    assert.equal(state.membership.status, "past_due");
    assert.equal(state.fulfillCount, 0);

    const stalePaid = runLifecycle(
      state,
      { id: "evt_paid_200", created: 200, type: "invoice.paid" },
      subSnapshot({ status: "active" }),
    );
    assert.equal(stalePaid.apply.status, "skipped_stale");
    assert.equal(state.membership.status, "past_due");
    assert.equal(stalePaid.fulfill, false);
    assert.equal(state.payment.status, "requires_payment");
  });

  it("D: invoice.paid created=300 then stale payment_failed created=200 does not downgrade", () => {
    const state = { membership: null, payment: paymentRow(), fulfillCount: 0, lastFulfill: null, notifyAttempts: 0 };
    runLifecycle(
      state,
      { id: "evt_paid_300", created: 300, type: "invoice.paid" },
      subSnapshot({ status: "active" }),
    );
    assert.equal(state.membership.status, "active");
    assert.equal(state.fulfillCount, 1);

    const staleFail = runLifecycle(
      state,
      { id: "evt_fail_200", created: 200, type: "invoice.payment_failed" },
      subSnapshot({ status: "past_due" }),
    );
    assert.equal(staleFail.apply.status, "skipped_stale");
    assert.equal(state.membership.status, "active");
    assert.equal(state.fulfillCount, 1);
    assert.equal(state.payment.status, "succeeded");
  });

  it("dispatcher forwards both invoice types with their own event ids and created timestamps", async () => {
    const { calls, deps } = recordingDeps();
    await processVerifiedStripeEvent(
      { id: "evt_in_fail", type: "invoice.payment_failed", created: 300, data: { object: { id: "in_2", subscription: SUB_A } } },
      deps,
    );
    await processVerifiedStripeEvent(
      { id: "evt_in_paid", type: "invoice.paid", created: 200, data: { object: { id: "in_1", subscription: SUB_A } } },
      deps,
    );
    assert.deepEqual(
      calls.filter((c) => c[0] === "syncInvoice").map((c) => [c[2], c[3], c[4]]),
      [
        ["invoice.payment_failed", 300, "evt_in_fail"],
        ["invoice.paid", 200, "evt_in_paid"],
      ],
    );
  });
});

describe("PR8C audit — E/F: cancel_at_period_end vs resume ordering", () => {
  it("E: scheduled cancel then older cancel_at_period_end=false cannot erase it", () => {
    const state = { membership: null, payment: paymentRow({ status: "succeeded" }), fulfillCount: 0, lastFulfill: null, notifyAttempts: 0 };
    runLifecycle(
      state,
      { id: "evt_cancel_sched", created: 400, type: "customer.subscription.updated" },
      subSnapshot({ status: "active", cancel_at_period_end: true }),
    );
    assert.equal(state.membership.cancelAtPeriodEnd, true);

    const stale = runLifecycle(
      state,
      { id: "evt_old_no_cancel", created: 250, type: "customer.subscription.updated" },
      subSnapshot({ status: "active", cancel_at_period_end: false }),
    );
    assert.equal(stale.apply.status, "skipped_stale");
    assert.equal(state.membership.cancelAtPeriodEnd, true);
  });

  it("F: newer resume then stale cancellation cannot re-schedule cancel", () => {
    const state = { membership: null, payment: paymentRow({ status: "succeeded" }), fulfillCount: 0, lastFulfill: null, notifyAttempts: 0 };
    runLifecycle(
      state,
      { id: "evt_cancel", created: 400, type: "customer.subscription.updated" },
      subSnapshot({ status: "active", cancel_at_period_end: true }),
    );
    runLifecycle(
      state,
      { id: "evt_resume", created: 500, type: "customer.subscription.updated" },
      subSnapshot({ status: "active", cancel_at_period_end: false }),
    );
    assert.equal(state.membership.cancelAtPeriodEnd, false);
    assert.equal(state.membership.lastStripeEventCreated, 500);

    const staleCancel = runLifecycle(
      state,
      { id: "evt_stale_cancel", created: 450, type: "customer.subscription.updated" },
      subSnapshot({ status: "active", cancel_at_period_end: true }),
    );
    assert.equal(staleCancel.apply.status, "skipped_stale");
    assert.equal(state.membership.cancelAtPeriodEnd, false);
  });
});

describe("PR8C audit — retrieve-on-stale", () => {
  it("live retrieve of active + stale event.created skips membership and does not fulfill", () => {
    const state = { membership: null, payment: paymentRow(), fulfillCount: 0, lastFulfill: null, notifyAttempts: 0 };
    runLifecycle(state, { id: "evt_200", created: 200, type: "customer.subscription.updated" }, subSnapshot({ status: "active" }));
    const staleLive = runLifecycle(
      state,
      { id: "evt_100", created: 100, type: "customer.subscription.updated" },
      subSnapshot({ status: "active" }),
    );
    assert.equal(staleLive.apply.status, "skipped_stale");
    assert.equal(staleLive.fulfill, false);
    assert.equal(state.fulfillCount, 1);
  });

  it("stripe-sync still retrieves then stamps event.created; skipped_stale gates fulfill", () => {
    const sync = read("src/lib/study-hall-365/stripe-sync.ts");
    assert.match(sync, /subscriptions\.retrieve/);
    assert.match(sync, /p_event_created: params\.eventCreated/);
    assert.match(sync, /applyStatus: upsert\.status/);
    assert.match(sync, /skipped_stale/);
    const lifecycle = read("src/lib/notifications/study-hall-365-lifecycle.mjs");
    assert.match(lifecycle, /skipped_stale/);
  });
});

describe("PR8C audit — 365 payment-row correlation", () => {
  it("A/B: originating payment_id + account + customer + purpose=subscription", () => {
    const pay = paymentRow();
    assert.equal(
      paymentMatchesStudyHall365Checkout(pay, {
        paymentId: PAY_A,
        accountId: ACCOUNT_A,
        customerId: CUSTOMER_A,
        checkoutSessionId: SESSION_A,
      }),
      true,
    );
    assert.equal(correlatedStudyHall365PaymentId({ subscriptionPaymentId: PAY_A, explicitPaymentId: PAY_A }), PAY_A);
  });

  it("C/H: unrelated account or Customer B cannot fulfill Customer A's payment", () => {
    const pay = paymentRow();
    assert.equal(
      shouldFulfillStudyHall365CheckoutPayment({
        applyStatus: "updated",
        subscriptionStatus: "active",
        payment: pay,
        accountId: ACCOUNT_B,
        customerId: CUSTOMER_A,
        paymentId: PAY_A,
      }),
      false,
    );
    assert.equal(
      shouldFulfillStudyHall365CheckoutPayment({
        applyStatus: "updated",
        subscriptionStatus: "active",
        payment: pay,
        accountId: ACCOUNT_A,
        customerId: CUSTOMER_B,
        paymentId: PAY_A,
      }),
      false,
    );
  });

  it("D: old 365 subscription cannot fulfill a new abandoned Checkout payment", () => {
    const newPay = paymentRow({ id: PAY_B, stripe_checkout_session_id: SESSION_B });
    const result = reconcileStudyHall365WebhookSnapshot({
      membership: null,
      event: { id: "evt_old_sub", created: 900, type: "customer.subscription.updated" },
      retrievedSubscription: subSnapshot({ metadata: { payment_id: PAY_A, account_id: ACCOUNT_A } }),
      payment: newPay,
      explicitPaymentId: PAY_B,
    });
    assert.equal(result.paymentId, null);
    assert.equal(result.fulfill, false);
  });

  it("E: two concurrent Checkout attempts cannot cross-fulfill", () => {
    const payB = paymentRow({ id: PAY_B, stripe_checkout_session_id: SESSION_B });
    assert.equal(
      correlatedStudyHall365PaymentId({ subscriptionPaymentId: PAY_A, explicitPaymentId: PAY_B }),
      null,
    );
    assert.equal(
      shouldFulfillStudyHall365CheckoutPayment({
        applyStatus: "inserted",
        subscriptionStatus: "active",
        payment: payB,
        accountId: ACCOUNT_A,
        customerId: CUSTOMER_A,
        paymentId: PAY_A,
        checkoutSessionId: SESSION_A,
      }),
      false,
    );
    assert.equal(
      paymentMatchesStudyHall365Checkout(payB, {
        paymentId: PAY_B,
        accountId: ACCOUNT_A,
        customerId: CUSTOMER_A,
        checkoutSessionId: SESSION_A,
      }),
      false,
    );
  });

  it("F: replayed subscription.updated cannot fulfill an unrelated payment", () => {
    const unrelated = paymentRow({ id: PAY_B, stripe_checkout_session_id: SESSION_B });
    const result = reconcileStudyHall365WebhookSnapshot({
      membership: {
        accountId: ACCOUNT_A,
        lastStripeEventCreated: 200,
        status: "active",
        subscriptionId: SUB_A,
      },
      event: { id: "evt_replay_other", created: 201, type: "customer.subscription.updated" },
      retrievedSubscription: subSnapshot({ metadata: { payment_id: PAY_A, account_id: ACCOUNT_A } }),
      payment: unrelated,
    });
    assert.equal(result.paymentId, PAY_A);
    assert.equal(result.fulfill, false);
  });

  it("G: manual Stripe subscription without our payment_id does not fulfill a pending Checkout", () => {
    const result = reconcileStudyHall365WebhookSnapshot({
      membership: null,
      event: { id: "evt_manual", created: 50, type: "customer.subscription.created" },
      retrievedSubscription: {
        id: "sub_manual",
        status: "active",
        customer: CUSTOMER_A,
        cancel_at_period_end: false,
        metadata: { account_id: ACCOUNT_A },
      },
      payment: paymentRow(),
    });
    assert.equal(result.paymentId, null);
    assert.equal(result.fulfill, false);
  });

  it("I: purpose must be subscription; booking/package rows are refused", () => {
    assert.equal(
      paymentMatchesStudyHall365Checkout(paymentRow({ purpose: "booking" }), {
        paymentId: PAY_A,
        accountId: ACCOUNT_A,
        customerId: CUSTOMER_A,
      }),
      false,
    );
    assert.equal(
      paymentMatchesStudyHall365Checkout(paymentRow({ purpose: "package" }), {
        paymentId: PAY_A,
        accountId: ACCOUNT_A,
        customerId: CUSTOMER_A,
      }),
      false,
    );
    const sql = read("supabase/migrations/0036_study_hall_365.sql");
    assert.match(sql, /purpose is distinct from 'subscription'/);
    assert.match(sql, /v_cents constant integer := 14900/);
    assert.doesNotMatch(sql, /p_amount_cents <> v_expected/);
  });

  it("J: already_fulfilled stays idempotent on a second entitled apply", () => {
    const state = { membership: null, payment: paymentRow(), fulfillCount: 0, lastFulfill: null, notifyAttempts: 0 };
    runLifecycle(state, { id: "evt_1", created: 300, type: "customer.subscription.updated" }, subSnapshot());
    runLifecycle(state, { id: "evt_1_retry", created: 300, type: "customer.subscription.updated" }, subSnapshot());
    assert.equal(state.fulfillCount, 1);
    assert.equal(state.lastFulfill, "already_fulfilled");
    assert.equal(state.payment.status, "succeeded");
    const sql = read("supabase/migrations/0036_study_hall_365.sql");
    assert.match(sql, /already_fulfilled/);
  });

  it("never looks up latest pending 365 payment by account", () => {
    const sync = read("src/lib/study-hall-365/stripe-sync.ts");
    const helper = sync.slice(sync.indexOf("async function maybeFulfillStudyHall365CheckoutPayment"));
    const body = helper.slice(0, helper.indexOf("export async function syncSubscriptionById"));
    assert.match(body, /\.eq\("id", paymentId\)/);
    assert.doesNotMatch(body, /purpose.*subscription[\s\S]*order by created_at/);
    assert.doesNotMatch(read("src/lib/stripe/study-hall-365-webhook-policy.mjs"), /order by created_at/);
  });
});

describe("PR8C audit — async_payment_succeeded", () => {
  it("correct 365 Checkout is fulfilled; PAYG and pkg_10sh stay on their own authority", async () => {
    const { calls, deps } = recordingDeps();
    await processVerifiedStripeEvent(checkoutSessionEvent({ id: "evt_365_async" }), deps);
    await processVerifiedStripeEvent(
      {
        id: "evt_payg_async",
        type: "checkout.session.async_payment_succeeded",
        created: 301,
        data: {
          object: {
            mode: "payment",
            payment_status: "paid",
            amount_total: 1200,
            metadata: { kind: "booking", payment_id: "pay_payg" },
          },
        },
      },
      deps,
    );
    await processVerifiedStripeEvent(
      {
        id: "evt_pkg_async",
        type: "checkout.session.async_payment_succeeded",
        created: 302,
        data: {
          object: {
            mode: "payment",
            payment_status: "paid",
            amount_total: 10000,
            metadata: { kind: "package", payment_id: "pay_pkg" },
          },
        },
      },
      deps,
    );
    assert.deepEqual(
      calls.filter((c) => c[0] === "fulfill365").map((c) => c[1]),
      [PAY_A],
    );
    assert.deepEqual(
      calls.filter((c) => c[0] === "fulfill").map((c) => [c[1], c[2], c[3]]),
      [
        ["booking", "pay_payg", 1200],
        ["package", "pay_pkg", 10000],
      ],
    );
  });

  it("duplicate async success is a no-op at the event-id layer", async () => {
    const { calls, deps } = recordingDeps();
    const event = checkoutSessionEvent({ id: "evt_365_async_dup" });
    await processVerifiedStripeEvent(event, deps);
    const second = await processVerifiedStripeEvent(event, deps);
    assert.equal(second.body.duplicate, true);
    assert.equal(calls.filter((c) => c[0] === "fulfill365").length, 1);
  });

  it("async success after another 365 lifecycle event is a second event id (SQL already_fulfilled)", async () => {
    const { calls, deps } = recordingDeps();
    await processVerifiedStripeEvent(
      {
        id: "evt_sub_updated",
        type: "customer.subscription.updated",
        created: 280,
        data: { object: { id: SUB_A, metadata: { account_id: ACCOUNT_A, payment_id: PAY_A } } },
      },
      deps,
    );
    await processVerifiedStripeEvent(checkoutSessionEvent({ id: "evt_365_async_after", created: 310 }), deps);
    assert.equal(calls.filter((c) => c[0] === "syncSub").length, 1);
    assert.equal(calls.filter((c) => c[0] === "fulfill365").length, 1);
    assert.equal(calls.filter((c) => c[0] === "begin").length, 2);
  });

  it("event purpose cannot cross-fulfill another product type", async () => {
    const { calls, deps } = recordingDeps();
    await processVerifiedStripeEvent(
      checkoutSessionEvent({
        id: "evt_365_not_payg",
        session: {
          mode: "subscription",
          payment_status: "paid",
          metadata: { kind: STUDY_HALL_365_KIND, payment_id: "pay_payg", account_id: ACCOUNT_A },
        },
      }),
      deps,
    );
    assert.equal(calls.filter((c) => c[0] === "fulfill365").length, 1);
    assert.equal(calls.filter((c) => c[0] === "fulfill").length, 0);

    const dispatch = read("src/lib/stripe/webhook-dispatch.mjs");
    const asyncBlock = dispatch.slice(dispatch.indexOf("checkout.session.async_payment_succeeded"));
    assert.match(asyncBlock, /isStudyHall365Session/);
    assert.match(asyncBlock, /fulfillFromMetadata/);
  });
});

describe("PR8C audit — failure / retry atomicity", () => {
  it("Stripe retrieve failure leaves the event retryable; retry converges", async () => {
    const { calls, deps } = recordingDeps();
    let boom = true;
    deps.syncSubscriptionById = async (params) => {
      calls.push(["syncSub", params.eventId]);
      if (boom) throw new Error("retrieve failed");
    };
    const event = {
      id: "evt_retrieve_fail",
      type: "customer.subscription.updated",
      created: 10,
      data: { object: { id: SUB_A, metadata: { account_id: ACCOUNT_A } } },
    };
    const fail = await processVerifiedStripeEvent(event, deps);
    assert.equal(fail.status, 500);
    assert.equal(calls.filter((c) => c[0] === "fail").length, 1);
    boom = false;
    const retry = await processVerifiedStripeEvent(event, deps);
    assert.equal(retry.status, 200);
    assert.equal(calls.filter((c) => c[0] === "complete").length, 1);
    assert.equal(calls.filter((c) => c[0] === "syncSub").length, 2);
  });

  it("membership apply can succeed while payment fulfill throws; retry fulfills once", () => {
    const state = { membership: null, payment: paymentRow(), fulfillCount: 0, lastFulfill: null, notifyAttempts: 0 };
    assert.throws(() =>
      runLifecycle(state, { id: "evt_pay_throw", created: 80, type: "customer.subscription.updated" }, subSnapshot(), {
        fulfillThrows: true,
      }),
    );
    assert.equal(state.membership.status, "active");
    assert.equal(state.payment.status, "requires_payment");
    assert.equal(state.fulfillCount, 0);

    runLifecycle(state, { id: "evt_pay_throw", created: 80, type: "customer.subscription.updated" }, subSnapshot());
    assert.equal(state.fulfillCount, 1);
    assert.equal(state.payment.status, "succeeded");
  });

  it("successful retry after fulfill does not duplicate membership or payment", () => {
    const state = { membership: null, payment: paymentRow(), fulfillCount: 0, lastFulfill: null, notifyAttempts: 0 };
    runLifecycle(state, { id: "evt_ok", created: 90, type: "customer.subscription.updated" }, subSnapshot());
    runLifecycle(state, { id: "evt_ok", created: 90, type: "customer.subscription.updated" }, subSnapshot());
    assert.equal(state.membership.lastStripeEventCreated, 90);
    assert.equal(state.fulfillCount, 1);
    assert.equal(state.lastFulfill, "already_fulfilled");
  });

  it("notification throw is swallowed after authoritative work; event still completes", async () => {
    const sync = read("src/lib/study-hall-365/stripe-sync.ts");
    assert.match(sync, /Must never throw: webhook\/local cancel must still succeed if email fails/);
    const { calls, deps } = recordingDeps();
    deps.syncSubscriptionById = async () => {
      calls.push(["syncSub"]);
    };
    const result = await processVerifiedStripeEvent(
      {
        id: "evt_notify",
        type: "customer.subscription.updated",
        created: 11,
        data: { object: { id: SUB_A, metadata: { account_id: ACCOUNT_A } } },
      },
      deps,
    );
    assert.equal(result.status, 200);
    assert.equal(calls.filter((c) => c[0] === "complete").length, 1);
    assert.equal(calls.filter((c) => c[0] === "fail").length, 0);
  });

  it("RPC error in maybeFulfill is thrown so the Stripe event stays retryable", () => {
    const helper = read("src/lib/study-hall-365/stripe-sync.ts");
    const body = helper.slice(helper.indexOf("async function maybeFulfillStudyHall365CheckoutPayment"));
    assert.match(body, /if \(error\) throw new Error\(error\.message\)/);
    assert.match(body, /if \(loadError\) throw new Error\(loadError\.message\)/);
  });
});

describe("PR8C audit — security regression", () => {
  it("invalid signature and missing secret never dispatch", () => {
    const event = checkoutSessionEvent();
    const payload = JSON.stringify(event);
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    assert.throws(() => verifyStripeWebhookEvent(payload, signature, "whsec_other"));
    assert.throws(() => verifyStripeWebhookEvent(payload, signature, null));
    assert.throws(() => verifyStripeWebhookEvent(payload, null, WEBHOOK_SECRET));
    const forged = payload.replace(event.id, "evt_forged");
    assert.throws(() => verifyStripeWebhookEvent(forged, signature, WEBHOOK_SECRET));
  });

  it("HTTP route fail-closes before claim when secret or signature is missing", () => {
    const route = read("src/app/api/stripe/webhook/route.ts");
    const post = route.slice(route.indexOf("export async function POST"));
    assert.ok(post.indexOf("isStripeWebhookConfigured") < post.indexOf("verifyStripeWebhookEvent"));
    assert.ok(post.indexOf("verifyStripeWebhookEvent") < post.indexOf("begin_stripe_event"));
    assert.match(route, /Invalid signature/);
    assert.match(route, /Missing Stripe signature/);
  });

  it("Checkout success URL is not fulfillment authority", () => {
    const checkout = read("src/lib/checkout-service.ts");
    const status = read("src/app/api/checkout/status/route.ts");
    assert.match(checkout, /NEVER infers success/);
    assert.match(status, /never trusts the Stripe/);
  });

  it("metadata kind cannot cross-fulfill without DB correlation", () => {
    assert.equal(
      shouldFulfillStudyHall365CheckoutPayment({
        applyStatus: "updated",
        subscriptionStatus: "active",
        payment: paymentRow({ purpose: "booking" }),
        accountId: ACCOUNT_A,
        customerId: CUSTOMER_A,
        paymentId: PAY_A,
      }),
      false,
    );
    const route = read("src/app/api/stripe/webhook/route.ts");
    assert.match(route, /kind === STUDY_HALL_365_KIND\) return/);
    assert.match(route, /fulfill_booking_payment/);
    assert.match(route, /fulfill_package_payment/);
  });
});

describe("PR8C audit — apply helper covers first insert vs update", () => {
  it("first snapshot inserts; later equal created re-applies rather than skipping", () => {
    const first = applyStudyHall365MembershipSnapshot(null, {
      eventId: "evt_a",
      eventCreated: 10,
      status: "active",
      accountId: ACCOUNT_A,
      customerId: CUSTOMER_A,
      subscriptionId: SUB_A,
      paymentId: PAY_A,
    });
    assert.equal(first.status, "inserted");
    const retry = applyStudyHall365MembershipSnapshot(first.row, {
      eventId: "evt_a",
      eventCreated: 10,
      status: "active",
      accountId: ACCOUNT_A,
      customerId: CUSTOMER_A,
      subscriptionId: SUB_A,
      paymentId: PAY_A,
    });
    assert.equal(retry.status, "updated");
  });
});
