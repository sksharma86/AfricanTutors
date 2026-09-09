import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  DEFAULT_ACCOUNT_TIMEZONE,
  instantInPaidWindow,
  localDateForInstant,
  localDateOverlapsPaidPeriod,
  localDatesOverlappingPeriod,
  localDayUtcBounds,
  utcInstantForLocalParts,
} from "../src/lib/study-hall-365/calendar.mjs";
import {
  PACKAGE_10SH_MINUTES,
  PACKAGE_10SH_PRICE_CENTS,
  PACKAGE_CODE_10_STUDY_HALLS,
  STUDY_HALL_365_KIND,
  STUDY_HALL_365_MONTHLY_CENTS,
  customerFacingPrepaidPackages,
} from "../src/lib/study-hall-365/catalog.mjs";
import {
  chooseBookingSource,
  evaluateStudyHall365Day,
  isSubscriptionEntitled,
} from "../src/lib/study-hall-365/entitlement.mjs";
import { invoiceSubscriptionId, subscriptionPaidPeriod } from "../src/lib/study-hall-365/stripe-period.mjs";
import { parentPaymentPurposeLabel } from "../src/lib/parent-portal.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Study Hall 365 — subscription status entitlement", () => {
  const periodEnd = "2026-10-17T17:00:00.000Z";
  const now = new Date("2026-09-20T12:00:00.000Z");

  it("active is entitled; trialing / past_due / unpaid / incomplete / paused are not", () => {
    const opts = { periodEnd, now };
    assert.equal(isSubscriptionEntitled("active", opts), true);
    assert.equal(isSubscriptionEntitled("trialing", opts), false);
    assert.equal(isSubscriptionEntitled("past_due", opts), false);
    assert.equal(isSubscriptionEntitled("unpaid", opts), false);
    assert.equal(isSubscriptionEntitled("incomplete", opts), false);
    assert.equal(isSubscriptionEntitled("incomplete_expired", opts), false);
    assert.equal(isSubscriptionEntitled("paused", opts), false);
    assert.equal(isSubscriptionEntitled("ended", opts), false);
  });

  it("canceled + cancel_at_period_end stays entitled only before period end", () => {
    assert.equal(
      isSubscriptionEntitled("canceled", { cancelAtPeriodEnd: true, periodEnd, now }),
      true,
    );
    assert.equal(
      isSubscriptionEntitled("canceled", {
        cancelAtPeriodEnd: true,
        periodEnd,
        now: new Date("2026-10-17T17:00:00.000Z"),
      }),
      false,
    );
    assert.equal(
      isSubscriptionEntitled("canceled", { cancelAtPeriodEnd: false, periodEnd, now }),
      false,
    );
  });

  it("ended_at or missing period denies access", () => {
    assert.equal(isSubscriptionEntitled("active", { periodEnd: null, now }), false);
    assert.equal(
      isSubscriptionEntitled("active", {
        periodEnd,
        endedAt: "2026-09-18T00:00:00.000Z",
        now,
      }),
      false,
    );
  });
});

describe("Study Hall 365 — timezone and civil-day boundaries", () => {
  it("uses IANA zones, not UTC truncation, near local and UTC midnight", () => {
    const utcSep11 = new Date("2026-09-11T04:30:00.000Z"); // 11:30pm Sep 10 in Chicago
    assert.equal(localDateForInstant(utcSep11, "America/Chicago"), "2026-09-10");
    assert.equal(localDateForInstant(utcSep11, "America/New_York"), "2026-09-11");
    assert.equal(localDateForInstant(utcSep11, "UTC"), "2026-09-11");

    const utcMidnight = new Date("2026-09-11T00:00:00.000Z");
    assert.equal(localDateForInstant(utcMidnight, "America/Los_Angeles"), "2026-09-10");
    assert.equal(localDateForInstant(utcMidnight, "America/New_York"), "2026-09-10");
    assert.equal(localDateForInstant(utcMidnight, "Pacific/Auckland"), "2026-09-11");
  });

  it("DST spring-forward in America/Chicago does not skip the civil date", () => {
    // 2026-03-08 02:00 Chicago springs forward.
    const before = new Date("2026-03-08T07:30:00.000Z"); // 01:30 CST
    const after = new Date("2026-03-08T08:30:00.000Z"); // 03:30 CDT
    assert.equal(localDateForInstant(before, "America/Chicago"), "2026-03-08");
    assert.equal(localDateForInstant(after, "America/Chicago"), "2026-03-08");
    const bounds = localDayUtcBounds("2026-03-08", "America/Chicago");
    assert.ok(bounds);
    assert.equal(localDateForInstant(bounds.start, "America/Chicago"), "2026-03-08");
    assert.equal(localDateForInstant(new Date(bounds.end.getTime() - 1), "America/Chicago"), "2026-03-08");
    assert.equal(localDateForInstant(bounds.end, "America/Chicago"), "2026-03-09");
  });

  it("DST fall-back in America/New_York keeps a single civil date", () => {
    const bounds = localDayUtcBounds("2026-11-01", "America/New_York");
    assert.ok(bounds);
    const hours = (bounds.end.getTime() - bounds.start.getTime()) / 3600000;
    assert.equal(hours, 25);
    assert.equal(localDateForInstant(bounds.start, "America/New_York"), "2026-11-01");
    assert.equal(localDateForInstant(new Date(bounds.end.getTime() - 1), "America/New_York"), "2026-11-01");
  });

  it("default fallback zone is America/Chicago and invalid zones fall back", () => {
    assert.equal(DEFAULT_ACCOUNT_TIMEZONE, "America/Chicago");
    assert.equal(localDateForInstant("2026-09-11T04:30:00.000Z", "Not/AZone"), "2026-09-10");
  });
});

