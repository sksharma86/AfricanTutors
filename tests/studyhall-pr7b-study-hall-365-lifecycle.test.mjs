import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import * as T from "../src/lib/email/templates.mjs";
import { CHANNEL_POLICY, NOTIFICATION_EVENTS } from "../src/lib/notifications/events.mjs";
import {
  classifyStudyHall365Transitions,
  parseUpsertLifecycleSnapshot,
  studyHall365CancelScheduledKey,
  studyHall365EndedKey,
  studyHall365RenewedKey,
  studyHall365ResumedKey,
  studyHall365StartedKey,
} from "../src/lib/notifications/study-hall-365-lifecycle.mjs";
import { hasSupabaseEnv, isCanonicalDemoProject } from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const APP = "https://app.studyhall.test";
const SUB = "sub_pr7b_test";
const NOW = "2026-09-20T12:00:00.000Z";
const PERIOD_1_START = "2026-09-17T16:00:00.000Z";
const PERIOD_1_END = "2026-10-17T16:00:00.000Z";
const PERIOD_2_START = "2026-10-17T16:00:00.000Z";
const PERIOD_2_END = "2026-11-17T16:00:00.000Z";
const CANCELED_AT_1 = "2026-09-22T18:00:00.000Z";
const CANCELED_AT_2 = "2026-09-28T15:00:00.000Z";

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

function typesOf(events) {
  return events.map((e) => e.type);
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
    "cancel_at_period_end",
    "invoice.paid",
    "subscription.updated",
    "customer.subscription",
  ]) {
    assert.ok(!lower.includes(bad.toLowerCase()), `must not leak "${bad}"`);
  }
}

describe("PR7B — started", () => {
  it("successful first activation sends once", () => {
    const first = classifyStudyHall365Transitions({
      applyStatus: "inserted",
      stripeSubscriptionId: SUB,
      previous: null,
      current: snap(),
      now: NOW,
    });
    assert.deepEqual(typesOf(first), [NOTIFICATION_EVENTS.STUDY_HALL_365_STARTED]);
    assert.equal(first[0].key, studyHall365StartedKey(SUB));
    assert.equal(first[0].key, `365-started:${SUB}`);
  });

  it("replay of the same active membership does not send twice", () => {
    const replay = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap(),
      current: snap(),
      now: NOW,
    });
    assert.deepEqual(replay, []);
  });

  it("incomplete / failed checkout does not send", () => {
    const incompleteInsert = classifyStudyHall365Transitions({
      applyStatus: "inserted",
      stripeSubscriptionId: SUB,
      previous: null,
      current: snap({ status: "incomplete" }),
      now: NOW,
    });
    assert.deepEqual(incompleteInsert, []);

    const stillIncomplete = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({ status: "incomplete" }),
      current: snap({ status: "incomplete" }),
      now: NOW,
    });
    assert.deepEqual(incompleteInsert, []);
    assert.deepEqual(stillIncomplete, []);
  });

  it("incomplete → active is the first activation", () => {
    const paid = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({ status: "incomplete" }),
      current: snap({ status: "active" }),
      now: NOW,
    });
    assert.deepEqual(typesOf(paid), [NOTIFICATION_EVENTS.STUDY_HALL_365_STARTED]);
  });
});

describe("PR7B — renewed", () => {
  it("new billing period sends once with period-end key", () => {
    const renewed = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap(),
      current: snap({
        current_period_start: PERIOD_2_START,
        current_period_end: PERIOD_2_END,
      }),
      now: "2026-10-18T12:00:00.000Z",
    });
    assert.deepEqual(typesOf(renewed), [NOTIFICATION_EVENTS.STUDY_HALL_365_RENEWED]);
    assert.equal(renewed[0].key, studyHall365RenewedKey(SUB, PERIOD_2_END));
    assert.equal(renewed[0].key, `365-renewed:${SUB}:2026-11-17T16:00:00.000Z`);
  });

  it("same period replay does not resend", () => {
    const replay = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({
        current_period_start: PERIOD_2_START,
        current_period_end: PERIOD_2_END,
      }),
      current: snap({
        current_period_start: PERIOD_2_START,
        current_period_end: PERIOD_2_END,
      }),
      now: "2026-10-18T12:00:00.000Z",
    });
    assert.deepEqual(replay, []);
  });

  it("original start does not incorrectly send renewal", () => {
    const start = classifyStudyHall365Transitions({
      applyStatus: "inserted",
      stripeSubscriptionId: SUB,
      previous: null,
      current: snap(),
      now: NOW,
    });
    assert.ok(!typesOf(start).includes(NOTIFICATION_EVENTS.STUDY_HALL_365_RENEWED));
  });

  it("unrelated subscription.updated (metadata-only) does not send renewal", () => {
    const samePeriod = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap(),
      current: snap(),
      now: NOW,
    });
    assert.deepEqual(samePeriod, []);
  });
});

