import "server-only";

import type Stripe from "stripe";

import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { assertHalfHourStart } from "@/lib/half-hour-grid.mjs";
import { missingStudentIdsRpc } from "@/lib/household-children.mjs";
import { notifyBookingConfirmed, notifyPackagePurchased } from "@/lib/notify";
import { formatCents } from "@/lib/pricing";
import { isStripeConfigured, STRIPE_PRICE_STUDY_HALL_365 } from "@/lib/stripe/config";
import { stripeCheckoutExpiresAt } from "@/lib/stripe/checkout-expiry.mjs";
import { getStripe } from "@/lib/stripe/client";
import { ensureStripeCustomer } from "@/lib/stripe/customer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import {
  STUDY_HALL_365_KIND,
  STUDY_HALL_365_MONTHLY_CENTS,
  STUDY_HALL_365_PRODUCT_NAME,
} from "@/lib/study-hall-365/catalog.mjs";

/** Pending Guide applicants keep role=student but must not book or buy hours. */
async function assertNotGuideApplicant(userId: string): Promise<void> {
  const applicant = await getGuideApplicantInfo(userId);
  if (applicant) {
    throw new Error(
      "Your Guide application is under review. Parent booking and packages are not available on this account.",
    );
  }
}

/**
 * Server-side checkout orchestration (Phase 4B).
 *
 * Flow of authority:
 *  - `book_session` / `purchase_package` (SECURITY DEFINER, run with the user's
 *    session) are the ONLY places that price a transaction, decide funding, and
 *    move internal value. The client never supplies an amount.
 *  - When those functions report a Stripe amount is still due, THIS layer (server
 *    only) creates a Stripe Checkout Session for exactly that amount and records
 *    the Stripe identifiers on the authoritative payment row via the service role.
 *  - Verified webhooks — not this redirect — are what ultimately confirm value.
 *
 * Stripe Checkout Sessions (hosted) are used rather than raw PaymentIntents:
 * they need no card UI, keep this app out of PCI scope, and give a secure,
 * server-priced redirect that fits the Next.js App Router cleanly.
 */

interface StartResult {
  status: "confirmed" | "completed" | "requires_payment" | "request";
  checkoutUrl?: string;
  paymentId: string;
  bookingId?: string;
  funding: string;
  fundingSource?: string;
  sessionPriceCents?: number;
  packageMinutesUsed?: number;
  creditCentsUsed: number;
  stripeCentsDue: number;
}

async function authed() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("Not authenticated");
  return { supabase, user: data.user };
}

/**
 * Idempotently release a pending reservation (restore reserved credit, cancel the
 * payment, and release any booking slot) when Stripe Checkout creation fails or
 * Stripe is unavailable AFTER the DB reservation. Never leaves value stranded.
 */
async function rollbackReservation(
  service: ReturnType<typeof getServiceSupabase>,
  paymentId: string,
  reason: string,
): Promise<void> {
  await service.rpc("cancel_pending_payment", { p_payment_id: paymentId, p_reason: reason });
}