describe("Study Hall 365 — paid window vs local date", () => {
  it("start-day entitlement is available today (no next-day delay)", () => {
    const start = new Date("2026-09-17T16:00:00.000Z");
    const end = new Date("2026-10-17T16:00:00.000Z");
    const today = localDateForInstant(start, "America/Chicago");
    assert.equal(today, "2026-09-17");
    assert.equal(localDateOverlapsPaidPeriod(today, "America/Chicago", start, end), true);
    const evaled = evaluateStudyHall365Day({
      status: "active",
      periodStart: start,
      periodEnd: end,
      timeZone: "America/Chicago",
      localDate: today,
      now: start,
    });
    assert.equal(evaled.entitled, true);
    assert.equal(evaled.source, "study_hall_365");
  });

  it("follows the rolling Sep 17 → Oct 17 period, not calendar-month buckets", () => {
    const start = new Date("2026-09-17T16:00:00.000Z");
    const end = new Date("2026-10-17T16:00:00.000Z");
    const dates = localDatesOverlappingPeriod(start, end, "America/Chicago");
    assert.ok(dates.includes("2026-09-17"));
    assert.ok(dates.includes("2026-10-16"));
    assert.ok(dates.includes("2026-10-17"));
    assert.ok(!dates.includes("2026-09-01"));
    assert.ok(!dates.includes("2026-10-18"));
    assert.ok(!dates.includes("2026-10-31"));
    // Civil-day overlap of a mid-month Stripe period is not a 30-credit bucket.
    assert.ok(dates[0] === "2026-09-17" && dates[dates.length - 1] === "2026-10-17");
  });

  it("does not grant an extra local day merely because period_end is UTC after local midnight", () => {
    // Period ends 2026-10-17 16:00 UTC = 11:00 America/Chicago. Oct 17 is covered
    // until 11:00, but Oct 18 is not.
    const start = new Date("2026-09-17T16:00:00.000Z");
    const end = new Date("2026-10-17T16:00:00.000Z");
    assert.equal(localDateOverlapsPaidPeriod("2026-10-17", "America/Chicago", start, end), true);
    assert.equal(localDateOverlapsPaidPeriod("2026-10-18", "America/Chicago", start, end), false);
    assert.equal(
      instantInPaidWindow("2026-10-17T16:00:00.000Z", start, end),
      false,
    );
    assert.equal(
      instantInPaidWindow("2026-10-17T15:59:59.000Z", start, end),
      true,
    );
  });

  it("next local day is a new entitlement; unused previous day does not roll over", () => {
    const start = new Date("2026-09-17T16:00:00.000Z");
    const end = new Date("2026-10-17T16:00:00.000Z");
    const day1 = evaluateStudyHall365Day({
      status: "active",
      periodStart: start,
      periodEnd: end,
      timeZone: "America/Chicago",
      localDate: "2026-09-17",
      consumed: true,
    });
    const day2 = evaluateStudyHall365Day({
      status: "active",
      periodStart: start,
      periodEnd: end,
      timeZone: "America/Chicago",
      localDate: "2026-09-18",
      consumed: false,
    });
    assert.equal(day1.entitled, false);
    assert.equal(day1.reason, "already_consumed");
    assert.equal(day2.entitled, true);
    assert.equal(day2.reason, "available");
  });

  it("civil date overlap is not enough when booking start is outside the paid window", () => {
    const start = new Date("2026-09-17T16:00:00.000Z");
    const end = new Date("2026-10-17T16:00:00.000Z");
    const morning = evaluateStudyHall365Day({
      status: "active",
      periodStart: start,
      periodEnd: end,
      timeZone: "America/Chicago",
      localDate: "2026-09-17",
      now: "2026-09-17T18:00:00.000Z",
      bookingStart: "2026-09-17T10:00:00.000Z",
    });
    assert.equal(morning.entitled, false);
    assert.equal(morning.reason, "booking_outside_paid_window");

    const afternoon = evaluateStudyHall365Day({
      status: "active",
      periodStart: start,
      periodEnd: end,
      timeZone: "America/Chicago",
      localDate: "2026-09-17",
      now: "2026-09-17T18:00:00.000Z",
      bookingStart: "2026-09-17T17:00:00.000Z",
    });
    assert.equal(afternoon.entitled, true);
    assert.equal(afternoon.reason, "available");
  });

  it("canceled-day consumption remains consumed", () => {
    const result = evaluateStudyHall365Day({
      status: "active",
      periodStart: "2026-09-17T16:00:00.000Z",
      periodEnd: "2026-10-17T16:00:00.000Z",
      timeZone: "America/Chicago",
      localDate: "2026-09-17",
      consumed: true,
    });
    assert.equal(result.entitled, false);
    assert.equal(result.consumed, true);
    assert.equal(result.reason, "already_consumed");
  });
});

