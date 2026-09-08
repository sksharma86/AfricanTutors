import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import * as T from "../src/lib/email/templates.mjs";
import { CHANNEL_POLICY, NOTIFICATION_EVENTS } from "../src/lib/notifications/events.mjs";
import { classifyStudyHall365Transitions } from "../src/lib/notifications/study-hall-365-lifecycle.mjs";
import {
  invoiceIndicatesOpenBalance,
  shouldNotifyStudyHall365PaymentFailure,
  studyHall365PaymentFailureKey,
} from "../src/lib/notifications/study-hall-365-payment-failure.mjs";
import { hasSupabaseEnv, isCanonicalDemoProject } from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const APP = "https://app.studyhall.test";
const SUB = "sub_pr7c_test";
const INV_1 = "in_pr7c_fail_1";
const INV_2 = "in_pr7c_fail_2";
const NOW = "2026-09-20T12:00:00.000Z";
const PERIOD_1_START = "2026-09-17T16:00:00.000Z";
const PERIOD_1_END = "2026-10-17T16:00:00.000Z";
const PERIOD_2_END = "2026-11-17T16:00:00.000Z";

function snap(overrides = {}) {
  return {
    status: "active",
    cancel_at_period_end: false,
    current_period_start: PERIOD_1_START,
    current_period_end: PERIOD_1_END,
    canceled_at: null,
    ended_at: null,
    ...overrides,
  };
}

function failed365Invoice(overrides = {}) {
  return {
    id: INV_1,
    subscription: SUB,
    paid: false,
    status: "open",
    amount_remaining: 14900,
    attempt_count: 1,
    ...overrides,
  };
}

function shouldNotify(overrides = {}) {
  return shouldNotifyStudyHall365PaymentFailure({
    applyStatus: "updated",
    previous: snap(),
    current: snap({ status: "past_due" }),
    invoice: failed365Invoice(),
    ...overrides,
  });
}

function assertNoLeaks(rendered) {
  const blob = `${rendered.subject}\n${rendered.html}\n${rendered.text}`;
  const lower = blob.toLowerCase();
  for (const bad of [
    "daily.co",
    "token=",
    "twilio",
    "resend",
    "+1555",
    "phone_e164",
    "auth_token",
    "cus_",
    "in_pr7c",
    "sub_pr7c",
    "past_due",
    "invoice.payment_failed",
    "customer.subscription",
    "stripe",
    "billing portal",
  ]) {
    assert.ok(!lower.includes(bad.toLowerCase()), `must not leak "${bad}"`);
  }
}

describe("PR7C — genuine Study Hall 365 invoice payment failure", () => {
  it("established membership that becomes past_due notifies once per invoice", () => {
    assert.equal(shouldNotify(), true);
    assert.equal(studyHall365PaymentFailureKey(INV_1), `365-payment-failure:${INV_1}`);
    assert.equal(studyHall365PaymentFailureKey({ id: INV_1 }), `365-payment-failure:${INV_1}`);
  });

  it("unpaid is the same payment-problem family as past_due", () => {
    assert.equal(shouldNotify({ current: snap({ status: "unpaid" }) }), true);
  });
});

describe("PR7C — replay and Stripe retries (policy A: one email per invoice)", () => {
  it("replay of the same failed invoice uses the same durable key", () => {
    const first = studyHall365PaymentFailureKey(INV_1);
    const replay = studyHall365PaymentFailureKey(INV_1);
    assert.equal(first, replay);
    assert.equal(shouldNotify(), true);
    assert.equal(shouldNotify({ invoice: failed365Invoice({ attempt_count: 1 }) }), true);
  });

  it("multiple Stripe collection attempts on the same invoice do not create a new key", () => {
    const attempt1 = studyHall365PaymentFailureKey(INV_1);
    const attempt3 = studyHall365PaymentFailureKey(failed365Invoice({ attempt_count: 3 }).id);
    assert.equal(attempt1, attempt3);
    assert.doesNotMatch(attempt1, /attempt|Date\.now|2026-09-20/);
    assert.equal(
      shouldNotify({ invoice: failed365Invoice({ attempt_count: 3, amount_remaining: 14900 }) }),
      true,
    );
  });

  it("a different future invoice is a new notification identity", () => {
    assert.notEqual(studyHall365PaymentFailureKey(INV_1), studyHall365PaymentFailureKey(INV_2));
    assert.equal(
      shouldNotify({ invoice: failed365Invoice({ id: INV_2 }) }),
      true,
    );
  });
});