export async function createBookingCheckout(
  params: {
    studentId: string;
    studentIds?: string[];
    subjectId: string | null;
    otherSubject?: string | null;
    note?: string | null;
    duration: 60;
    startISO: string | null;
    isFreeTrial: boolean;
    /** Durable Change intent: cancel this booking only after the new one is confirmed. */
    replaceBookingId?: string | null;
  },
  baseUrl: string,
): Promise<StartResult> {
  const { supabase, user } = await authed();
  await assertNotGuideApplicant(user.id);

  // Study Hall (null subject) always schedules with p_start. Legacy unscheduled
  // "Other" requests only occur when both subject and start are null.
  // Price is duration-only; p_student_ids does not change hours or Stripe amount.
  const studentIds = params.studentIds ?? [params.studentId];
  const replaceBookingId =
    typeof params.replaceBookingId === "string" && params.replaceBookingId.trim()
      ? params.replaceBookingId.trim()
      : null;
  if (params.startISO) {
    const { data: kids } = await supabase.from("students").select("timezone").in("id", studentIds);
    assertHalfHourStart(
      params.startISO,
      (kids ?? []).map((k) => (k as { timezone?: string }).timezone),
    );
  }
  // Replacement id is an input to book_session so same-day 365 / free-trial
  // coverage can transfer before prepaid / credit / PAYG (and before Stripe).
  const sessionArgs = {
    p_student_id: params.studentId,
    p_subject_id: params.subjectId,
    p_other_subject: params.subjectId ? null : (params.otherSubject ?? null),
    p_request_note: params.note ?? null,
    p_duration: params.duration,
    p_start: params.startISO,
    p_is_free_trial: params.isFreeTrial,
    p_replaces_booking_id: replaceBookingId,
  };
  let { data, error } = await supabase.rpc("book_session", {
    ...sessionArgs,
    p_student_ids: studentIds,
  });
  if (error && missingStudentIdsRpc(error)) {
    if (studentIds.length > 1) {
      throw new Error("Up to 3 children can join the same Study Hall.");
    }
    ({ data, error } = await supabase.rpc("book_session", sessionArgs));
  }
  if (error) throw new Error(error.message);

  const q = data as {
    booking_id: string;
    payment_id: string;
    funding: string;
    funding_source?: string;
    session_price_cents: number;
    package_minutes_used: number;
    credit_cents_used: number;
    stripe_cents_due: number;
    booking_status: string;
  };

  if (replaceBookingId && q.booking_id) {
    const attached = await supabase.rpc("attach_booking_replacement", {
      p_new_booking: q.booking_id,
      p_old_booking: replaceBookingId,
    });
    if (attached.error) {
      if (q.stripe_cents_due > 0) {
        const service = getServiceSupabase();
        await rollbackReservation(
          service,
          q.payment_id,
          "Replacement intent could not be recorded; reservation released",
        );
        throw new Error("We couldn't start the time change. Your current session is unchanged.");
      }
    }
  }

  // Non-Stripe outcomes are already final in the DB transaction.
  // Await notify so Vercel keeps the invocation alive until Resend dispatch
  // finishes; never let email failure undo a committed booking.
  if (q.stripe_cents_due <= 0) {
    if (replaceBookingId && q.booking_id) {
      await supabase.rpc("finalize_booking_replacement", { p_new_booking: q.booking_id });
    }
    if (q.funding !== "request") {
      try {
        await notifyBookingConfirmed(q.booking_id);
      } catch {
        /* best-effort */
      }
    }
    return {
      status: q.funding === "request" ? "request" : "confirmed",
      paymentId: q.payment_id,
      bookingId: q.booking_id,
      funding: q.funding,
      fundingSource: q.funding_source ?? q.funding,
      sessionPriceCents: q.session_price_cents,
      packageMinutesUsed: q.package_minutes_used,
      creditCentsUsed: q.credit_cents_used,
      stripeCentsDue: 0,
    };
  }

  // Stripe amount is due → create a hosted Checkout Session for exactly that
  // amount. If anything fails after book_session reserved credit, roll it back so
  // no customer value is stranded. The Stripe session lifetime (>= 30 min) is
  // deliberately longer than the authoritative 15-min internal hold.
  const service = getServiceSupabase();
  try {
    if (!isStripeConfigured) throw new Error("STRIPE_NOT_CONFIGURED");
    const customerId = await ensureStripeCustomer(service, user.id, user.email);
    const stripe = getStripe();
    const metadata: Record<string, string> = {
      kind: "booking",
      payment_id: q.payment_id,
      account_id: user.id,
      booking_id: q.booking_id,
    };
    if (replaceBookingId) metadata.replaces_booking_id = replaceBookingId;

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer: customerId,
        client_reference_id: q.payment_id,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: q.stripe_cents_due,
              product_data: { name: "Study Hall (60 minutes)" },
            },
          },
        ],
        metadata,
        payment_intent_data: {
          metadata,
        },
        expires_at: stripeCheckoutExpiresAt(),
        success_url: `${baseUrl}/checkout/return?payment=${q.payment_id}`,
        cancel_url: `${baseUrl}/checkout/return?payment=${q.payment_id}&canceled=1`,
      },
      { idempotencyKey: `checkout-booking-${q.payment_id}` },
    );

    await service
      .from("payments")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_customer_id: customerId,
        idempotency_key: `checkout-booking-${q.payment_id}`,
        status: "requires_payment",
      })
      .eq("id", q.payment_id);

    return {
      status: "requires_payment",
      checkoutUrl: session.url ?? undefined,
      paymentId: q.payment_id,
      bookingId: q.booking_id,
      funding: q.funding,
      fundingSource: q.funding_source ?? q.funding,
      sessionPriceCents: q.session_price_cents,
      packageMinutesUsed: q.package_minutes_used,
      creditCentsUsed: q.credit_cents_used,
      stripeCentsDue: q.stripe_cents_due,
    };
  } catch (err) {
    await rollbackReservation(service, q.payment_id, "Stripe checkout could not be started; reservation released");
    if (err instanceof Error && err.message === "STRIPE_NOT_CONFIGURED") {
      throw new Error("Online payment is not available yet. Please try again later.");
    }
    throw new Error("We couldn't start secure checkout. Your account credit was not used — please try again.");
  }
}