describe("Study Hall 365 — month length is the calendar, not 31 credits", () => {
  it("February 2026 (28 days), leap February 2028, 30-day and 31-day months", () => {
    const feb26 = localDatesOverlappingPeriod(
      utcInstantForLocalParts(2026, 2, 1, 0, 0, 0, "America/Chicago"),
      utcInstantForLocalParts(2026, 3, 1, 0, 0, 0, "America/Chicago"),
      "America/Chicago",
    );
    assert.equal(feb26.length, 28);

    const feb28 = localDatesOverlappingPeriod(
      utcInstantForLocalParts(2028, 2, 1, 0, 0, 0, "America/Chicago"),
      utcInstantForLocalParts(2028, 3, 1, 0, 0, 0, "America/Chicago"),
      "America/Chicago",
    );
    assert.equal(feb28.length, 29);

    const apr = localDatesOverlappingPeriod(
      utcInstantForLocalParts(2026, 4, 1, 0, 0, 0, "UTC"),
      utcInstantForLocalParts(2026, 5, 1, 0, 0, 0, "UTC"),
      "UTC",
    );
    assert.equal(apr.length, 30);

    const jan = localDatesOverlappingPeriod(
      utcInstantForLocalParts(2026, 1, 1, 0, 0, 0, "UTC"),
      utcInstantForLocalParts(2026, 2, 1, 0, 0, 0, "UTC"),
      "UTC",
    );
    assert.equal(jan.length, 31);
  });
});