describe("PR7C — non-365 and incomplete paths do not notify", () => {
  it("PAYG payment failure (no subscription on the invoice) does not notify", () => {
    assert.equal(
      shouldNotify({
        invoice: {
          id: "in_payg",
          subscription: null,
          paid: false,
          status: "open",
          amount_remaining: 1200,
        },
      }),
      false,
    );
  });

  it("prepaid/package invoice without a subscription does not notify", () => {
    assert.equal(
      shouldNotify({
        invoice: {
          id: "in_pkg",
          subscription: null,
          parent: {},
          paid: false,
          status: "open",
          amount_remaining: 10000,
        },
      }),
      false,
    );
  });

  it("unrelated Stripe invoice without a 365 subscription does not notify", () => {
    assert.equal(
      shouldNotify({
        applyStatus: "ignored",
        previous: null,
        current: null,
        invoice: failed365Invoice({ subscription: null, id: "in_other" }),
      }),
      false,
    );
  });

  it("failed/incomplete 365 checkout before an established membership does not notify", () => {
    assert.equal(
      shouldNotify({
        applyStatus: "inserted",
        previous: null,
        current: snap({ status: "incomplete" }),
        invoice: failed365Invoice(),
      }),
      false,
    );
    assert.equal(
      shouldNotify({
        applyStatus: "updated",
        previous: snap({ status: "incomplete" }),
        current: snap({ status: "incomplete" }),
        invoice: failed365Invoice(),
      }),
      false,
    );
    assert.equal(
      shouldNotify({
        applyStatus: "updated",
        previous: snap({ status: "incomplete" }),
        current: snap({ status: "past_due" }),
        invoice: failed365Invoice(),
      }),
      false,
    );
  });

  it("paid / recovered invoice does not send a failure email", () => {
    assert.equal(invoiceIndicatesOpenBalance({ id: INV_1, paid: true, status: "paid", amount_remaining: 0 }), false);
    assert.equal(
      shouldNotify({
        current: snap({ status: "active" }),
        invoice: failed365Invoice({ paid: true, status: "paid", amount_remaining: 0 }),
      }),
      false,
    );
    assert.equal(
      shouldNotify({
        current: snap({ status: "past_due" }),
        invoice: failed365Invoice({ paid: true, status: "paid", amount_remaining: 0 }),
      }),
      false,
    );
  });

  it("stale upserts and missing current snapshot do not notify", () => {
    assert.equal(shouldNotify({ applyStatus: "skipped_stale" }), false);
    assert.equal(shouldNotify({ current: null }), false);
    assert.equal(shouldNotify({ current: snap({ status: "active" }) }), false);
  });
});

describe("PR7C — past_due vs ended semantics", () => {
  it("past_due is payment-failure, not membership-ended", () => {
    const lifecycle = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap(),
      current: snap({ status: "past_due" }),
      now: NOW,
    });
    assert.deepEqual(
      lifecycle.map((e) => e.type),
      [],
    );
    assert.ok(!lifecycle.some((e) => e.type === NOTIFICATION_EVENTS.STUDY_HALL_365_ENDED));
    assert.equal(shouldNotify({ current: snap({ status: "past_due" }) }), true);

    const mail = T.studyHall365PaymentFailure({ appUrl: APP });
    assert.doesNotMatch(mail.subject + mail.text, /has ended|cancelled|canceled/i);
    assert.match(mail.text, /access is currently unavailable/i);
  });

  it("ended membership is PR7B only — PR7C does not duplicate it", () => {
    const ended = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap(),
      current: snap({ status: "canceled", ended_at: NOW, canceled_at: NOW }),
      now: NOW,
    });
    assert.deepEqual(
      ended.map((e) => e.type),
      [NOTIFICATION_EVENTS.STUDY_HALL_365_ENDED],
    );
    assert.equal(
      shouldNotify({
        current: snap({ status: "canceled", ended_at: NOW }),
        invoice: failed365Invoice(),
      }),
      false,
    );
    assert.equal(
      shouldNotify({
        current: snap({ status: "past_due", ended_at: NOW }),
      }),
      false,
    );
  });
});