export async function createPackageCheckout(packageId: string, baseUrl: string): Promise<StartResult> {
  const { supabase, user } = await authed();
  await assertNotGuideApplicant(user.id);

  const { data, error } = await supabase.rpc("purchase_package", { p_package_id: packageId });
  if (error) throw new Error(error.message);
  const q = data as {
    payment_id: string;
    package_product_id: string;
    minutes: number;
    gross_cents: number;
    credit_cents_used: number;
    stripe_cents_due: number;
    funding: string;
    status: string;
  };

  if (q.stripe_cents_due <= 0) {
    try {
      await notifyPackagePurchased(q.payment_id);
    } catch {
      /* best-effort; package already credited */
    }
    return {
      status: "completed",
      paymentId: q.payment_id,
      funding: q.funding,
      creditCentsUsed: q.credit_cents_used,
      stripeCentsDue: 0,
    };
  }

  const service = getServiceSupabase();
  try {
    if (!isStripeConfigured) throw new Error("STRIPE_NOT_CONFIGURED");
    const customerId = await ensureStripeCustomer(service, user.id, user.email);
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer: customerId,
        client_reference_id: q.payment_id,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: q.stripe_cents_due,
              product_data: {
                name:
                  q.minutes === 600
                    ? "10 Study Halls"
                    : `Prepaid hours (${q.minutes} minutes)`,
              },
            },
          },
        ],
        metadata: { kind: "package", payment_id: q.payment_id, account_id: user.id },
        payment_intent_data: { metadata: { kind: "package", payment_id: q.payment_id, account_id: user.id } },
        expires_at: stripeCheckoutExpiresAt(),
        success_url: `${baseUrl}/checkout/return?payment=${q.payment_id}`,
        cancel_url: `${baseUrl}/checkout/return?payment=${q.payment_id}&canceled=1`,
      },
      { idempotencyKey: `checkout-package-${q.payment_id}` },
    );

    await service
      .from("payments")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_customer_id: customerId,
        idempotency_key: `checkout-package-${q.payment_id}`,
        status: "requires_payment",
      })
      .eq("id", q.payment_id);

    return {
      status: "requires_payment",
      checkoutUrl: session.url ?? undefined,
      paymentId: q.payment_id,
      funding: q.funding,
      creditCentsUsed: q.credit_cents_used,
      stripeCentsDue: q.stripe_cents_due,
    };
  } catch (err) {
    await rollbackReservation(service, q.payment_id, "Stripe checkout could not be started; reservation released");
    if (err instanceof Error && err.message === "STRIPE_NOT_CONFIGURED") {
      throw new Error("Online payment is not available yet. Please try again later.");
    }
    throw new Error("We couldn't start secure checkout. Your account credit was not used — please try again.");
  }
}

export interface CheckoutStatus {
  paymentStatus: string;
  purpose: string;
  grossCents: number;
  creditAppliedCents: number;
  stripePaidCents: number;
  note: string | null;
  booking?: {
    id: string;
    reference: string | null;
    status: string;
    paymentStatus: string;
    subject: string | null;
    when: string | null;
  } | null;
  /** Coarse UI state derived from authoritative internal records (never the redirect). */
  uiState: "confirming" | "confirmed" | "completed" | "failed" | "expired" | "credited";
  message: string;
}

/**
 * Authoritative status for a checkout return page. Reads only records the caller
 * is allowed to see (RLS: payment.account_id = auth.uid()). NEVER infers success
 * from redirect query params — the answer comes from internal payment/booking state.
 */
