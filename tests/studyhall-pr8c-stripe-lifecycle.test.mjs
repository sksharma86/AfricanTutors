import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import Stripe from "stripe";

import {
  PACKAGE_10SH_MINUTES,
  PACKAGE_10SH_PRICE_CENTS,
  PACKAGE_CODE_10_STUDY_HALLS,
  STUDY_HALL_365_KIND,
  STUDY_HALL_365_MONTHLY_CENTS,
  customerFacingPrepaidPackages,
} from "../src/lib/study-hall-365/catalog.mjs";
import { isSubscriptionEntitled } from "../src/lib/study-hall-365/entitlement.mjs";
import {
  HANDLED_STRIPE_EVENT_TYPES,
  processVerifiedStripeEvent,
  shouldFulfillStudyHall365CheckoutSession,
  shouldFulfillStudyHall365PaymentForStatus,
  stripeCheckoutKind,
} from "../src/lib/stripe/webhook-dispatch.mjs";
import { verifyStripeWebhookEvent } from "../src/lib/stripe/webhook-verify.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const WEBHOOK_SECRET = "whsec_pr8c_test_secret";

function signedEvent(event, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { payload, signature, event };
}

function checkoutEvent(overrides = {}) {
  const session = {
    id: "cs_test_payg",
    object: "checkout.session",
    mode: "payment",
    payment_status: "paid",
    amount_total: 1200,
    payment_intent: "pi_payg",
    metadata: { kind: "booking", payment_id: "pay_payg", account_id: "acct" },
    ...overrides.session,
  };
  return {
    id: overrides.id ?? "evt_cs_completed",
    object: "event",
    type: overrides.type ?? "checkout.session.completed",
    created: overrides.created ?? 1_700_000_000,
    data: { object: session },
  };
}

function recordingDeps() {
  const calls = [];
  const claims = new Map();
  /** @type {import("../src/lib/stripe/webhook-dispatch.mjs").StripeWebhookDeps} */
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
    fulfillFromMetadata: async (metadata, amount, paymentIntent) => {
      calls.push(["fulfill", stripeCheckoutKind(metadata), metadata?.payment_id, amount, paymentIntent]);
    },
    fulfillStudyHall365Checkout: async (session, event) => {
      calls.push(["fulfill365", session.metadata?.payment_id, event.id]);
    },
    isStudyHall365Session: (session) =>
      session.mode === "subscription" && session.metadata?.kind === STUDY_HALL_365_KIND,
    syncSubscriptionById: async (params) => {
      calls.push(["syncSub", params.subscriptionId, params.ended ?? false, params.eventCreated]);
    },
    syncFromInvoice: async (invoice, event) => {
      calls.push(["syncInvoice", invoice.id, event.type, event.id]);
    },
    cancelFromMetadata: async (metadata, reason) => {
      calls.push(["cancel", stripeCheckoutKind(metadata), metadata?.payment_id, reason]);
    },
  };
  return { calls, claims, deps };
}

describe("PR8C — signature verification (no live Stripe)", () => {
  it("accepts a Stripe-signed payload and rejects tampering", () => {
    const event = checkoutEvent();
    const { payload, signature } = signedEvent(event);
    const verified = verifyStripeWebhookEvent(payload, signature, WEBHOOK_SECRET);
    assert.equal(verified.id, event.id);
    assert.equal(verified.type, "checkout.session.completed");

    assert.throws(
      () => verifyStripeWebhookEvent(payload, signature, "whsec_other"),
      /signature/i,
    );
    assert.throws(
      () => verifyStripeWebhookEvent(payload.replace("paid", "unpaid"), signature, WEBHOOK_SECRET),
    );
    assert.throws(() => verifyStripeWebhookEvent(payload, null, WEBHOOK_SECRET));
    assert.throws(() => verifyStripeWebhookEvent(payload, signature, null));
  });

  it("HTTP route verifies the signature before claiming the event", () => {
    const route = read("src/app/api/stripe/webhook/route.ts");
    const post = route.slice(route.indexOf("export async function POST"));
    const verifyIdx = post.indexOf("verifyStripeWebhookEvent");
    const processIdx = post.indexOf("processVerifiedStripeEvent");
    const beginIdx = post.indexOf("begin_stripe_event");
    assert.ok(verifyIdx > 0 && processIdx > verifyIdx);
    assert.ok(beginIdx > processIdx);
    assert.match(route, /Invalid signature/);
    assert.match(route, /Missing Stripe signature/);
    assert.match(route, /isStripeWebhookConfigured/);
    assert.match(route, /request\.text\(\)/);
    assert.doesNotMatch(route, /getStripe\(\)\.webhooks\.constructEvent/);
  });

  it("fail-closed when webhook secret is missing even if a body is present", () => {
    const config = read("src/lib/stripe/config.ts");
    assert.match(config, /isStripeWebhookConfigured = Boolean\(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET\)/);
    const route = read("src/app/api/stripe/webhook/route.ts");
    assert.ok(route.indexOf("isStripeWebhookConfigured") < route.indexOf("verifyStripeWebhookEvent"));
  });
});

