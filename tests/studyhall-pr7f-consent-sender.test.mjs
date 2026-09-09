import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  EMAIL_FROM_PLACEHOLDER,
  EMAIL_SENDER_DISPLAY_NAME,
  isPlaceholderEmailFrom,
  resolveEmailFrom,
  resolveEmailReplyTo,
} from "../src/lib/email/from.mjs";
import { CHANNEL_POLICY, NOTIFICATION_EVENTS } from "../src/lib/notifications/events.mjs";
import {
  isParentTransactionalSmsEligible,
  isUsableParentPhone,
  PARENT_SMS_CONSENT_HELP,
  PARENT_SMS_CONSENT_LABEL,
  PARENT_SMS_OFF_HELP,
  PARENT_SMS_PHONE_PURPOSE,
  PARENT_SMS_TWILIO_RESTART_NOTE,
  parentTransactionalSmsEligible,
  smsIdempotencyKey,
} from "../src/lib/notifications/parent-sms-consent.mjs";
import { retryClassForType } from "../src/lib/notifications/retry-policy.mjs";
import { classifyInboundSmsKeyword, inboundFromE164 } from "../src/lib/notifications/sms-opt-out.mjs";
import {
  parentCancellationSms,
  parentNoShowSms,
  parentPaymentFailureSms,
  parentSessionReminderSms,
} from "../src/lib/notifications/sms-copy.mjs";
import {
  customerNoShowParentDedupeKey,
  customerNoShowParentSmsKey,
} from "../src/lib/notifications/customer-no-show.mjs";
import {
  studyHall365PaymentFailureKey,
  studyHall365PaymentFailureSmsKey,
} from "../src/lib/notifications/study-hall-365-payment-failure.mjs";
import { CALL_PARENT_SMS_MESSAGE, CALL_PARENT_VOICE_MESSAGE } from "../src/lib/call-parent.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const PHONE = "+15551234567";
const INV = "in_pr7f_1";
const BID = "c7d04e8a-2b11-4f0d-9c4a-7e1b6a90d3f2";

function notifyFn(name, nextExport) {
  const notify = read("src/lib/notify.ts");
  const start = notify.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `${name} must exist`);
  const end = nextExport ? notify.indexOf(`export async function ${nextExport}`, start + 1) : notify.length;
  assert.ok(end > start, `${nextExport || "eof"} after ${name}`);
  return notify.slice(start, end);
}

describe("PR7F — SMS eligibility predicate", () => {
  it("1. phone + opted in → eligible", () => {
    const r = parentTransactionalSmsEligible({ phone_e164: PHONE, sms_transactional_opt_in: true });
    assert.equal(r.ok, true);
    assert.equal(isParentTransactionalSmsEligible({ phone_e164: PHONE, sms_transactional_opt_in: true }), true);
  });

  it("2. phone + never opted in → not eligible", () => {
    const r = parentTransactionalSmsEligible({ phone_e164: PHONE, sms_transactional_opt_in: false });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "sms_not_opted_in");
    assert.equal(parentTransactionalSmsEligible({ phone_e164: PHONE }).ok, false);
    assert.equal(isUsableParentPhone(PHONE), true);
  });

  it("3. explicit opt-out → not eligible", () => {
    const r = parentTransactionalSmsEligible({ phone_e164: PHONE, sms_transactional_opt_in: false });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "sms_not_opted_in");
  });

  it("4. opted in but phone missing → not eligible", () => {
    assert.equal(parentTransactionalSmsEligible({ phone_e164: null, sms_transactional_opt_in: true }).reason, "no_phone");
    assert.equal(parentTransactionalSmsEligible({ phone_e164: "", sms_transactional_opt_in: true }).reason, "no_phone");
    assert.equal(parentTransactionalSmsEligible({ phone_e164: "555", sms_transactional_opt_in: true }).reason, "no_phone");
  });

  it("does not infer consent from phone_e164 alone", () => {
    const sql = read("supabase/migrations/0046_parent_sms_transactional_consent.sql");
    assert.match(sql, /sms_transactional_opt_in boolean not null default false/);
    assert.match(sql, /Never inferred from phone_e164/);
    assert.doesNotMatch(sql, /phone_e164 is not null/);
    assert.doesNotMatch(read("src/lib/notifications/parent-sms-consent.mjs"), /phone_e164 IS NOT NULL/);
  });
});

