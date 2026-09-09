import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  EMAIL_RETRY_MAX_ATTEMPTS,
  EMAIL_STALE_PENDING_MINUTES,
  backoffMinutesForAttempt,
  deliveryOpsLabel,
  isEmailRecipient,
  isPermanentFailure,
  isRetryEligible,
  isStalePending,
  leasedRetryRows,
  nextRetryAt,
  parseDeliveryIdentity,
  HISTORICAL_RETRY_TYPES,
  CURRENT_STATE_RETRY_TYPES,
  retryClassForType,
} from "../src/lib/notifications/retry-policy.mjs";
import { decideRetryAction, reminderStillTimely } from "../src/lib/notifications/retry-revalidate.mjs";
import { reminderStillValid } from "../src/lib/notifications/reminder-policy.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const BID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GUIDE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const GUIDE_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = Date.parse("2026-09-08T22:00:00.000Z");
const START_FUTURE = "2026-09-08T23:00:00.000Z";
const START_PAST = "2026-09-08T21:00:00.000Z";

function delivery(overrides = {}) {
  return {
    status: "failed",
    attempts: 1,
    next_retry_at: "2026-09-08T21:00:00.000Z",
    updated_at: "2026-09-08T21:00:00.000Z",
    to_email: "parent@example.test",
    error: "resend 500 timeout",
    auto_retry_eligible: true,
    notification_type: "welcome",
    idempotency_key: "welcome:acct",
    subject: "Hello",
    body_html: "<p>Hi</p>",
    body_text: "Hi",
    ...overrides,
  };
}

function confirmedBooking(overrides = {}) {
  return {
    status: "confirmed",
    payment_status: "succeeded",
    scheduled_start: START_FUTURE,
    tutor_id: GUIDE,
    ...overrides,
  };
}

describe("PR7E — successful send and replay", () => {
  it("1. claim still inserts one pending row per key (source)", () => {
    const claim = read("supabase/migrations/0016_phase6_email_retry.sql");
    assert.match(claim, /on conflict \(idempotency_key\) do nothing/);
    const notify = read("src/lib/notify.ts");
    assert.match(notify, /if \(claim\.data !== true\) return \{ status: "duplicate" \}/);
  });

  it("2. same business event replay cannot create a second key", () => {
    assert.equal(parseDeliveryIdentity({ idempotency_key: `customer-no-show-parent:${BID}` }).bookingId, BID);
    assert.equal(
      parseDeliveryIdentity({ idempotency_key: `customer-no-show-parent:${BID}` }).bookingId,
      parseDeliveryIdentity({ idempotency_key: `customer-no-show-parent:${BID}` }).bookingId,
    );
  });
});

describe("PR7E — failed retry eligibility", () => {
  it("3. transient provider failure is eligible", () => {
    assert.equal(isPermanentFailure("resend 500 timeout"), false);
    assert.equal(isRetryEligible(delivery({ error: "resend 503" }), NOW), true);
    assert.equal(isRetryEligible(delivery({ error: "notify exception" }), NOW), true);
  });

  it("4. retry keeps the same idempotency identity (source)", () => {
    const sql = read("supabase/migrations/0045_notification_retry_hardening.sql");
    assert.match(sql, /on conflict \(idempotency_key\) do nothing/);
    assert.match(sql, /claim_email_delivery_retry_batch/);
    assert.match(sql, /for update skip locked/);
    const batchStart = sql.indexOf("claim_email_delivery_retry_batch");
    assert.ok(batchStart >= 0);
    assert.doesNotMatch(sql.slice(batchStart), /insert into public\.email_deliveries/);
  });

  it("5. max attempts is terminal", () => {
    assert.equal(EMAIL_RETRY_MAX_ATTEMPTS, 5);
    assert.equal(isRetryEligible(delivery({ attempts: 5, error: "resend 500" }), NOW), false);
    assert.equal(isRetryEligible(delivery({ attempts: 4, error: "resend 500" }), NOW), true);
    assert.equal(deliveryOpsLabel(delivery({ attempts: 5, next_retry_at: null })), "terminal failure");
  });

  it("6. permanent/non-retryable failure is not auto-retried", () => {
    assert.equal(isPermanentFailure("resend 422 invalid"), true);
    assert.equal(isPermanentFailure("resend 409"), true);
    assert.equal(isPermanentFailure("email.bounced"), true);
    assert.equal(isPermanentFailure("email.complained"), true);
    assert.equal(isRetryEligible(delivery({ error: "resend 422" }), NOW), false);
    assert.equal(isRetryEligible(delivery({ error: "email.bounced" }), NOW), false);
  });
});