describe("PR7C — email copy, billing link, channels", () => {
  it("subject and body are calm payment-needed copy with Hours CTA", () => {
    const mail = T.studyHall365PaymentFailure({ appUrl: APP });
    assert.equal(mail.subject, "Payment needed for Study Hall 365");
    assert.match(mail.text, /couldn't complete the latest Study Hall 365 payment/i);
    assert.match(mail.text, /billing information needs attention/i);
    assert.match(mail.text, /access is currently unavailable until billing is resolved/i);
    assert.match(mail.text, /Prepaid Study Hall hours and account credit/i);
    assert.match(mail.text, /not a membership cancellation/i);
    assert.match(mail.text, /\/dashboard\/student\/packages/);
    assert.match(mail.html, /Update billing/);
    assert.doesNotMatch(mail.html, /billing\.stripe\.com|customer portal session/i);
    assertNoLeaks(mail);
  });

  it("PR7C sends parent email only; SMS remains deferred to PR7F", () => {
    const life = CHANNEL_POLICY.pr7_lifecycle;
    assert.deepEqual(life.payment_failure.parent, ["email", "sms"]);
    assert.deepEqual(life.payment_failure.guide, []);
    assert.deepEqual(life.payment_failure.manager, []);
    assert.ok(CHANNEL_POLICY.email.includes("payment_failure"));
    assert.ok(CHANNEL_POLICY.sms.includes("payment_failure"));
    assert.ok(!(CHANNEL_POLICY.whatsapp || []).includes("payment_failure"));

    const notify = read("src/lib/notify.ts");
    const start = notify.indexOf("Parent-email Study Hall 365 payment failure");
    const end = notify.indexOf("export async function notifyAccountCreditApplied");
    const body = notify.slice(start, end > start ? end : undefined);
    assert.match(body, /deliver\(/);
    assert.doesNotMatch(body, /deliverParentSms|deliverGuideWhatsApp|notifyAdminAlert/);
    assert.match(body, /PR7F/);
  });
});

describe("PR7C — architecture, isolation, Hours portal CTA", () => {
  const sync = read("src/lib/study-hall-365/stripe-sync.ts");
  const webhook = read("src/app/api/stripe/webhook/route.ts");
  const notify = read("src/lib/notify.ts");
  const card = read("src/components/booking/study-hall-365-card.tsx");
  const portal = read("src/app/api/billing/portal/route.ts");

  it("notifies only after invoice sync — never from the raw Stripe event type", () => {
    assert.match(sync, /notifyStudyHall365PaymentFailure/);
    assert.match(sync, /notifyPaymentFailureAfterInvoiceSync/);
    assert.match(sync, /async function syncFromInvoice/);
    const fromInvoice = sync.slice(sync.indexOf("export async function syncFromInvoice"));
    assert.match(fromInvoice, /notifyPaymentFailureAfterInvoiceSync/);
    assert.doesNotMatch(webhook, /notifyStudyHall365PaymentFailure/);
    assert.match(webhook, /invoice\.payment_failed/);
    assert.match(webhook, /syncFromInvoice/);
    const paygFail = webhook.slice(webhook.indexOf("payment_intent.payment_failed"));
    assert.match(paygFail, /cancelFromMetadata/);
    assert.doesNotMatch(paygFail.slice(0, 400), /syncFromInvoice/);
  });

  it("notification failure cannot throw out of Stripe invoice sync", () => {
    const helper = sync.slice(sync.indexOf("async function notifyPaymentFailureAfterInvoiceSync"));
    assert.match(helper, /try \{/);
    assert.match(helper, /catch \{/);
    assert.match(helper, /notifications are side effects/);
    const lifecycle = sync.slice(sync.indexOf("async function notifyAfterAuthoritativeUpsert"));
    assert.match(lifecycle, /notifyStudyHall365Lifecycle/);
  });

  it("does not start PR7F from the 365 payment-failure path", () => {
    assert.match(notify, /notifyStudyHall365PaymentFailure/);
    assert.doesNotMatch(sync, /consent|sender branding/i);
    assert.doesNotMatch(webhook, /customer_no_show/);
    assert.doesNotMatch(webhook, /notifyCustomerNoShow/);
  });

  it("Hours keeps a dynamic billing-portal path; past_due members can open it", () => {
    assert.match(portal, /billingPortal\.sessions\.create/);
    assert.match(portal, /\/dashboard\/student\/packages/);
    assert.doesNotMatch(portal, /https:\/\/billing\.stripe\.com/);
    assert.match(card, /studyHall365HoursCtas/);
    assert.match(card, /openMembership/);
    assert.match(card, /\/api\/billing\/portal/);
    assert.match(card, /Manage billing/);
  });

  it("recovery is not a new PR7C event; same-period active restore is not ended", () => {
    const recoveredSamePeriod = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({ status: "past_due" }),
      current: snap({ status: "active" }),
      now: NOW,
    });
    assert.deepEqual(recoveredSamePeriod, []);
    const renewedAfterRecovery = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({ status: "past_due" }),
      current: snap({
        status: "active",
        current_period_end: PERIOD_2_END,
        current_period_start: PERIOD_1_END,
      }),
      now: "2026-10-18T12:00:00.000Z",
    });
    assert.deepEqual(
      renewedAfterRecovery.map((e) => e.type),
      [NOTIFICATION_EVENTS.STUDY_HALL_365_RENEWED],
    );
    assert.ok(!Object.values(NOTIFICATION_EVENTS).includes("payment_recovered"));
    assert.ok(!Object.values(NOTIFICATION_EVENTS).includes("payment_failure_recovered"));
  });
});

