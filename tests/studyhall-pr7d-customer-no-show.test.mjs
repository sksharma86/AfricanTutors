import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import * as T from "../src/lib/email/templates.mjs";
import { guideNeedsReport } from "../src/lib/guide-portal.mjs";
import { CHANNEL_POLICY, NOTIFICATION_EVENTS } from "../src/lib/notifications/events.mjs";
import {
  CUSTOMER_NO_SHOW_GUIDE_CTA_PATH,
  CUSTOMER_NO_SHOW_GUIDE_DEDUPE_PREFIX,
  CUSTOMER_NO_SHOW_PARENT_CTA_PATH,
  CUSTOMER_NO_SHOW_PARENT_DEDUPE_PREFIX,
  customerNoShowGuideDedupeKey,
  customerNoShowParentDedupeKey,
  shouldNotifyCustomerNoShow,
  shouldNotifyCustomerNoShowAfterRpc,
} from "../src/lib/notifications/customer-no-show.mjs";
import { joinMustWithholdToken, joinPresenceRpcName } from "../src/lib/http-session-join.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const APP = "https://app.studyhall.test";
const BID = "c7d04e8a-2b11-4f0d-9c4a-7e1b6a90d3f2";
const BID_2 = "0f3a91b2-55c8-4d2e-a177-12c9e8b4a6d0";
const WHEN = "2026-09-08T19:00:00.000Z";
const TZ = "America/Chicago";

const FIRST_SUCCESS = {
  status: "no_show",
  idempotent: false,
  booking_status: "no_show",
  guide_paid: true,
  funding_restored: false,
};

const ALREADY_NO_SHOW = {
  status: "no_show",
  idempotent: true,
  booking_status: "no_show",
  guide_paid: true,
  funding_restored: false,
};

function notifyCustomerNoShowSource() {
  const notify = read("src/lib/notify.ts");
  const start = notify.indexOf("export async function notifyCustomerNoShow");
  const end = notify.indexOf("export async function notifyAccountCreditApplied");
  assert.ok(start >= 0 && end > start, "notifyCustomerNoShow must exist");
  return notify.slice(start, end);
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
    "status=no_show",
    "status = no_show",
    "stripe",
    "try_full_earning",
    "restore_booking_value",
    "parent@",
    "guide@",
  ]) {
    assert.ok(!lower.includes(bad.toLowerCase()), `must not leak "${bad}"`);
  }
}

describe("PR7D — authoritative trigger", () => {
  it("1. successful first no-show notifies parent + Guide once (durable keys)", () => {
    assert.equal(shouldNotifyCustomerNoShow(FIRST_SUCCESS), true);
    assert.equal(shouldNotifyCustomerNoShowAfterRpc({ data: FIRST_SUCCESS, error: null }), true);
    assert.equal(customerNoShowParentDedupeKey(BID), `customer-no-show-parent:${BID}`);
    assert.equal(customerNoShowGuideDedupeKey(BID), `customer-no-show-guide:${BID}`);
    assert.equal(CUSTOMER_NO_SHOW_PARENT_DEDUPE_PREFIX, "customer-no-show-parent:");
    assert.equal(CUSTOMER_NO_SHOW_GUIDE_DEDUPE_PREFIX, "customer-no-show-guide:");

    const body = notifyCustomerNoShowSource();
    assert.match(body, /customerNoShowParentDedupeKey\(bookingId\)/);
    assert.match(body, /customerNoShowGuideDedupeKey\(bookingId\)/);
    assert.match(body, /studyHallCustomerNoShowParent/);
    assert.match(body, /studyHallCustomerNoShowGuide/);
    assert.match(body, /b\.status !== "no_show"/);
    assert.match(body, /NOTIFICATION_EVENTS\.CUSTOMER_NO_SHOW_PARENT/);
    assert.match(body, /NOTIFICATION_EVENTS\.CUSTOMER_NO_SHOW_GUIDE/);
  });

  it("2. API/browser retry reuses the same keys (claim_email_delivery owns uniqueness)", () => {
    const firstParent = customerNoShowParentDedupeKey(BID);
    const retryParent = customerNoShowParentDedupeKey(BID);
    const firstGuide = customerNoShowGuideDedupeKey(BID);
    const retryGuide = customerNoShowGuideDedupeKey(BID);
    assert.equal(firstParent, retryParent);
    assert.equal(firstGuide, retryGuide);
    assert.notEqual(firstParent, firstGuide);
    assert.doesNotMatch(firstParent, /Date\.now|Date\.now\(\)/);
    assert.doesNotMatch(firstGuide, /Date\.now|Date\.now\(\)/);

    const api = read("src/app/api/tutor/customer-no-show/route.ts");
    assert.match(api, /notifyCustomerNoShow/);
    assert.match(api, /shouldNotifyCustomerNoShowAfterRpc/);
    assert.doesNotMatch(api, /Date\.now\(\)/);
    assert.doesNotMatch(api, /webhook/);
  });

  it("3. already-no_show idempotent invocation is still eligible; keys do not change", () => {
    assert.equal(shouldNotifyCustomerNoShow(ALREADY_NO_SHOW), true);
    assert.equal(shouldNotifyCustomerNoShowAfterRpc({ data: ALREADY_NO_SHOW, error: null }), true);
    assert.equal(customerNoShowParentDedupeKey(BID), customerNoShowParentDedupeKey(BID));
    assert.notEqual(customerNoShowParentDedupeKey(BID), customerNoShowParentDedupeKey(BID_2));
    const body = notifyCustomerNoShowSource();
    assert.doesNotMatch(body, /idempotent:\s*false|idempotent === false/);
  });
});