describe("PR8C — webhook replay / idempotency", () => {
  it("duplicate event id does not fulfill twice", async () => {
    const { calls, deps } = recordingDeps();
    const event = checkoutEvent();
    const first = await processVerifiedStripeEvent(event, deps);
    const second = await processVerifiedStripeEvent(event, deps);
    assert.equal(first.status, 200);
    assert.equal(second.body.duplicate, true);
    assert.equal(calls.filter((c) => c[0] === "fulfill").length, 1);
    assert.equal(calls.filter((c) => c[0] === "complete").length, 1);
  });

  it("in-progress claim returns 409 and does not fulfill again", async () => {
    const { calls, deps } = recordingDeps();
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    let started;
    const ready = new Promise((resolve) => {
      started = resolve;
    });
    const original = deps.fulfillFromMetadata;
    deps.fulfillFromMetadata = async (...args) => {
      started();
      await gate;
      return original(...args);
    };
    const event = checkoutEvent({ id: "evt_in_progress" });
    const first = processVerifiedStripeEvent(event, deps);
    await ready;
    const second = await processVerifiedStripeEvent(event, deps);
    assert.equal(second.status, 409);
    release();
    const done = await first;
    assert.equal(done.status, 200);
    assert.equal(calls.filter((c) => c[0] === "fulfill").length, 1);
  });

  it("failed fulfillment can be retried and then completes", async () => {
    const { calls, deps } = recordingDeps();
    let boom = true;
    deps.fulfillFromMetadata = async () => {
      calls.push(["fulfill"]);
      if (boom) throw new Error("temporary");
    };
    const event = checkoutEvent({ id: "evt_retry" });
    const fail = await processVerifiedStripeEvent(event, deps);
    assert.equal(fail.status, 500);
    assert.equal(calls.filter((c) => c[0] === "fail").length, 1);
    boom = false;
    const retry = await processVerifiedStripeEvent(event, deps);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.duplicate, undefined);
    assert.equal(calls.filter((c) => c[0] === "complete").length, 1);
  });

  it("unhandled event types complete as no-ops without fulfillment", async () => {
    const { calls, deps } = recordingDeps();
    const result = await processVerifiedStripeEvent(
      { id: "evt_unknown", type: "charge.refunded", created: 1, data: { object: { id: "ch_x" } } },
      deps,
    );
    assert.equal(result.status, 200);
    assert.equal(calls.filter((c) => c[0] === "fulfill" || c[0] === "fulfill365" || c[0] === "syncSub").length, 0);
    assert.equal(calls.filter((c) => c[0] === "complete").length, 1);
  });
});