describe("PR7E — pending lease and stale recovery", () => {
  it("7. fresh pending is not stolen", () => {
    const row = delivery({
      status: "pending",
      updated_at: new Date(NOW - 60_000).toISOString(),
      provider_message_id: null,
    });
    assert.equal(isStalePending(row, NOW), false);
    assert.equal(isRetryEligible(row, NOW), false);
    assert.equal(EMAIL_STALE_PENDING_MINUTES, 15);
  });

  it("8. stale pending without provider id is recoverable", () => {
    const row = delivery({
      status: "pending",
      updated_at: new Date(NOW - 16 * 60_000).toISOString(),
      provider_message_id: null,
      error: null,
    });
    assert.equal(isStalePending(row, NOW), true);
    assert.equal(isRetryEligible(row, NOW), true);
    const withId = { ...row, provider_message_id: "msg_abc" };
    assert.equal(isRetryEligible(withId, NOW), false, "provider id means send may have been accepted");
  });

  it("9. concurrent workers use SKIP LOCKED (source)", () => {
    const sql = read("supabase/migrations/0045_notification_retry_hardening.sql");
    assert.match(sql, /for update skip locked/);
    assert.match(read("src/app/api/cron/notification-retry/route.ts"), /claim_email_delivery_retry_batch/);
  });
});

describe("PR7E — revalidation", () => {
  it("10. payment-failure after billing recovery does not send", () => {
    const pay = delivery({
      notification_type: "payment_failure",
      idempotency_key: "365-payment-failure:in_old",
    });
    const recovered = decideRetryAction({
      delivery: pay,
      membership: { status: "active", ended_at: null, cancel_at_period_end: false },
      nowMs: NOW,
    });
    assert.equal(recovered.ok, false);
    assert.equal(recovered.reason, "payment_failure_recovered");
    const stillDue = decideRetryAction({
      delivery: pay,
      membership: { status: "past_due", ended_at: null },
      nowMs: NOW,
    });
    assert.equal(stillDue.ok, true);
  });

  it("11. parent reminder after cancellation does not send", () => {
    const rem = delivery({
      notification_type: "reminder_1h",
      idempotency_key: `reminder-1h:${BID}:customer`,
      booking_id: BID,
    });
    const cancelled = decideRetryAction({
      delivery: rem,
      booking: confirmedBooking({ status: "cancelled" }),
      nowMs: NOW,
    });
    assert.equal(cancelled.ok, false);
    assert.equal(reminderStillValid({ status: "cancelled", scheduled_start: START_FUTURE }, { role: "customer" }), false);
  });

  it("12. Guide reminder after reassignment does not send to the old Guide", () => {
    const rem = delivery({
      notification_type: "reminder_1h",
      idempotency_key: `reminder-1h:${BID}:tutor:${GUIDE}`,
      booking_id: BID,
    });
    const moved = decideRetryAction({
      delivery: rem,
      booking: confirmedBooking({ tutor_id: GUIDE_B }),
      nowMs: NOW,
    });
    assert.equal(moved.ok, false);
    assert.equal(moved.reason, "guide_reassigned");
    const stillAssigned = decideRetryAction({
      delivery: rem,
      booking: confirmedBooking({ tutor_id: GUIDE }),
      nowMs: NOW,
    });
    assert.equal(stillAssigned.ok, true);
  });

  it("13. 365 cancellation-scheduled after resume does not send", () => {
    const row = delivery({
      notification_type: "study_hall_365_cancellation_scheduled",
      idempotency_key: "365-cancel-scheduled:sub_1:2026-09-01T00:00:00.000Z",
    });
    const resumed = decideRetryAction({
      delivery: row,
      membership: { status: "active", cancel_at_period_end: false, ended_at: null },
      nowMs: NOW,
    });
    assert.equal(resumed.ok, false);
    assert.equal(resumed.reason, "cancellation_no_longer_scheduled");
    const still = decideRetryAction({
      delivery: row,
      membership: { status: "active", cancel_at_period_end: true, ended_at: null },
      nowMs: NOW,
    });
    assert.equal(still.ok, true);
  });

  it("14. historical customer no-show remains eligible while status is no_show", () => {
    const row = delivery({
      notification_type: "customer_no_show_parent",
      idempotency_key: `customer-no-show-parent:${BID}`,
      booking_id: BID,
    });
    assert.equal(retryClassForType("customer_no_show_parent"), "historical");
    assert.equal(decideRetryAction({ delivery: row, booking: { status: "no_show" }, nowMs: NOW }).ok, true);
    assert.equal(decideRetryAction({ delivery: row, booking: { status: "completed" }, nowMs: NOW }).ok, false);
  });

  it("15. welcome delayed delivery remains acceptable when the account exists", () => {
    const row = delivery({ notification_type: "welcome", idempotency_key: "welcome:acct" });
    assert.equal(retryClassForType("welcome"), "historical");
    assert.equal(decideRetryAction({ delivery: row, profileExists: true, nowMs: NOW }).ok, true);
    assert.equal(decideRetryAction({ delivery: row, profileExists: false, nowMs: NOW }).ok, false);
  });
});