describe("PR7C — claim keys survive replay (DB, when configured)", () => {
  it("same invoice claims once; a later invoice can claim again", async (t) => {
    const demoLocked = isCanonicalDemoProject() && process.env.ALLOW_DEMO_DB_WRITES !== "1";
    if (!hasSupabaseEnv || demoLocked) {
      t.skip("Supabase env not configured for live writes");
      return;
    }
    const { adminClient, createUser, cleanupAll } = await import("./helpers.mjs");
    const svc = adminClient();
    const parent = await createUser({ requestedRole: "student", displayName: "PR7C Parent" });
    const keys = [studyHall365PaymentFailureKey(INV_1), studyHall365PaymentFailureKey(INV_2)];
    try {
      assert.equal(
        (
          await svc.rpc("claim_email_delivery", {
            p_key: keys[0],
            p_type: "payment_failure",
            p_account: parent.id,
            p_to: "p@x.test",
          })
        ).data,
        true,
      );
      assert.equal(
        (
          await svc.rpc("claim_email_delivery", {
            p_key: keys[0],
            p_type: "payment_failure",
            p_account: parent.id,
            p_to: "p@x.test",
          })
        ).data,
        false,
        "replay same invoice",
      );
      assert.equal(
        (
          await svc.rpc("claim_email_delivery", {
            p_key: keys[1],
            p_type: "payment_failure",
            p_account: parent.id,
            p_to: "p@x.test",
          })
        ).data,
        true,
        "future invoice",
      );
    } finally {
      await svc.from("email_deliveries").delete().in("idempotency_key", keys);
      await cleanupAll();
    }
  });
});