describe("PR7D — rejected PR6 outcomes never notify", () => {
  it("4. attempt before T+15 is rejected → no emails", () => {
    assert.equal(
      shouldNotifyCustomerNoShowAfterRpc({
        data: null,
        error: { message: "Customer no-show can be marked 15 minutes after the scheduled start" },
      }),
      false,
    );
    const api = read("src/app/api/tutor/customer-no-show/route.ts");
    const post = api.slice(api.indexOf("export async function POST"));
    const rpcIdx = post.indexOf("guide_mark_customer_no_show");
    const errorReturn = post.indexOf("if (error) return mapError");
    const notifyIdx = post.indexOf("notifyCustomerNoShow");
    assert.ok(rpcIdx >= 0 && errorReturn > rpcIdx && notifyIdx > errorReturn);
    assert.match(read("supabase/migrations/0043_guide_customer_no_show.sql"), /now\(\) < v_bk\.scheduled_start \+ interval '15 minutes'/);
  });

  it("5. student presence exists → no-show rejected → no emails", () => {
    assert.equal(
      shouldNotifyCustomerNoShowAfterRpc({
        data: null,
        error: { message: "The child has already joined this Study Hall" },
      }),
      false,
    );
    assert.match(
      read("supabase/migrations/0043_guide_customer_no_show.sql"),
      /if v_student_joined is not null then[\s\S]*raise exception 'The child has already joined/,
    );
  });

  it("6. wrong/unassigned Guide → rejected → no emails", () => {
    assert.equal(
      shouldNotifyCustomerNoShowAfterRpc({
        data: null,
        error: { message: "Not authorized" },
      }),
      false,
    );
    assert.match(
      read("src/app/api/tutor/customer-no-show/route.ts"),
      /You can only mark customer no-show for your assigned Study Hall/,
    );
  });

  it("7. non-confirmed booking → no emails", () => {
    assert.equal(
      shouldNotifyCustomerNoShowAfterRpc({
        data: null,
        error: { message: "This Study Hall is not eligible" },
      }),
      false,
    );
    assert.equal(shouldNotifyCustomerNoShow({ status: "confirmed" }), false);
    assert.equal(shouldNotifyCustomerNoShow({ status: "completed" }), false);
    assert.equal(shouldNotifyCustomerNoShow({ status: "cancelled" }), false);
    assert.equal(shouldNotifyCustomerNoShow({ status: "pending" }), false);
    assert.equal(shouldNotifyCustomerNoShow(null), false);
    assert.equal(shouldNotifyCustomerNoShow({}), false);
  });
});