describe("PR7E — terminal provider states and attempts", () => {
  it("16. delivered/sent is never auto-retried", () => {
    assert.equal(isRetryEligible(delivery({ status: "sent", error: null }), NOW), false);
    assert.equal(deliveryOpsLabel({ status: "sent" }), "sent");
    const sql = read("supabase/migrations/0045_notification_retry_hardening.sql");
    assert.match(sql, /when p_status = 'delivered' then 'sent'/);
    assert.match(sql, /when p_status in \('bounced', 'failed', 'delivered'\) then null/);
  });

  it("17. bounce/complaint does not auto-resend", () => {
    assert.equal(isRetryEligible(delivery({ error: "email.bounced" }), NOW), false);
    assert.equal(isRetryEligible(delivery({ error: "email.complained" }), NOW), false);
    const webhook = read("src/app/api/resend/webhook/route.ts");
    assert.match(webhook, /email\.bounced|email\.complained/);
    assert.match(webhook, /record_email_provider_status/);
  });

  it("18. attempts count provider sends, not inspect-only skips", () => {
    assert.equal(backoffMinutesForAttempt(1), 15);
    assert.equal(backoffMinutesForAttempt(3), 60);
    const sql = read("supabase/migrations/0045_notification_retry_hardening.sql");
    assert.match(sql, /Does not increment attempts/);
    assert.doesNotMatch(sql, /when d\.status = 'failed' then d\.attempts \+ 1/);
    const send = read("src/lib/notifications/retry-send.ts");
    assert.match(send, /countProviderSendAttempt/);
    assert.match(send, /attempts: previousAttempts \+ 1/);
    const cron = read("src/app/api/cron/notification-retry/route.ts");
    assert.doesNotMatch(cron, /attempts \+/);
    const iso = nextRetryAt(1, NOW);
    assert.equal(Date.parse(iso) - NOW, 15 * 60_000);
  });
});