describe("PR8C — PAYG checkout dispatch", () => {
  it("paid checkout.session.completed fulfills the booking amount of $12", async () => {
    const { calls, deps } = recordingDeps();
    await processVerifiedStripeEvent(checkoutEvent(), deps);
    const fulfill = calls.find((c) => c[0] === "fulfill");
    assert.deepEqual(fulfill.slice(0, 4), ["fulfill", "booking", "pay_payg", 1200]);
  });

  it("unpaid checkout.session.completed does not confirm", async () => {
    const { calls, deps } = recordingDeps();
    await processVerifiedStripeEvent(
      checkoutEvent({ session: { payment_status: "unpaid", amount_total: 1200 } }),
      deps,
    );
    assert.equal(calls.filter((c) => c[0] === "fulfill").length, 0);
  });

  it("payment_intent.succeeded uses amount_received and is a second event id", async () => {
    const { calls, deps } = recordingDeps();
    await processVerifiedStripeEvent(checkoutEvent(), deps);
    await processVerifiedStripeEvent(
      {
        id: "evt_pi_ok",
        type: "payment_intent.succeeded",
        created: 2,
        data: {
          object: {
            id: "pi_payg",
            amount: 1200,
            amount_received: 1200,
            metadata: { kind: "booking", payment_id: "pay_payg" },
          },
        },
      },
      deps,
    );
    assert.equal(calls.filter((c) => c[0] === "fulfill").length, 2);
    assert.equal(calls.filter((c) => c[0] === "begin").length, 2);
  });

  it("expired checkout cancels the pending hold instead of fulfilling", async () => {
    const { calls, deps } = recordingDeps();
    await processVerifiedStripeEvent(
      checkoutEvent({ type: "checkout.session.expired", id: "evt_expired" }),
      deps,
    );
    assert.equal(calls.filter((c) => c[0] === "fulfill").length, 0);
    assert.match(String(calls.find((c) => c[0] === "cancel")[3]), /expired/i);
  });

  it("success URL is not fulfillment authority", () => {
    const checkout = read("src/lib/checkout-service.ts");
    const status = read("src/app/api/checkout/status/route.ts");
    const ret = read("src/app/checkout/return/return-view.tsx");
    assert.match(checkout, /NEVER infers success/);
    assert.match(status, /never trusts the Stripe/);
    assert.match(ret, /\/api\/checkout\/status\?payment=/);
    assert.doesNotMatch(ret, /fulfill_booking_payment|constructEvent/);
    assert.match(checkout, /unit_amount:\s*q\.stripe_cents_due/);
  });
});