describe("PR7D — PR6 economics and report policy are unchanged", () => {
  it("8. successful no-show keeps funding consumed", () => {
    assert.equal(FIRST_SUCCESS.funding_restored, false);
    assert.equal(ALREADY_NO_SHOW.funding_restored, false);
    const sql = read("supabase/migrations/0043_guide_customer_no_show.sql");
    assert.match(sql, /Does NOT call restore_booking_value/);
    assert.doesNotMatch(sql, /perform public\.restore_booking_value/);
    const notify = notifyCustomerNoShowSource();
    assert.doesNotMatch(notify, /restore_booking_value|funding_restored:\s*true/);
    const parent = T.studyHallCustomerNoShowParent({ whenISO: WHEN, tz: TZ, appUrl: APP });
    assert.match(parent.text, /this Study Hall remains used/);
    assert.doesNotMatch(parent.text, /refund|credit restored|hours restored|exception/i);
  });

  it("9. successful no-show keeps exactly one Guide earning path (PR6 try_full_earning)", () => {
    assert.equal(FIRST_SUCCESS.guide_paid, true);
    const sql = read("supabase/migrations/0043_guide_customer_no_show.sql");
    assert.match(sql, /perform public\.try_full_earning\(p_booking, 'customer no-show — full tutor compensation'\)/);
    const notify = notifyCustomerNoShowSource();
    assert.doesNotMatch(notify, /try_full_earning|insert into .*earnings|guide_earnings/);
    assert.equal(guideNeedsReport({ status: "no_show", scheduled_start: WHEN }), false);
  });
});