describe("PR7E — admin, cron, channels", () => {
  it("19. admin retry revalidates instead of blindly sending", () => {
    const admin = read("src/app/api/admin/notifications/retry/route.ts");
    assert.match(admin, /evaluateEmailDeliveryRetry/);
    assert.match(admin, /retry_email_delivery/);
    assert.match(admin, /countAttempt: false/);
    assert.match(admin, /isEmailRecipient/);
    const evalBeforeLease = admin.indexOf("evaluateEmailDeliveryRetry");
    const leaseAt = admin.indexOf("retry_email_delivery");
    assert.ok(evalBeforeLease >= 0 && evalBeforeLease < leaseAt);
    assert.match(read("src/lib/notifications/retry-send.ts"), /decideRetryAction/);
  });

  it("cron is authenticated and scheduled every 15 minutes", () => {
    const cron = read("src/app/api/cron/notification-retry/route.ts");
    assert.match(cron, /CRON_SECRET/);
    assert.match(cron, /x-cron-secret/);
    const v = JSON.parse(read("vercel.json"));
    const hit = v.crons.find((c) => c.path === "/api/cron/notification-retry");
    assert.equal(hit.schedule, "*/15 * * * *");
  });

  it("SMS/WhatsApp rows are not auto-retried as email", () => {
    assert.equal(isEmailRecipient("sms:parent"), false);
    assert.equal(isEmailRecipient("whatsapp:guide"), false);
    assert.equal(isRetryEligible(delivery({ to_email: "sms:parent", notification_type: "reminder_1h_sms" }), NOW), false);
    assert.equal(retryClassForType("reminder_1h_sms"), "non_email");
    assert.equal(retryClassForType("payment_failure_sms"), "non_email");
    assert.equal(retryClassForType("customer_no_show_parent_sms"), "non_email");
  });

  it("late reminder after start is expired", () => {
    assert.equal(reminderStillTimely({ scheduled_start: START_PAST }, NOW), false);
    const rem = delivery({
      notification_type: "reminder_1h",
      idempotency_key: `reminder-1h:${BID}:customer`,
    });
    const late = decideRetryAction({
      delivery: rem,
      booking: confirmedBooking({ scheduled_start: START_PAST }),
      nowMs: NOW,
    });
    assert.equal(late.ok, false);
    assert.equal(late.reason, "reminder_expired");
  });

  it("does not start PR7F or change providers", () => {
    const cron = read("src/app/api/cron/notification-retry/route.ts");
    assert.doesNotMatch(cron, /consent|sender branding|opt-out/i);
    assert.doesNotMatch(read("supabase/migrations/0045_notification_retry_hardening.sql"), /create table/i);
    assert.match(read("supabase/migrations/0045_notification_retry_hardening.sql"), /add column if not exists next_retry_at/);
  });

  it("failed without next_retry_at is not auto-leased", () => {
    assert.equal(isRetryEligible(delivery({ next_retry_at: null, error: "resend 500" }), NOW), false);
  });

  it("365 resumed after a later cancel-at-period-end does not send", () => {
    const row = delivery({
      notification_type: "study_hall_365_resumed",
      idempotency_key: "365-resumed:sub_1:2026-09-01T00:00:00.000Z",
    });
    const cancelledAgain = decideRetryAction({
      delivery: row,
      membership: {
        status: "active",
        cancel_at_period_end: true,
        ended_at: null,
        current_period_end: "2026-10-01T00:00:00.000Z",
      },
      nowMs: NOW,
    });
    assert.equal(cancelledAgain.ok, false);
    assert.equal(cancelledAgain.reason, "resume_no_longer_valid");
  });

  it("package-balance alerts are skipped after hours recover", () => {
    const low = delivery({ notification_type: "package_balance_low", idempotency_key: `package-low-after:${BID}` });
    const depleted = delivery({
      notification_type: "package_balance_depleted",
      idempotency_key: `package-depleted-after:${BID}`,
    });
    assert.equal(decideRetryAction({ delivery: low, packageMinutes: 180, nowMs: NOW }).ok, false);
    assert.equal(decideRetryAction({ delivery: depleted, packageMinutes: 30, nowMs: NOW }).ok, false);
    assert.equal(decideRetryAction({ delivery: low, packageMinutes: 30, nowMs: NOW }).ok, true);
    assert.equal(decideRetryAction({ delivery: depleted, packageMinutes: 0, nowMs: NOW }).ok, true);
  });

  it("open-coverage and attendance retries require live state", () => {
    const att = delivery({
      notification_type: "guide_attendance_request",
      idempotency_key: `guide-attendance-block:${GUIDE}:${BID}:t30`,
      booking_id: BID,
    });
    assert.equal(
      decideRetryAction({
        delivery: att,
        booking: confirmedBooking(),
        attendanceAwaiting: false,
        nowMs: NOW,
      }).ok,
      false,
    );
    assert.equal(
      decideRetryAction({
        delivery: att,
        booking: confirmedBooking(),
        attendanceAwaiting: true,
        nowMs: NOW,
      }).ok,
      true,
    );
    const cov = delivery({
      notification_type: "guide_open_coverage",
      idempotency_key: `open-coverage:${GUIDE}:${BID}:search1:email`,
      booking_id: BID,
    });
    assert.equal(
      decideRetryAction({
        delivery: cov,
        booking: confirmedBooking(),
        coverageOfferOpen: false,
        nowMs: NOW,
      }).ok,
      false,
    );
    assert.equal(
      decideRetryAction({
        delivery: cov,
        booking: confirmedBooking(),
        coverageOfferOpen: true,
        nowMs: NOW,
      }).ok,
      true,
    );
  });

  it("missing stored content is not retried by parsing HTML", () => {
    const row = delivery({ subject: null, body_html: null, body_text: null });
    assert.equal(decideRetryAction({ delivery: row, nowMs: NOW }).ok, false);
    assert.doesNotMatch(read("src/lib/notifications/retry-revalidate.mjs"), /body_html\.match|innerHTML/i);
  });

  it("provider idempotency key is the delivery row id", () => {
    const transport = read("src/lib/email/transport.ts");
    assert.match(transport, /Idempotency-Key/);
    assert.match(read("src/lib/notifications/retry-send.ts"), /idempotencyKey: typeof delivery\.id === "string" \? delivery\.id/);
    assert.match(read("src/lib/notify.ts"), /idempotencyKey: deliveryId/);
  });

  it("claim batch JSON is normalized to an array", () => {
    assert.equal(leasedRetryRows(null).length, 0);
    assert.equal(leasedRetryRows("[]").length, 0);
    assert.equal(leasedRetryRows([{ id: "1" }]).length, 1);
    assert.equal(leasedRetryRows('[{"id":"1"}]').length, 1);
  });

  it("stale pending SQL requires no provider_message_id", () => {
    const sql = read("supabase/migrations/0045_notification_retry_hardening.sql");
    assert.match(sql, /provider_message_id is null/);
    assert.match(sql, /auto_retry_eligible is true/);
    assert.match(sql, /for update skip locked/);
    assert.match(sql, /to_email not like 'sms:%'/);
  });
});