export async function getCheckoutStatus(paymentId: string): Promise<CheckoutStatus | null> {
  const { supabase } = await authed();
  const { data: pay, error } = await supabase
    .from("payments")
    .select("purpose, status, gross_cents, credit_applied_cents, stripe_paid_cents, note, booking_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!pay) return null;

  let booking: CheckoutStatus["booking"] = null;
  if (pay.booking_id) {
    const { data: b } = await supabase
      .from("bookings")
      .select("id, public_reference, status, payment_status, subject_name, scheduled_start")
      .eq("id", pay.booking_id)
      .maybeSingle();
    if (b) {
      booking = {
        id: b.id,
        reference: b.public_reference,
        status: b.status,
        paymentStatus: b.payment_status,
        subject: b.subject_name,
        when: b.scheduled_start,
      };
    }
  }

  let uiState: CheckoutStatus["uiState"];
  let message: string;

  if (pay.note && pay.status === "succeeded" && booking && booking.status !== "confirmed" && booking.status !== "completed") {
    uiState = "credited";
    message = `Payment received. That slot was no longer available, so ${formatCents(pay.stripe_paid_cents)} has been added to your account balance for your next booking.`;
  } else if (pay.status === "succeeded") {
    if (pay.purpose === "package") {
      uiState = "completed";
      message = "Payment confirmed — your prepaid Study Halls are now available.";
    } else if (pay.purpose === "subscription") {
      uiState = "completed";
      message = "Payment confirmed — Study Hall 365 is active for this household.";
    } else {
      uiState = "confirmed";
      message = "Payment confirmed — your session is booked.";
    }
  } else if (pay.status === "canceled" || pay.status === "failed") {
    uiState = booking && booking.status === "expired" ? "expired" : "failed";
    message =
      uiState === "expired"
        ? "The payment window expired and the slot was released. Any credit you applied has been returned to your balance."
        : "This payment did not complete. No session was confirmed.";
  } else {
    uiState = "confirming";
    message = "We're confirming your payment. This page will update once your bank confirms — you don't need to pay again.";
  }

  return {
    paymentStatus: pay.status,
    purpose: pay.purpose,
    grossCents: pay.gross_cents,
    creditAppliedCents: pay.credit_applied_cents,
    stripePaidCents: pay.stripe_paid_cents,
    note: pay.note,
    booking,
    uiState,
    message,
  };
}

function studyHall365LineItem(): Stripe.Checkout.SessionCreateParams.LineItem {
  const production = process.env.VERCEL_ENV === "production";
  if (production && !STRIPE_PRICE_STUDY_HALL_365) {
    throw new Error("STRIPE_PRICE_STUDY_HALL_365 is required in production");
  }
  if (STRIPE_PRICE_STUDY_HALL_365) {
    return { quantity: 1, price: STRIPE_PRICE_STUDY_HALL_365 };
  }
  return {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: STUDY_HALL_365_MONTHLY_CENTS,
      recurring: { interval: "month" },
      product_data: { name: STUDY_HALL_365_PRODUCT_NAME },
    },
  };
}

export async function createStudyHall365Checkout(baseUrl: string): Promise<StartResult> {
  const { supabase, user } = await authed();
  await assertNotGuideApplicant(user.id);

  const { data, error } = await supabase.rpc("start_study_hall_365_checkout");
  if (error) throw new Error(error.message);
  const q = data as {
    payment_id: string;
    gross_cents: number;
    stripe_cents_due: number;
    status: string;
    deduped?: boolean;
  };

  const service = getServiceSupabase();
  try {
    if (!isStripeConfigured) throw new Error("STRIPE_NOT_CONFIGURED");
    const customerId = await ensureStripeCustomer(service, user.id, user.email);
    const stripe = getStripe();
    const meta = {
      kind: STUDY_HALL_365_KIND,
      payment_id: q.payment_id,
      account_id: user.id,
    };

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        client_reference_id: q.payment_id,
        line_items: [studyHall365LineItem()],
        metadata: meta,
        subscription_data: { metadata: meta },
        success_url: `${baseUrl}/checkout/return?payment=${q.payment_id}`,
        cancel_url: `${baseUrl}/checkout/return?payment=${q.payment_id}&canceled=1`,
      },
      { idempotencyKey: `checkout-365-${q.payment_id}` },
    );

    await service
      .from("payments")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_customer_id: customerId,
        idempotency_key: `checkout-365-${q.payment_id}`,
        status: "requires_payment",
      })
      .eq("id", q.payment_id);

    return {
      status: "requires_payment",
      checkoutUrl: session.url ?? undefined,
      paymentId: q.payment_id,
      funding: "stripe",
      creditCentsUsed: 0,
      stripeCentsDue: q.stripe_cents_due,
    };
  } catch (err) {
    await rollbackReservation(service, q.payment_id, "Stripe checkout could not be started; reservation released");
    if (err instanceof Error && err.message === "STRIPE_NOT_CONFIGURED") {
      throw new Error("Online payment is not available yet. Please try again later.");
    }
    if (err instanceof Error && /already has a Study Hall 365/i.test(err.message)) {
      throw err;
    }
    throw new Error("We couldn't start secure checkout. Please try again.");
  }
}