describe("PR7D — parent and Guide copy", () => {
  it("10. parent copy is missed Study Hall, no report, funding used", () => {
    const mail = T.studyHallCustomerNoShowParent({ whenISO: WHEN, tz: TZ, appUrl: APP });
    assert.equal(mail.subject, "Study Hall missed");
    assert.match(mail.text, /was missed/);
    assert.match(mail.text, /waited through the attendance window/);
    assert.match(mail.text, /was not completed/);
    assert.match(mail.text, /No session report is expected/);
    assert.match(mail.text, /this Study Hall remains used/);
    assert.match(mail.text, /\/dashboard\/student\/study-halls/);
    assert.equal(CUSTOMER_NO_SHOW_PARENT_CTA_PATH, "/dashboard/student/study-halls");
    assert.doesNotMatch(mail.subject + mail.text + mail.html, /status\s*=\s*no_show|no_show/);
    assert.doesNotMatch(mail.text, /report is ready|expect a report/i);
    assert.doesNotMatch(mail.text, /refund|restore|credit back/i);
    assert.doesNotMatch(mail.text, /did not show|failed to attend|your child missed/i);
    assert.match(mail.html, /View Study Halls/);
    assertNoLeaks(mail);
  });

  it("11. Guide copy confirms customer no-show, no report, full compensation", () => {
    const mail = T.studyHallCustomerNoShowGuide({ whenISO: WHEN, tz: TZ, appUrl: APP });
    assert.equal(mail.subject, "Customer no-show confirmed");
    assert.match(mail.text, /recorded as a customer no-show/);
    assert.match(mail.text, /No session report is required/);
    assert.match(mail.text, /full compensation/);
    assert.match(mail.text, /\/dashboard\/tutor\/study-halls/);
    assert.equal(CUSTOMER_NO_SHOW_GUIDE_CTA_PATH, "/dashboard/tutor/study-halls");
    assert.doesNotMatch(mail.text, /parent@|phone|sms|whatsapp/i);
    assert.doesNotMatch(mail.text, /must submit a report|report is ready/i);
    assert.doesNotMatch(mail.text, /\$\d/);
    assertNoLeaks(mail);
  });

  it("household-local time is used when a timezone is provided", () => {
    const mail = T.studyHallCustomerNoShowParent({ whenISO: WHEN, tz: TZ, appUrl: APP });
    const when = T.formatWhen(WHEN, TZ);
    assert.match(mail.text, new RegExp(when.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

describe("PR7D — channels", () => {
  it("12. parent SMS is consent-gated; catalog lists it; Guide SMS is not sent", () => {
    assert.ok(CHANNEL_POLICY.sms.includes("customer_no_show_parent"));
    assert.deepEqual(CHANNEL_POLICY.pr7d_customer_no_show.parent, ["email"]);
    assert.deepEqual(CHANNEL_POLICY.pr7f_shipped.customer_no_show_parent.parent, ["email", "sms"]);
    const body = notifyCustomerNoShowSource();
    assert.match(body, /deliverParentSms/);
    assert.match(body, /parentNoShowSms/);
    assert.match(body, /customer_no_show_parent_sms/);
    assert.doesNotMatch(body, /sendParentAttentionSms/);
  });

  it("13. no Guide SMS or WhatsApp", () => {
    assert.ok(!CHANNEL_POLICY.sms.includes("customer_no_show_guide"));
    assert.ok(!(CHANNEL_POLICY.whatsapp || []).includes("customer_no_show_guide"));
    assert.ok(!(CHANNEL_POLICY.whatsapp || []).includes("customer_no_show_parent"));
    const body = notifyCustomerNoShowSource();
    assert.doesNotMatch(body, /deliverGuideWhatsApp|sendGuideWhatsApp/);
  });

  it("14. no routine Management notification", () => {
    assert.deepEqual(CHANNEL_POLICY.pr7_lifecycle.customer_no_show_parent.manager, []);
    assert.deepEqual(CHANNEL_POLICY.pr7_lifecycle.customer_no_show_guide.manager, []);
    assert.deepEqual(CHANNEL_POLICY.pr7d_customer_no_show.manager, []);
    const body = notifyCustomerNoShowSource();
    assert.doesNotMatch(body, /notifyAdminAlert|ADMIN_ALERT_EMAIL|manager/);
    assert.doesNotMatch(read("src/app/api/tutor/customer-no-show/route.ts"), /notifyAdminAlert/);
    assert.doesNotMatch(read("src/app/api/admin/booking/route.ts"), /notifyCustomerNoShow/);
  });
});

describe("PR7D — failure isolation and race safety", () => {
  it("15. notification failure cannot change the successful no-show JSON", () => {
    const api = read("src/app/api/tutor/customer-no-show/route.ts");
    const post = api.slice(api.indexOf("export async function POST"));
    assert.match(post, /try \{/);
    assert.match(post, /notifications are side effects/);
    assert.match(post, /return NextResponse\.json\(data\)/);
    const notifyCall = post.indexOf("notifyCustomerNoShow");
    const returnIdx = post.lastIndexOf("return NextResponse.json(data)");
    assert.ok(notifyCall >= 0 && returnIdx > notifyCall);
    const body = notifyCustomerNoShowSource();
    assert.match(body, /catch \{/);
    assert.match(body, /return \{ status: "failed" \}/);
    assert.doesNotMatch(body, /restore_booking_value|status = 'confirmed'|delete.*earning/);
  });

  it("16. presence / no-show race protection is unchanged", () => {
    assert.equal(joinPresenceRpcName(), "finalize_http_session_join");
    assert.equal(
      joinMustWithholdToken({ error: { message: "This Study Hall is not joinable" }, data: null }),
      true,
    );
    const sql = read("supabase/migrations/0043_guide_customer_no_show.sql");
    assert.match(sql, /for update/);
    assert.match(sql, /finalize_http_session_join/);
    assert.match(sql, /guide_mark_customer_no_show/);
    const api = read("src/app/api/tutor/customer-no-show/route.ts");
    assert.doesNotMatch(api, /finalize_http_session_join|record_session_presence/);
    const notify = notifyCustomerNoShowSource();
    assert.doesNotMatch(notify, /finalize_http_session_join|session_presence/);
  });
});

describe("PR7D — identifiers, CTAs, and production-safety bounds", () => {
  it("uses PR7A identifiers and application routes, not provider URLs", () => {
    assert.equal(NOTIFICATION_EVENTS.CUSTOMER_NO_SHOW_PARENT, "customer_no_show_parent");
    assert.equal(NOTIFICATION_EVENTS.CUSTOMER_NO_SHOW_GUIDE, "customer_no_show_guide");
    assert.ok(CHANNEL_POLICY.email.includes("customer_no_show_parent"));
    assert.ok(CHANNEL_POLICY.email.includes("customer_no_show_guide"));
    const parent = T.studyHallCustomerNoShowParent({ whenISO: WHEN, tz: TZ, appUrl: APP });
    const guide = T.studyHallCustomerNoShowGuide({ whenISO: WHEN, tz: TZ, appUrl: APP });
    assert.doesNotMatch(parent.html + guide.html, /daily\.co|resend\.com|twilio\.com|billing\.stripe/);
  });

  it("does not start PR8, does not touch admin_no_show, and skips live providers", () => {
    const notify = read("src/lib/notify.ts");
    const body = notifyCustomerNoShowSource();
    assert.doesNotMatch(read("src/app/api/admin/booking/route.ts"), /notifyCustomerNoShow/);
    assert.doesNotMatch(read("src/app/api/stripe/webhook/route.ts"), /notifyCustomerNoShow|customer_no_show/);
    assert.match(notify, /claim_email_delivery/);
    assert.doesNotMatch(body, /Date\.now\(\)/);
  });
});