describe("PR7E — fail-closed allowlist", () => {
  it("1. null notification_type skips", () => {
    const row = delivery({ notification_type: null });
    assert.equal(retryClassForType(null), "unsupported");
    assert.equal(decideRetryAction({ delivery: row, nowMs: NOW }).ok, false);
    assert.equal(decideRetryAction({ delivery: row, nowMs: NOW }).reason, "unknown_notification_type");
    assert.equal(isRetryEligible(row, NOW), false);
  });

  it("2. empty notification_type skips", () => {
    const row = delivery({ notification_type: "  " });
    assert.equal(decideRetryAction({ delivery: row, nowMs: NOW }).reason, "unknown_notification_type");
    assert.equal(isRetryEligible(row, NOW), false);
  });

  it("3. unknown type skips", () => {
    const row = delivery({ notification_type: "legacy_mystery_event" });
    assert.equal(retryClassForType("legacy_mystery_event"), "unsupported");
    assert.equal(decideRetryAction({ delivery: row, nowMs: NOW }).reason, "unsupported_retry_type");
    assert.equal(isRetryEligible(row, NOW), false);
  });

  it("4. deprecated type skips", () => {
    const row = delivery({ notification_type: "recording_failure" });
    assert.equal(retryClassForType("recording_failure"), "unsupported");
    assert.equal(decideRetryAction({ delivery: row, nowMs: NOW }).reason, "unsupported_retry_type");
  });

  it("5. reminder_24h is unsupported and skips", () => {
    assert.equal(retryClassForType("reminder_24h"), "unsupported");
    assert.ok(!CURRENT_STATE_RETRY_TYPES.includes("reminder_24h"));
    const row = delivery({ notification_type: "reminder_24h", idempotency_key: `reminder-24h:${BID}:customer` });
    assert.equal(decideRetryAction({ delivery: row, booking: confirmedBooking(), nowMs: NOW }).reason, "unsupported_retry_type");
  });

  it("6. malformed reminder identity skips", () => {
    const rem = delivery({
      notification_type: "reminder_1h",
      idempotency_key: "not-a-reminder-key",
      booking_id: BID,
    });
    const r = decideRetryAction({ delivery: rem, booking: confirmedBooking(), nowMs: NOW });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "malformed_identity");
  });

  it("7. allowed historical welcome can retry", () => {
    assert.ok(HISTORICAL_RETRY_TYPES.includes("welcome"));
    const row = delivery({ notification_type: "welcome", idempotency_key: "welcome:acct" });
    assert.equal(decideRetryAction({ delivery: row, profileExists: true, nowMs: NOW }).ok, true);
  });

  it("8. allowed current-state type revalidates before send", () => {
    assert.ok(CURRENT_STATE_RETRY_TYPES.includes("reminder_1h"));
    const rem = delivery({
      notification_type: "reminder_1h",
      idempotency_key: `reminder-1h:${BID}:customer`,
      booking_id: BID,
    });
    assert.equal(decideRetryAction({ delivery: rem, booking: confirmedBooking(), nowMs: NOW }).ok, true);
  });

  it("9. stale current-state event skips", () => {
    const rem = delivery({
      notification_type: "reminder_1h",
      idempotency_key: `reminder-1h:${BID}:customer`,
    });
    assert.equal(
      decideRetryAction({
        delivery: rem,
        booking: confirmedBooking({ status: "cancelled" }),
        nowMs: NOW,
      }).ok,
      false,
    );
  });

  it("10. admin retry uses the same fail-closed decision", () => {
    const admin = read("src/app/api/admin/notifications/retry/route.ts");
    assert.match(admin, /evaluateEmailDeliveryRetry/);
    const unknown = decideRetryAction({
      delivery: delivery({ notification_type: "not_a_real_type" }),
      nowMs: NOW,
    });
    assert.equal(unknown.reason, "unsupported_retry_type");
  });

  it("11. admin retry of stale current-state skips", () => {
    const pay = delivery({
      notification_type: "payment_failure",
      idempotency_key: "365-payment-failure:in_old",
    });
    const recovered = decideRetryAction({
      delivery: pay,
      membership: { status: "active", ended_at: null },
      nowMs: NOW,
    });
    assert.equal(recovered.ok, false);
    assert.match(read("src/app/api/admin/notifications/retry/route.ts"), /evaluateEmailDeliveryRetry/);
  });

  it("no generic historical fallthrough send", () => {
    assert.match(read("src/lib/notifications/retry-revalidate.mjs"), /unsupported_retry_type/);
    assert.doesNotMatch(
      read("src/lib/notifications/retry-revalidate.mjs"),
      /if \(klass === RETRY_CLASS\.HISTORICAL\) return \{ ok: true \};\s*return \{ ok: true \}/,
    );
    assert.match(read("src/lib/notifications/retry-revalidate.mjs"), /return skip\("unsupported_retry_type"\)/);
  });

  it("5b. unhandled current-state type skips (every allowlisted type has a handler)", () => {
    const src = read("src/lib/notifications/retry-revalidate.mjs");
    for (const type of CURRENT_STATE_RETRY_TYPES) {
      assert.match(src, new RegExp(`type === "${type}"`));
    }
    assert.match(src, /return skip\("unsupported_retry_type"\)/);
  });
});