describe("Study Hall 365 — household / siblings / funding choice", () => {
  it("consumption is account-scoped: 1, 2, or 3 children still one day", () => {
    const sql = read("supabase/migrations/0036_study_hall_365.sql");
    assert.match(sql, /unique \(account_id, local_date\)/);
    assert.doesNotMatch(sql, /unique \(student_id/);
    assert.match(sql, /consume_study_hall_365_day/);
    // One consume call per booking — child count is not a parameter.
    assert.doesNotMatch(sql, /p_student_id|p_child_count|p_student_ids/);
  });

  it("prefers unused free first, then 365, then prepaid, then credit, then PAYG", () => {
    assert.equal(
      chooseBookingSource({
        studyHall365: { entitled: true, reason: "available" },
        prepaidMinutes: 600,
        freeTrialEligible: true,
      }).source,
      "free_trial",
    );
    assert.equal(
      chooseBookingSource({
        studyHall365: { entitled: true, reason: "available" },
        prepaidMinutes: 600,
        freeTrialEligible: false,
      }).source,
      "study_hall_365",
    );
    assert.equal(
      chooseBookingSource({
        studyHall365: { entitled: false, reason: "already_consumed" },
        freeTrialEligible: true,
      }).source,
      "free_trial",
    );
    assert.equal(
      chooseBookingSource({
        studyHall365: { entitled: false },
        prepaidMinutes: 600,
      }).source,
      "prepaid",
    );
    assert.equal(
      chooseBookingSource({
        prepaidMinutes: 0,
        creditCents: 1200,
      }).source,
      "credit",
    );
    assert.equal(
      chooseBookingSource({
        prepaidMinutes: 30,
        creditCents: 1200,
      }).source,
      "credit",
    );
    assert.equal(chooseBookingSource({ prepaidMinutes: 0 }).source, "payg");
  });
});

describe("Study Hall 365 — Stripe period extraction and catalog", () => {
  it("reads period from subscription items (Stripe API used by stripe ^22)", () => {
    const period = subscriptionPaidPeriod({
      items: {
        data: [
          {
            current_period_start: 1758124800,
            current_period_end: 1760716800,
            price: { id: "price_test" },
          },
        ],
      },
    });
    assert.ok(period);
    assert.equal(period.priceId, "price_test");
    assert.equal(period.start.toISOString(), "2025-09-17T16:00:00.000Z");
  });

  it("finds the subscription id on an invoice without inventing fields", () => {
    assert.equal(invoiceSubscriptionId({ subscription: "sub_123" }), "sub_123");
    assert.equal(
      invoiceSubscriptionId({ parent: { subscription_details: { subscription: "sub_nested" } } }),
      "sub_nested",
    );
  });

  it("10-pack is 600 minutes / $100 and 365 is $14900 / month", () => {
    assert.equal(PACKAGE_CODE_10_STUDY_HALLS, "pkg_10sh");
    assert.equal(PACKAGE_10SH_MINUTES, 600);
    assert.equal(PACKAGE_10SH_PRICE_CENTS, 10000);
    assert.equal(STUDY_HALL_365_MONTHLY_CENTS, 14900);
    assert.equal(STUDY_HALL_365_KIND, "study_hall_365");
  });
});

describe("Study Hall 365 — architecture / safety static checks", () => {
  const migration = read("supabase/migrations/0036_study_hall_365.sql");
  const webhook =
    read("src/app/api/stripe/webhook/route.ts") + "\n" + read("src/lib/stripe/webhook-dispatch.mjs");
  const checkout = read("src/lib/checkout-service.ts");
  const bookingRoute = read("src/app/api/checkout/booking/route.ts");

  it("does not hardcode live Stripe price ids", () => {
    const src = [
      checkout,
      read("src/lib/stripe/config.ts"),
      read("src/app/api/checkout/study-hall-365/route.ts"),
      migration,
    ].join("\n");
    assert.doesNotMatch(src, /price_[A-Za-z0-9]{10,}/);
    assert.match(read("src/lib/stripe/config.ts"), /STRIPE_PRICE_STUDY_HALL_365/);
  });

  it("does not credit from the success URL and keeps webhook authority", () => {
    assert.match(checkout, /NEVER infers success/);
    assert.match(checkout, /redirect query params/);
    assert.match(webhook, /begin_stripe_event/);
    assert.match(webhook, /customer\.subscription\.updated/);
    assert.match(webhook, /invoice\.paid/);
    assert.match(webhook, /skipped_stale|last_stripe_event_created|eventCreated/);
    assert.doesNotMatch(read("src/lib/stripe/webhook-dispatch.mjs"), /fulfill_package_payment/);
  });

  it("365 checkout is subscription mode and reuses the Stripe customer", () => {
    assert.match(checkout, /mode:\s*"subscription"/);
    assert.match(checkout, /ensureStripeCustomer/);
    assert.match(checkout, /start_study_hall_365_checkout/);
    assert.match(migration, /already has a Study Hall 365 membership/);
  });

  it("free first Study Hall still creates Stripe only when cents are due", () => {
    assert.match(checkout, /if \(q\.stripe_cents_due <= 0\)/);
    assert.match(bookingRoute, /isFreeTrial/);
    assert.doesNotMatch(checkout, /trial_period_days/);
    assert.doesNotMatch(migration, /trial_period/);
  });

  it("consume RPC is service-role only; parents cannot write usage", () => {
    const privacy = read("supabase/migrations/0037_study_hall_365_parent_privacy.sql");
    assert.match(migration, /grant execute on function public.consume_study_hall_365_day[\s\S]*to service_role/);
    assert.match(migration, /revoke all on function public.consume_study_hall_365_day/);
    assert.match(privacy, /grant execute on function public.consume_study_hall_365_day[\s\S]*to service_role/);
    assert.match(privacy, /p_booking_start timestamptz/);
    assert.doesNotMatch(privacy, /for insert to authenticated/);
  });

  it("does not deactivate historical packages or reuse pkg_10h", () => {
    assert.match(migration, /pkg_10sh/);
    assert.doesNotMatch(migration, /is_active = false/);
    assert.match(migration, /Do NOT reuse pkg_10h/);
    assert.match(read("src/app/dashboard/student/packages/page.tsx"), /customerFacingPrepaidPackages/);
  });

  it("does not mint monthly credit rows or touch Daily / Dumbo", () => {
    assert.doesNotMatch(migration, /generate_daily_credit|month_end|bank unused/i);
    assert.doesNotMatch(migration, /daily\.co|session_recordings|call_parent/i);
    assert.doesNotMatch(read("src/lib/study-hall-365/service.ts"), /daily|recording/i);
  });

  it("labels subscription purchases for parents", () => {
    assert.equal(parentPaymentPurposeLabel("subscription"), "Study Hall 365");
    assert.equal(parentPaymentPurposeLabel("package"), "Prepaid hours");
  });

  it("Hours UI hides 14h/28h once pkg_10sh is in the catalog", () => {
    const mixed = [
      { code: "pkg_14h", name: "14 Hour Routine" },
      { code: "pkg_28h", name: "28 Hour Routine" },
      { code: "pkg_10sh", name: "10 Study Halls" },
    ];
    const shown = customerFacingPrepaidPackages(mixed);
    assert.deepEqual(shown.map((p) => p.code), ["pkg_10sh"]);
    const fallback = customerFacingPrepaidPackages([
      { code: "pkg_14h" },
      { code: "pkg_28h" },
    ]);
    assert.deepEqual(fallback.map((p) => p.code), []);
  });

  it("parent-facing membership path never selects raw Stripe identifiers", () => {
    const privacy = read("supabase/migrations/0037_study_hall_365_parent_privacy.sql");
    const hours = read("src/app/dashboard/student/packages/page.tsx");
    const membership = read("src/app/api/billing/membership/route.ts");
    const service = read("src/lib/study-hall-365/service.ts");
    assert.match(privacy, /drop policy if exists study_hall_365_sub_select_own/);
    assert.match(privacy, /get_study_hall_365_membership/);
    assert.match(privacy, /customer_status/);
    assert.doesNotMatch(hours, /from\("study_hall_365_subscriptions"\)/);
    assert.match(hours, /get_study_hall_365_membership/);
    assert.match(membership, /get_study_hall_365_membership/);
    assert.match(membership, /publicMembership/);
    assert.match(membership, /never returned/);
    assert.doesNotMatch(membership, /stripe_subscription_id:\s|stripe_customer_id:\s|stripe_price_id:\s/);
    assert.match(service, /loadOwnMembership/);
    assert.match(service, /p_booking_start/);
    const returnBlock = privacy.slice(privacy.indexOf("return jsonb_build_object"));
    assert.doesNotMatch(returnBlock, /stripe_subscription_id|stripe_customer_id|stripe_price_id|last_stripe_event/);
  });

  it("Customer Portal resolves Stripe customer on the server and returns only a URL", () => {
    const portal = read("src/app/api/billing/portal/route.ts");
    const card = read("src/components/booking/study-hall-365-card.tsx");
    assert.match(portal, /getServiceSupabase/);
    assert.match(portal, /from\("profiles"\)/);
    assert.match(portal, /select\("stripe_customer_id"\)/);
    assert.match(portal, /NextResponse\.json\(\{ url: session\.url \}\)/);
    assert.doesNotMatch(portal, /stripe_customer_id:\s*profile/);
    assert.match(card, /payload\?\.url/);
    assert.doesNotMatch(card, /stripe_customer_id|cus_/);
  });

  it("production requires a configured Stripe Price; local may use price_data", () => {
    assert.match(checkout, /VERCEL_ENV === "production"/);
    assert.match(checkout, /STRIPE_PRICE_STUDY_HALL_365 is required in production/);
    assert.match(checkout, /price_data:/);
    assert.match(checkout, /recurring:\s*\{\s*interval:\s*"month"/);
    assert.doesNotMatch(checkout, /price_[A-Za-z0-9]{10,}/);
    assert.match(read(".env.example"), /Required when VERCEL_ENV=production/);
    assert.match(read(".env.example"), /\$149\.00 USD/);
  });
});