describe("PR7F — email independent of SMS", () => {
  it("5. email still sends when SMS is declined", () => {
    const reminder = notifyFn("notifyReminder", "notifyGuideReportRequired");
    assert.match(reminder, /const emailResult = await deliver\(/);
    assert.match(reminder, /await deliverParentSms/);
    assert.match(reminder, /return emailResult/);
    const pay = notifyFn("notifyStudyHall365PaymentFailure", "notifyCustomerNoShow");
    assert.match(pay, /const emailResult = await deliver\(/);
    assert.match(pay, /await deliverParentSms/);
    assert.match(pay, /return emailResult/);
    const skip = read("src/lib/notify.ts");
    assert.match(skip, /p_error: eligibility\.reason/);
    assert.doesNotMatch(skip, /throw.*sms_not_opted_in/);
  });
});

describe("PR7F — T-1h reminder channels", () => {
  it("6. opted in → email + SMS; opted out → email only; cadence unchanged", () => {
    const reminder = notifyFn("notifyReminder", "notifyGuideReportRequired");
    assert.match(reminder, /shouldSendReminder/);
    assert.match(reminder, /reminder-1h-sms:/);
    assert.match(reminder, /parentTransactionalSmsEligible|deliverParentSms/);
    assert.doesNotMatch(reminder, /"24h"|kind: "24h"|T-15|T-5/);
    const cron = read("src/app/api/cron/reminders/route.ts");
    assert.doesNotMatch(cron, /"24h"|kind: "24h"/);
    const sms = parentSessionReminderSms({ studentName: "Maya", whenISO: "2026-08-20T19:00:00.000Z", tz: "UTC" });
    assert.match(sms, /^Study Hall:/);
  });
});

describe("PR7F — payment failure + no-show SMS", () => {
  it("7. payment failure: email always attempted; SMS consent-gated and distinct key", () => {
    const pay = notifyFn("notifyStudyHall365PaymentFailure", "notifyCustomerNoShow");
    assert.match(pay, /PAYMENT_FAILURE/);
    assert.match(pay, /deliverParentSms/);
    assert.match(pay, /payment_failure_sms/);
    assert.match(pay, /parentPaymentFailureSms/);
    assert.equal(studyHall365PaymentFailureSmsKey(INV), `sms:${studyHall365PaymentFailureKey(INV)}`);
    assert.notEqual(studyHall365PaymentFailureSmsKey(INV), studyHall365PaymentFailureKey(INV));
    const sms = parentPaymentFailureSms({ appUrl: "https://app.studyhall.test" });
    assert.match(sms, /^Study Hall:/);
    assert.match(sms, /couldn't process your Study Hall 365 payment/i);
    assert.doesNotMatch(sms, /marketing|unsubscribe to news/i);
  });

  it("8. customer no-show: parent email + consent-gated SMS; Guide email only", () => {
    const body = notifyFn("notifyCustomerNoShow", "notifyAccountCreditApplied");
    assert.match(body, /deliverParentSms/);
    assert.match(body, /customer_no_show_parent_sms/);
    assert.match(body, /parentNoShowSms/);
    assert.match(body, /CUSTOMER_NO_SHOW_GUIDE/);
    assert.doesNotMatch(body, /deliverGuideWhatsApp|sendGuideWhatsApp/);
    assert.doesNotMatch(body, /notifyAdminAlert/);
    const sms = parentNoShowSms();
    assert.match(sms, /^Study Hall:/);
    assert.match(sms, /marked missed/);
    assert.doesNotMatch(sms, /lazy|shame|failed to show|no_show/i);
  });

  it("9. replayed payment failure uses the same SMS key", () => {
    assert.equal(studyHall365PaymentFailureSmsKey(INV), studyHall365PaymentFailureSmsKey(INV));
    assert.equal(smsIdempotencyKey(studyHall365PaymentFailureKey(INV)), studyHall365PaymentFailureSmsKey(INV));
  });

  it("10. replayed no-show uses the same SMS key", () => {
    assert.equal(customerNoShowParentSmsKey(BID), `sms:${customerNoShowParentDedupeKey(BID)}`);
    assert.equal(customerNoShowParentSmsKey(BID), customerNoShowParentSmsKey(BID));
    assert.notEqual(customerNoShowParentSmsKey(BID), customerNoShowParentDedupeKey(BID));
  });
});

describe("PR7F — Guide and Management SMS", () => {
  it("11. Guide receives no SMS", () => {
    assert.ok(!CHANNEL_POLICY.sms.includes("customer_no_show_guide"));
    assert.ok(!CHANNEL_POLICY.sms.includes("guide_session_reminder"));
    const noShow = notifyFn("notifyCustomerNoShow", "notifyAccountCreditApplied");
    assert.match(noShow, /deliverParentSms\(\{[\s\S]*?accountId: b\.account_id/);
    assert.match(noShow, /CUSTOMER_NO_SHOW_GUIDE[\s\S]*accountId: b\.tutor_id/);
    assert.deepEqual(CHANNEL_POLICY.pr7f_shipped.customer_no_show_guide.guide, ["email"]);
    assert.deepEqual(CHANNEL_POLICY.pr7f_shipped.customer_no_show_guide.parent, []);
  });

  it("12. Management receives no routine SMS", () => {
    assert.deepEqual(CHANNEL_POLICY.pr7f_shipped.payment_failure.manager, []);
    assert.deepEqual(CHANNEL_POLICY.pr7f_shipped.customer_no_show_parent.manager, []);
    const pay = notifyFn("notifyStudyHall365PaymentFailure", "notifyCustomerNoShow");
    const noShow = notifyFn("notifyCustomerNoShow", "notifyAccountCreditApplied");
    assert.doesNotMatch(pay, /notifyAdminAlert/);
    assert.doesNotMatch(noShow, /notifyAdminAlert/);
  });
});

describe("PR7F — STOP/START", () => {
  it("13–15. STOP persists; future SMS blocked; email unaffected", () => {
    for (const word of ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]) {
      assert.equal(classifyInboundSmsKeyword(word), "opt_out");
    }
    for (const word of ["START", "YES", "UNSTOP"]) {
      assert.equal(classifyInboundSmsKeyword(word), "opt_in");
    }
    assert.equal(classifyInboundSmsKeyword("please stop by"), null);
    assert.equal(classifyInboundSmsKeyword("hello", "STOP"), "opt_out");
    assert.equal(inboundFromE164("+15551234567"), "+15551234567");
    const sql = read("supabase/migrations/0046_parent_sms_transactional_consent.sql");
    assert.match(sql, /apply_inbound_sms_keyword/);
    assert.match(sql, /twilio_stop/);
    assert.match(sql, /sms_transactional_opt_in = false/);
    const inbound = read("src/app/api/twilio/inbound-sms/route.ts");
    assert.match(inbound, /validateTwilioSignature/);
    assert.match(inbound, /apply_inbound_sms_keyword/);
    assert.match(inbound, /<Response><\/Response>/);
    assert.match(inbound, /reply START/);
    const deliver = read("src/lib/notify.ts");
    assert.match(deliver, /parentTransactionalSmsEligible/);
    assert.match(deliver, /eligibility\.reason/);
  });
});

describe("PR7F — Call Parent voice vs SMS", () => {
  it("16. Call Parent voice is unaffected by SMS preference", () => {
    const svc = read("src/lib/call-parent-service.ts");
    const fulfill = svc.slice(svc.indexOf("export async function fulfillParentEscalation"));
    const voice = fulfill.slice(0, fulfill.indexOf("sendSmsFallbackForEscalation"));
    assert.match(voice, /placeParentAttentionCall/);
    assert.match(voice, /select\("phone_e164"\)/);
    assert.doesNotMatch(voice.slice(0, voice.indexOf("placeParentAttentionCall")), /parentTransactionalSmsEligible/);
    assert.match(CALL_PARENT_VOICE_MESSAGE, /Study Hall \(at home\) needs your attention/);
    assert.match(CALL_PARENT_SMS_MESSAGE, /^Study Hall:/);
  });

  it("17. no phone number exposed to Guide", () => {
    const ctrl = read("src/components/session/call-parent-control.tsx");
    assert.doesNotMatch(ctrl, /phone_e164|toE164|\+1/);
    assert.match(read("src/lib/call-parent-service.ts"), /never includes phone/);
    const form = read("src/components/dashboard/parent-phone-form.tsx");
    assert.match(form, /Guides never see your phone number/);
  });
});

describe("PR7F — Account + signup UX", () => {
  it("18. Account toggle updates durable preference", () => {
    const form = read("src/components/dashboard/parent-phone-form.tsx");
    assert.match(form, /\/api\/account\/sms-preference/);
    assert.match(form, /optIn: next/);
    assert.match(form, /PARENT_SMS_CONSENT_LABEL/);
    const api = read("src/app/api/account/sms-preference/route.ts");
    assert.match(api, /set_my_sms_transactional_preference/);
    assert.match(api, /p_opt_in: body\.optIn/);
    const phoneApi = read("src/app/api/account/phone/route.ts");
    assert.doesNotMatch(phoneApi, /sms_transactional|opt_in/);
    const sql = read("supabase/migrations/0046_parent_sms_transactional_consent.sql");
    assert.match(sql, /sms_transactional_source = 'account'/);
  });

  it("19. phone-purpose copy is present at the phone-entry surface", () => {
    const form = read("src/components/dashboard/parent-phone-form.tsx");
    assert.match(form, /PARENT_SMS_PHONE_PURPOSE/);
    assert.match(PARENT_SMS_PHONE_PURPOSE, /reach you about your Study Halls/i);
    assert.match(PARENT_SMS_PHONE_PURPOSE, /don't sell your phone number/i);
    assert.doesNotMatch(PARENT_SMS_PHONE_PURPOSE, /marketing/);
    const signup = read("src/app/(marketing)/signup/page.tsx") + read("src/components/auth/signup-form.tsx");
    assert.doesNotMatch(signup, /type="tel"|parent-phone|sms-opt-in/);
  });

  it("20. SMS consent copy is transactional / non-marketing", () => {
    assert.equal(PARENT_SMS_CONSENT_LABEL, "Send me Study Hall text alerts");
    assert.match(PARENT_SMS_CONSENT_HELP, /Operational texts only/);
    assert.match(PARENT_SMS_CONSENT_HELP, /Not marketing/);
    assert.match(PARENT_SMS_CONSENT_HELP, /Consent is optional/);
    assert.match(PARENT_SMS_OFF_HELP, /You'll still receive important updates by email/);
    assert.match(PARENT_SMS_TWILIO_RESTART_NOTE, /reply START/);
    const form = read("src/components/dashboard/parent-phone-form.tsx");
    assert.match(form, /initialSmsOptIn === true/);
    assert.doesNotMatch(form, /defaultChecked/);
    const terms = read("src/app/(marketing)/terms/page.tsx");
    const privacy = read("src/app/(marketing)/privacy/page.tsx");
    assert.match(terms, /not promotional or marketing/);
    assert.match(privacy, /sent only if you opt in/);
    assert.match(terms, /text STOP/);
  });
});

describe("PR7F — sender branding", () => {
  it("21. sender branding uses Study Hall identity", () => {
    assert.equal(EMAIL_SENDER_DISPLAY_NAME, "Study Hall at Home");
    assert.match(EMAIL_FROM_PLACEHOLDER, /Study Hall at Home/);
    assert.match(parentCancellationSms({ studentName: "Maya", whenISO: "2026-08-20T19:00:00.000Z", tz: "UTC" }), /^Study Hall:/);
    assert.match(CALL_PARENT_SMS_MESSAGE, /^Study Hall:/);
    const templates = read("src/lib/email/templates.mjs");
    assert.match(templates, /const BRAND = "Study Hall \(at home\)"/);
  });

  it("22. no .example sender can silently be used", () => {
    assert.equal(isPlaceholderEmailFrom("Study Hall at Home <notifications@studyhallathome.example>"), true);
    assert.equal(isPlaceholderEmailFrom("Study Hall at Home <notifications@example.com>"), true);
    assert.equal(isPlaceholderEmailFrom(""), true);
    assert.equal(isPlaceholderEmailFrom("Study Hall at Home <notifications@studyhallathome.com>"), false);
    const prevFrom = process.env.EMAIL_FROM;
    const prevReply = process.env.EMAIL_REPLY_TO;
    try {
      process.env.EMAIL_FROM = "Study Hall at Home <notifications@studyhallathome.example>";
      assert.equal(resolveEmailFrom(), null);
      process.env.EMAIL_FROM = "Study Hall at Home <notifications@studyhallathome.com>";
      assert.equal(resolveEmailFrom(), "Study Hall at Home <notifications@studyhallathome.com>");
      process.env.EMAIL_REPLY_TO = "";
      assert.equal(resolveEmailReplyTo(), null);
    } finally {
      if (prevFrom === undefined) delete process.env.EMAIL_FROM;
      else process.env.EMAIL_FROM = prevFrom;
      if (prevReply === undefined) delete process.env.EMAIL_REPLY_TO;
      else process.env.EMAIL_REPLY_TO = prevReply;
    }
    const transport = read("src/lib/email/transport.ts");
    assert.match(transport, /email_from_unconfigured/);
    assert.match(transport, /resolveEmailFrom/);
    assert.doesNotMatch(transport, /from: EMAIL_FROM/);
    assert.match(read(".env.example"), /EMAIL_FROM=/);
    assert.doesNotMatch(read(".env.example"), /EMAIL_FROM="Study Hall \(at home\) <notifications@example.com>"/);
  });
});

describe("PR7F — retry remains email-only", () => {
  it("23. PR7E email retry excludes SMS/WhatsApp", () => {
    assert.equal(retryClassForType("reminder_1h_sms"), "non_email");
    assert.equal(retryClassForType("payment_failure_sms"), "non_email");
    assert.equal(retryClassForType("customer_no_show_parent_sms"), "non_email");
    assert.equal(retryClassForType("coverage_cancellation_sms"), "non_email");
    const cron = read("src/app/api/cron/notification-retry/route.ts");
    assert.match(cron, /claim_email_delivery_retry_batch/);
    assert.doesNotMatch(cron, /deliverParentSms|sendParentAttentionSms/);
    const sql = read("supabase/migrations/0045_notification_retry_hardening.sql");
    assert.match(sql, /sms:|whatsapp:/i);
  });
});

describe("PR7F — production safety", () => {
  it("does not apply 0046, send live traffic, or start PR8", () => {
    const sql = read("supabase/migrations/0046_parent_sms_transactional_consent.sql");
    const inbound = read("src/app/api/twilio/inbound-sms/route.ts");
    assert.match(sql, /Do not apply/);
    assert.match(inbound, /do not change production/i);
  });

  it("Call Parent SMS fallback uses the same consent predicate", () => {
    const svc = read("src/lib/call-parent-service.ts");
    assert.match(svc, /sms_not_opted_in/);
    assert.match(svc, /parentTransactionalSmsEligible\(profile\)\.ok/);
    assert.match(svc, /p_sms_attempted: false/);
  });
});