describe("PR8C — pkg_10sh / legacy packages", () => {
  it("package checkout uses inline price_data from DB amount, not Stripe Price ids", () => {
    const checkout = read("src/lib/checkout-service.ts");
    const pkgBlock = checkout.slice(checkout.indexOf("createPackageCheckout"));
    const sessionBlock = pkgBlock.slice(
      pkgBlock.indexOf("checkout.sessions.create"),
      pkgBlock.indexOf("idempotencyKey"),
    );
    assert.match(sessionBlock, /unit_amount:\s*q\.stripe_cents_due/);
    assert.match(sessionBlock, /10 Study Halls/);
    assert.doesNotMatch(sessionBlock, /price:\s*STRIPE_PRICE/);
    assert.doesNotMatch(sessionBlock, /['"]price_[A-Za-z0-9]+['"]/);
    assert.doesNotMatch(sessionBlock, /pkg_14h|pkg_28h/);
  });

  it("only pkg_10sh is the current prepaid offer; 14h/28h cannot be newly purchased", () => {
    assert.equal(PACKAGE_CODE_10_STUDY_HALLS, "pkg_10sh");
    assert.equal(PACKAGE_10SH_MINUTES, 600);
    assert.equal(PACKAGE_10SH_PRICE_CENTS, 10000);
    const shown = customerFacingPrepaidPackages([
      { code: "pkg_14h" },
      { code: "pkg_10sh" },
      { code: "pkg_28h" },
    ]);
    assert.deepEqual(shown.map((p) => p.code), ["pkg_10sh"]);
    const purchase = read("supabase/migrations/0012_phase4d_hardening.sql");
    assert.match(purchase, /Package is not available/);
    assert.match(read("supabase/migrations/0047_deactivate_legacy_prepaid_packages.sql"), /pkg_14h/);
  });

  it("duplicate package webhook dispatches twice at the event layer; ledger idempotency is payment-id keyed", async () => {
    const { calls, deps } = recordingDeps();
    const event = {
      id: "evt_pkg",
      type: "checkout.session.completed",
      created: 3,
      data: {
        object: {
          mode: "payment",
          payment_status: "paid",
          amount_total: 10000,
          payment_intent: "pi_pkg",
          metadata: { kind: "package", payment_id: "pay_pkg" },
        },
      },
    };
    await processVerifiedStripeEvent(event, deps);
    await processVerifiedStripeEvent(event, deps);
    assert.equal(calls.filter((c) => c[0] === "fulfill" && c[1] === "package").length, 1);
    const fulfillSql = read("supabase/migrations/0009_phase4b_selfenforcing_expiry.sql");
    assert.match(fulfillSql, /pkgissue:' \|\| p_payment_id/);
    assert.match(fulfillSql, /already_fulfilled/);
    assert.match(fulfillSql, /p_amount_cents <> v_expected/);
  });
});

describe("PR8C — Study Hall 365 dispatch and entitlement", () => {
  it("365 checkout is subscription mode at $14900; production requires Price id", () => {
    const checkout = read("src/lib/checkout-service.ts");
    assert.equal(STUDY_HALL_365_MONTHLY_CENTS, 14900);
    assert.match(checkout, /mode:\s*"subscription"/);
    assert.match(checkout, /STRIPE_PRICE_STUDY_HALL_365 is required in production/);
    assert.doesNotMatch(checkout, /trial_period_days/);
  });

  it("paid 365 checkout fulfills membership; unpaid completed session waits", async () => {
    const { calls, deps } = recordingDeps();
    const unpaid = checkoutEvent({
      id: "evt_365_unpaid",
      session: {
        mode: "subscription",
        payment_status: "unpaid",
        amount_total: 14900,
        metadata: { kind: STUDY_HALL_365_KIND, payment_id: "pay_365" },
      },
    });
    await processVerifiedStripeEvent(unpaid, deps);
    assert.equal(calls.filter((c) => c[0] === "fulfill365").length, 0);

    const paid = checkoutEvent({
      id: "evt_365_paid",
      session: {
        mode: "subscription",
        payment_status: "paid",
        amount_total: 14900,
        metadata: { kind: STUDY_HALL_365_KIND, payment_id: "pay_365" },
      },
    });
    await processVerifiedStripeEvent(paid, deps);
    assert.equal(calls.filter((c) => c[0] === "fulfill365").length, 1);
    assert.equal(shouldFulfillStudyHall365CheckoutSession(unpaid.data.object), false);
    assert.equal(shouldFulfillStudyHall365CheckoutSession(paid.data.object), true);
  });

  it("365 async_payment_succeeded fulfills instead of no-op", async () => {
    const { calls, deps } = recordingDeps();
    await processVerifiedStripeEvent(
      checkoutEvent({
        id: "evt_365_async",
        type: "checkout.session.async_payment_succeeded",
        session: {
          mode: "subscription",
          payment_status: "paid",
          metadata: { kind: STUDY_HALL_365_KIND, payment_id: "pay_365" },
        },
      }),
      deps,
    );
    assert.equal(calls.filter((c) => c[0] === "fulfill365").length, 1);
    assert.equal(calls.filter((c) => c[0] === "fulfill").length, 0);
  });

  it("invoice.paid syncs; invoice.payment_failed syncs and does not use PAYG cancel", async () => {
    const { calls, deps } = recordingDeps();
    await processVerifiedStripeEvent(
      {
        id: "evt_in_paid",
        type: "invoice.paid",
        created: 10,
        data: { object: { id: "in_1", subscription: "sub_1" } },
      },
      deps,
    );
    await processVerifiedStripeEvent(
      {
        id: "evt_in_fail",
        type: "invoice.payment_failed",
        created: 11,
        data: { object: { id: "in_2", subscription: "sub_1" } },
      },
      deps,
    );
    assert.deepEqual(
      calls.filter((c) => c[0] === "syncInvoice").map((c) => c[2]),
      ["invoice.paid", "invoice.payment_failed"],
    );
    assert.equal(calls.filter((c) => c[0] === "cancel").length, 0);
  });

  it("out-of-order 365 events: deleted marks ended; stale updated is a different event id", async () => {
    const { calls, deps } = recordingDeps();
    await processVerifiedStripeEvent(
      {
        id: "evt_sub_del",
        type: "customer.subscription.deleted",
        created: 200,
        data: { object: { id: "sub_1", metadata: { account_id: "acct" } } },
      },
      deps,
    );
    await processVerifiedStripeEvent(
      {
        id: "evt_sub_stale",
        type: "customer.subscription.updated",
        created: 100,
        data: { object: { id: "sub_1", metadata: { account_id: "acct" } } },
      },
      deps,
    );
    const syncs = calls.filter((c) => c[0] === "syncSub");
    assert.deepEqual(syncs[0], ["syncSub", "sub_1", true, 200]);
    assert.deepEqual(syncs[1], ["syncSub", "sub_1", false, 100]);
    const upsert = read("supabase/migrations/0044_study_hall_365_lifecycle_snapshot.sql");
    assert.match(upsert, /skipped_stale/);
    assert.match(upsert, /p_event_created.*last_stripe_event_created/);
  });

  it("cancel-at-period-end keeps access; ended/past_due do not", () => {
    const periodEnd = "2026-10-17T16:00:00.000Z";
    const now = "2026-09-20T12:00:00.000Z";
    assert.equal(
      isSubscriptionEntitled("canceled", { cancelAtPeriodEnd: true, periodEnd, now }),
      true,
    );
    assert.equal(
      isSubscriptionEntitled("canceled", { cancelAtPeriodEnd: true, periodEnd, now: "2026-10-18T00:00:00.000Z" }),
      false,
    );
    assert.equal(isSubscriptionEntitled("past_due", { periodEnd, now }), false);
    assert.equal(isSubscriptionEntitled("unpaid", { periodEnd, now }), false);
    assert.equal(isSubscriptionEntitled("active", { periodEnd, now, endedAt: "2026-09-19T00:00:00.000Z" }), false);
    assert.equal(shouldFulfillStudyHall365PaymentForStatus("active"), true);
    assert.equal(shouldFulfillStudyHall365PaymentForStatus("past_due"), false);
    assert.equal(shouldFulfillStudyHall365PaymentForStatus("incomplete"), false);
  });

  it("invoice/subscription sync fulfills the 365 payment row only when entitled", () => {
    const sync = read("src/lib/study-hall-365/stripe-sync.ts");
    assert.match(sync, /maybeFulfillStudyHall365CheckoutPayment/);
    assert.match(sync, /shouldFulfillStudyHall365PaymentForStatus/);
    assert.match(sync, /fulfill_study_hall_365_payment/);
    const helper = sync.slice(sync.indexOf("async function maybeFulfillStudyHall365CheckoutPayment"));
    assert.match(helper, /metadata\?\.payment_id/);
    assert.doesNotMatch(helper, /past_due/);
  });
});

describe("PR8C — Customer Portal is server-side; Dashboard config is external", () => {
  it("portal route creates a Billing Portal session and never trusts the browser customer id", () => {
    const portal = read("src/app/api/billing/portal/route.ts");
    assert.match(portal, /billingPortal\.sessions\.create/);
    assert.match(portal, /return_url: `\$\{request\.nextUrl\.origin\}\/dashboard\/student\/packages`/);
    assert.match(portal, /portalUnconfigured: true/);
    assert.match(portal, /cancel \(at period end\)/);
    assert.doesNotMatch(portal, /body\.customer|stripe_customer_id:\s*body/);
  });
});

describe("PR8C — handled event inventory and no live charges in tests", () => {
  it("dispatcher covers the required Stripe event matrix", () => {
    for (const type of [
      "checkout.session.completed",
      "payment_intent.succeeded",
      "invoice.paid",
      "invoice.payment_failed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ]) {
      assert.ok(HANDLED_STRIPE_EVENT_TYPES.includes(type), type);
    }
  });

  it("does not call Stripe APIs or mutate production in this suite", () => {
    assert.equal(Boolean(process.env.STRIPE_SECRET_KEY), false);
    assert.doesNotMatch(read("src/lib/stripe/webhook-dispatch.mjs"), /getStripe\(|customers\.create|charges\.create/);
  });
});