describe("PR7E — prospective activation", () => {
  it("12. migration does not backfill old failed rows as due", () => {
    const sql = read("supabase/migrations/0045_notification_retry_hardening.sql");
    assert.match(sql, /Intentionally no UPDATE of existing failed\/pending rows/);
    assert.doesNotMatch(sql, /update public\.email_deliveries\s+set next_retry_at = now\(\)\s+where status = 'failed'/i);
    assert.match(sql, /auto_retry_eligible boolean not null default false/);
    assert.match(sql, /values \(p_key, p_type, p_account, p_to, p_booking, 'pending', 1, p_subject, p_html, p_text, true\)/);
  });

  it("13. pre-PR7E failed rows do not automatically retry", () => {
    const legacy = delivery({ next_retry_at: null, auto_retry_eligible: false, error: "resend 500" });
    assert.equal(isRetryEligible(legacy, NOW), false);
  });

  it("14-15. new transient failure is due and retryable", () => {
    const row = delivery({ error: "resend 503", next_retry_at: "2026-09-08T21:00:00.000Z", attempts: 1 });
    assert.equal(isRetryEligible(row, NOW), true);
    const sql = read("supabase/migrations/0045_notification_retry_hardening.sql");
    assert.match(sql, /if p_status = 'failed' and not v_permanent and coalesce\(v_attempts, 0\) < 5/);
    assert.match(sql, /next_retry_at = v_next/);
  });

  it("16. retry success is terminal sent", () => {
    assert.equal(isRetryEligible(delivery({ status: "sent", error: null }), NOW), false);
  });

  it("17. max attempts remains enforced", () => {
    assert.equal(isRetryEligible(delivery({ attempts: 5, error: "resend 500" }), NOW), false);
    const sql = read("supabase/migrations/0045_notification_retry_hardening.sql");
    assert.match(sql, /attempts < p_max_attempts/);
  });

  it("18-19. pre-PR7E pending does not wake; post-PR7E stale pending can", () => {
    const stale = {
      status: "pending",
      updated_at: new Date(NOW - 16 * 60_000).toISOString(),
      provider_message_id: null,
      to_email: "parent@example.test",
      notification_type: "welcome",
      attempts: 1,
      error: null,
    };
    assert.equal(isRetryEligible({ ...stale, auto_retry_eligible: false }, NOW), false);
    assert.equal(isRetryEligible({ ...stale, auto_retry_eligible: true }, NOW), true);
    const sql = read("supabase/migrations/0045_notification_retry_hardening.sql");
    assert.match(sql, /auto_retry_eligible is true/);
  });

  it("20. post-PR7E pending younger than 15 minutes is not stolen", () => {
    const fresh = delivery({
      status: "pending",
      auto_retry_eligible: true,
      provider_message_id: null,
      updated_at: new Date(NOW - 60_000).toISOString(),
    });
    assert.equal(isRetryEligible(fresh, NOW), false);
  });

  it("21. concurrency protections remain intact", () => {
    const sql = read("supabase/migrations/0045_notification_retry_hardening.sql");
    assert.match(sql, /for update skip locked/);
  });

  it("22. Resend delivery UUID remains the idempotency key", () => {
    assert.match(read("src/lib/email/transport.ts"), /Idempotency-Key/);
    assert.match(read("src/lib/notifications/retry-send.ts"), /idempotencyKey: typeof delivery\.id === "string" \? delivery\.id/);
  });
});