describe("PR7B — cancellation scheduled", () => {
  it("false → true sends; email is scheduled not immediate", () => {
    const scheduled = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({ cancel_at_period_end: false }),
      current: snap({ cancel_at_period_end: true, canceled_at: CANCELED_AT_1 }),
      now: NOW,
    });
    assert.deepEqual(typesOf(scheduled), [NOTIFICATION_EVENTS.STUDY_HALL_365_CANCELLATION_SCHEDULED]);
    assert.equal(scheduled[0].key, studyHall365CancelScheduledKey(SUB, CANCELED_AT_1));
    assert.ok(!typesOf(scheduled).includes(NOTIFICATION_EVENTS.STUDY_HALL_365_ENDED));

    const mail = T.studyHall365CancellationScheduled({
      periodEndISO: PERIOD_1_END,
      tz: "America/Chicago",
      appUrl: APP,
    });
    assert.equal(mail.subject, "Your Study Hall 365 cancellation is scheduled");
    assert.match(mail.text, /stays active through/i);
    assert.match(mail.text, /does not end today/i);
    assert.doesNotMatch(mail.text, /has ended/i);
    assertNoLeaks(mail);
  });

  it("true → true does not resend", () => {
    const still = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({ cancel_at_period_end: true, canceled_at: CANCELED_AT_1 }),
      current: snap({ cancel_at_period_end: true, canceled_at: CANCELED_AT_1 }),
      now: NOW,
    });
    assert.deepEqual(still, []);
  });
});

describe("PR7B — resumed", () => {
  it("true → false sends", () => {
    const resumed = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({ cancel_at_period_end: true, canceled_at: CANCELED_AT_1 }),
      current: snap({ cancel_at_period_end: false, canceled_at: null }),
      now: NOW,
    });
    assert.deepEqual(typesOf(resumed), [NOTIFICATION_EVENTS.STUDY_HALL_365_RESUMED]);
    assert.equal(resumed[0].key, studyHall365ResumedKey(SUB, CANCELED_AT_1));
  });

  it("false → false / ordinary active sync does not send", () => {
    const idle = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({ cancel_at_period_end: false }),
      current: snap({ cancel_at_period_end: false }),
      now: NOW,
    });
    assert.deepEqual(idle, []);
  });
});

describe("PR7B — ended", () => {
  it("actual terminal/end transition sends once", () => {
    const ended = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({ cancel_at_period_end: true, canceled_at: CANCELED_AT_1 }),
      current: snap({
        status: "canceled",
        cancel_at_period_end: true,
        canceled_at: CANCELED_AT_1,
        ended_at: PERIOD_1_END,
      }),
      now: PERIOD_1_END,
    });
    assert.deepEqual(typesOf(ended), [NOTIFICATION_EVENTS.STUDY_HALL_365_ENDED]);
    assert.equal(ended[0].key, studyHall365EndedKey(SUB));
  });

  it("scheduled cancellation before period end does not send ended", () => {
    const scheduled = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap(),
      current: snap({ cancel_at_period_end: true, canceled_at: CANCELED_AT_1 }),
      now: NOW,
    });
    assert.ok(!typesOf(scheduled).includes(NOTIFICATION_EVENTS.STUDY_HALL_365_ENDED));
  });

  it("replay does not duplicate ended", () => {
    const replay = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({ status: "canceled", ended_at: PERIOD_1_END }),
      current: snap({ status: "canceled", ended_at: PERIOD_1_END }),
      now: PERIOD_1_END,
    });
    assert.deepEqual(replay, []);
  });

  it("past_due does not produce ended", () => {
    const pastDue = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({ status: "active" }),
      current: snap({ status: "past_due" }),
      now: NOW,
    });
    assert.deepEqual(typesOf(pastDue), []);
    assert.ok(!typesOf(pastDue).includes(NOTIFICATION_EVENTS.STUDY_HALL_365_ENDED));
  });

  it("incomplete_expired of a never-established checkout does not send ended", () => {
    const expired = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({ status: "incomplete" }),
      current: snap({ status: "incomplete_expired", ended_at: NOW }),
      now: NOW,
    });
    assert.deepEqual(expired, []);
  });
});

describe("PR7B — cancel → resume → cancel cycle", () => {
  it("produces three meaningful transitions with distinct keys; replay does not duplicate", () => {
    const start = classifyStudyHall365Transitions({
      applyStatus: "inserted",
      stripeSubscriptionId: SUB,
      previous: null,
      current: snap(),
      now: NOW,
    });
    const cancel1 = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap(),
      current: snap({ cancel_at_period_end: true, canceled_at: CANCELED_AT_1 }),
      now: NOW,
    });
    const resume = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({ cancel_at_period_end: true, canceled_at: CANCELED_AT_1 }),
      current: snap({ cancel_at_period_end: false, canceled_at: null }),
      now: NOW,
    });
    const cancel2 = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({ cancel_at_period_end: false, canceled_at: null }),
      current: snap({ cancel_at_period_end: true, canceled_at: CANCELED_AT_2 }),
      now: NOW,
    });
    const cancel2Replay = classifyStudyHall365Transitions({
      applyStatus: "updated",
      stripeSubscriptionId: SUB,
      previous: snap({ cancel_at_period_end: true, canceled_at: CANCELED_AT_2 }),
      current: snap({ cancel_at_period_end: true, canceled_at: CANCELED_AT_2 }),
      now: NOW,
    });

    assert.deepEqual(typesOf(start), [NOTIFICATION_EVENTS.STUDY_HALL_365_STARTED]);
    assert.deepEqual(typesOf(cancel1), [NOTIFICATION_EVENTS.STUDY_HALL_365_CANCELLATION_SCHEDULED]);
    assert.deepEqual(typesOf(resume), [NOTIFICATION_EVENTS.STUDY_HALL_365_RESUMED]);
    assert.deepEqual(typesOf(cancel2), [NOTIFICATION_EVENTS.STUDY_HALL_365_CANCELLATION_SCHEDULED]);
    assert.deepEqual(cancel2Replay, []);
    assert.notEqual(cancel1[0].key, cancel2[0].key);
    assert.equal(resume[0].key, studyHall365ResumedKey(SUB, CANCELED_AT_1));
  });
});

describe("PR7B — channel policy and templates", () => {
  it("parent email only; no SMS / WhatsApp / Guide / Management send", () => {
    const life = CHANNEL_POLICY.pr7_lifecycle;
    for (const key of [
      "study_hall_365_started",
      "study_hall_365_renewed",
      "study_hall_365_cancellation_scheduled",
      "study_hall_365_resumed",
      "study_hall_365_ended",
    ]) {
      assert.deepEqual(life[key].parent, ["email"]);
      assert.deepEqual(life[key].guide, []);
      assert.deepEqual(life[key].manager, []);
      assert.ok(!CHANNEL_POLICY.sms.includes(key));
      assert.ok(!(CHANNEL_POLICY.whatsapp || []).includes(key));
    }
    const notify = read("src/lib/notify.ts");
    const fn = notify.slice(notify.indexOf("export async function notifyStudyHall365Lifecycle"));
    const end = fn.indexOf("export async function notifyAccountCreditApplied");
    const body = end > 0 ? fn.slice(0, end) : fn;
    assert.doesNotMatch(body, /deliverParentSms|deliverGuideWhatsApp|notifyAdminAlert/);
  });

  it("subjects and bodies match the parent-facing direction", () => {
    const started = T.studyHall365Started({ appUrl: APP });
    assert.equal(started.subject, "Welcome to Study Hall 365");
    assert.match(started.text, /membership is active/i);
    assert.match(started.text, /one 60-minute Study Hall/i);
    assert.match(started.text, /do not roll over/i);
    assert.match(started.text, /plan-week/);

    const renewed = T.studyHall365Renewed({
      periodEndISO: PERIOD_2_END,
      tz: "America/Chicago",
      appUrl: APP,
    });
    assert.equal(renewed.subject, "Your Study Hall 365 membership renewed");
    assert.match(renewed.text, /renewed successfully/i);

    const resumed = T.studyHall365Resumed({ appUrl: APP });
    assert.equal(resumed.subject, "Study Hall 365 will continue");
    assert.match(resumed.text, /scheduled cancellation was removed/i);
    assert.match(resumed.text, /billing continues normally/i);

    const ended = T.studyHall365Ended({ appUrl: APP });
    assert.equal(ended.subject, "Your Study Hall 365 membership has ended");
    assert.match(ended.text, /Prepaid Study Hall hours and account credit/i);
    assert.match(ended.text, /pay-as-you-go/i);

    for (const mail of [started, renewed, resumed, ended]) assertNoLeaks(mail);
  });
});

describe("PR7B — architecture / failure isolation / no extra slices", () => {
  const sync = read("src/lib/study-hall-365/stripe-sync.ts");
  const webhook = read("src/app/api/stripe/webhook/route.ts");
  const notify = read("src/lib/notify.ts");
  const migration = read("supabase/migrations/0044_study_hall_365_lifecycle_snapshot.sql");

  it("notifies only after upsert; never from a raw Stripe event type", () => {
    assert.match(sync, /notifyStudyHall365Lifecycle/);
    assert.match(sync, /notifyAfterAuthoritativeUpsert/);
    assert.match(sync, /notifications are side effects/);
    assert.doesNotMatch(webhook, /notifyStudyHall365Lifecycle|STUDY_HALL_365_STARTED|365-started/);
    assert.match(webhook, /syncSubscriptionById/);
    assert.match(webhook, /fulfillStudyHall365Checkout/);
    assert.match(webhook, /syncFromInvoice/);
  });

  it("notification failure cannot throw out of Stripe sync", () => {
    const helper = sync.slice(sync.indexOf("async function notifyAfterAuthoritativeUpsert"));
    assert.match(helper, /try \{/);
    assert.match(helper, /catch \{/);
  });

  it("upsert snapshot migration returns previous/current and does not add tables", () => {
    assert.match(migration, /'previous'/);
    assert.match(migration, /'current'/);
    assert.match(migration, /for update/);
    assert.doesNotMatch(migration, /create table/i);
    assert.doesNotMatch(migration, /alter table/i);
  });

  it("does not start PR7D/PR7E/PR7F or change providers", () => {
    assert.doesNotMatch(notify, /notifyCustomerNoShow/);
    assert.doesNotMatch(webhook, /notifyCustomerNoShow/);
    assert.doesNotMatch(read("src/app/api/tutor/customer-no-show/route.ts"), /notify/);
    assert.doesNotMatch(migration, /resend|twilio|daily\.co/i);
    assert.doesNotMatch(migration, /create table|alter table/i);
  });

  it("skipped_stale upserts produce no transitions", () => {
    const stale = classifyStudyHall365Transitions({
      applyStatus: "skipped_stale",
      stripeSubscriptionId: SUB,
      previous: snap(),
      current: snap({ status: "past_due" }),
      now: NOW,
    });
    assert.deepEqual(stale, []);
  });

  it("parseUpsertLifecycleSnapshot reads the RPC payload", () => {
    const parsed = parseUpsertLifecycleSnapshot({
      status: "updated",
      account_id: "acct",
      previous: snap(),
      current: snap({ cancel_at_period_end: true, canceled_at: CANCELED_AT_1 }),
    });
    assert.equal(parsed?.applyStatus, "updated");
    assert.equal(parsed?.accountId, "acct");
    assert.equal(parsed?.current?.cancel_at_period_end, true);
  });
});

describe("PR7B — claim keys survive replay (DB, when configured)", () => {
  it("started / renew / cancel cycle keys claim once each", async (t) => {
    const demoLocked = isCanonicalDemoProject() && process.env.ALLOW_DEMO_DB_WRITES !== "1";
    if (!hasSupabaseEnv || demoLocked) {
      t.skip("Supabase env not configured for live writes");
      return;
    }
    const { adminClient, createUser, cleanupAll } = await import("./helpers.mjs");
    const svc = adminClient();
    const parent = await createUser({ requestedRole: "student", displayName: "PR7B Parent" });
    const keys = [
      studyHall365StartedKey(SUB),
      studyHall365RenewedKey(SUB, PERIOD_2_END),
      studyHall365CancelScheduledKey(SUB, CANCELED_AT_1),
      studyHall365ResumedKey(SUB, CANCELED_AT_1),
      studyHall365CancelScheduledKey(SUB, CANCELED_AT_2),
      studyHall365EndedKey(SUB),
    ];
    try {
      for (const key of keys) {
        assert.equal(
          (await svc.rpc("claim_email_delivery", {
            p_key: key,
            p_type: "study_hall_365_started",
            p_account: parent.id,
            p_to: "p@x.test",
          })).data,
          true,
          key,
        );
        assert.equal(
          (await svc.rpc("claim_email_delivery", {
            p_key: key,
            p_type: "study_hall_365_started",
            p_account: parent.id,
            p_to: "p@x.test",
          })).data,
          false,
          `replay ${key}`,
        );
      }
    } finally {
      await svc.from("email_deliveries").delete().in("idempotency_key", keys);
      await cleanupAll();
    }
  });
});
