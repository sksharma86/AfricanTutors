import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { notifyBookingConfirmed, notifyPackagePurchased } from "@/lib/notify";
import { STRIPE_WEBHOOK_SECRET, isStripeWebhookConfigured } from "@/lib/stripe/config";
import { processVerifiedStripeEvent } from "@/lib/stripe/webhook-dispatch.mjs";
import { verifyStripeWebhookEvent } from "@/lib/stripe/webhook-verify.mjs";
import { getServiceSupabase } from "@/lib/supabase/service";
import {
  fulfillStudyHall365Checkout,
  isStudyHall365Session,
  syncFromInvoice,
  syncSubscriptionById,
} from "@/lib/study-hall-365/stripe-sync";
import { STUDY_HALL_365_KIND } from "@/lib/study-hall-365/catalog.mjs";

// Stripe signature verification needs the raw body + Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook endpoint.
 *
 * Authoritative for Stripe payment state. Success redirects are never trusted;
 * only verified webhook events are. Signature is verified before any processing.
 *
 * Event lifecycle (see 0006 migration): `begin_stripe_event` atomically claims
 * an event for processing and returns:
 *   - "claimed"     → this delivery owns fulfillment (a new event, or a retry of
 *                     a previously *failed* event). Run fulfillment, then mark
 *                     `complete_stripe_event` on success or `fail_stripe_event`
 *                     on error (returning 500 so Stripe retries).
 *   - "duplicate"   → already completed → safe 200 no-op.
 *   - "in_progress" → another delivery is currently processing this same event →
 *                     return 409 so Stripe retries later (prevents two
 *                     simultaneous deliveries fulfilling the same event twice).
 *
 * An event is only "completed" AFTER fulfillment succeeds, so a failure never
 * permanently suppresses retries.
 */
export async function POST(request: NextRequest) {
  if (!isStripeWebhookConfigured) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = verifyStripeWebhookEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const result = await processVerifiedStripeEvent(event, {
    beginStripeEvent: async (id, type) => {
      const { data: claim, error } = await supabase.rpc("begin_stripe_event", { p_id: id, p_type: type });
      if (error) throw new Error(error.message);
      return claim as string;
    },
    completeStripeEvent: async (id) => {
      await supabase.rpc("complete_stripe_event", { p_id: id });
    },
    failStripeEvent: async (id, error) => {
      await supabase.rpc("fail_stripe_event", { p_id: id, p_error: error ?? "fulfillment_error" });
    },
    fulfillFromMetadata: (metadata, amount, paymentIntent) =>
      fulfillFromMetadata(supabase, metadata as Meta, amount, paymentIntent as string | Stripe.PaymentIntent | null | undefined),
    fulfillStudyHall365Checkout: (session, ev) => fulfillStudyHall365Checkout(supabase, session, ev),
    isStudyHall365Session,
    syncSubscriptionById: (params) => syncSubscriptionById(supabase, params),
    syncFromInvoice: (invoice, ev) => syncFromInvoice(supabase, invoice, ev),
    cancelFromMetadata: (metadata, reason) => cancelFromMetadata(supabase, metadata as Meta, reason),
  });

  return NextResponse.json(result.body, { status: result.status });
}

type Meta = Stripe.Metadata | null | undefined;

/**
 * Route a verified, paid Stripe object to the authoritative fulfillment function
 * for its business object. Fulfillment is idempotent at the payment-object and
 * ledger level, so re-delivery (or overlapping session/payment_intent events for
 * the same payment) can never double-issue minutes or double-confirm a booking.
 * Replacement cancellation (Change) is finalized inside fulfill_booking_payment
 * from bookings.replaces_booking_id — not from Stripe metadata alone.
 */
async function fulfillFromMetadata(
  supabase: ReturnType<typeof getServiceSupabase>,
  metadata: Meta,
  amountTotal: number | null | undefined,
  paymentIntent: string | Stripe.PaymentIntent | null | undefined,
): Promise<void> {
  const kind = metadata?.kind;
  const paymentId = metadata?.payment_id;
  if (kind === STUDY_HALL_365_KIND) return; // handled by the subscription path
  if (!paymentId || (kind !== "booking" && kind !== "package")) return; // not ours; safe no-op

  const chargeId = typeof paymentIntent === "string" ? paymentIntent : (paymentIntent?.id ?? null);
  const fn = kind === "booking" ? "fulfill_booking_payment" : "fulfill_package_payment";

  const { data, error } = await supabase.rpc(fn, {
    p_payment_id: paymentId,
    p_amount_cents: typeof amountTotal === "number" ? amountTotal : null,
    p_charge_id: chargeId,
  });
  if (error) throw new Error(error.message);

  await notifyFulfillment(supabase, kind, paymentId, data as Record<string, unknown> | null);
}

/**
 * Idempotently cancel a pending reservation when Stripe reports the session
 * expired or the payment failed. Restores reserved credit and releases the slot;
 * a no-op once the payment is terminal (so a later success is unaffected).
 */
async function cancelFromMetadata(
  supabase: ReturnType<typeof getServiceSupabase>,
  metadata: Meta,
  reason: string,
): Promise<void> {
  const kind = metadata?.kind;
  const paymentId = metadata?.payment_id;
  if (!paymentId || (kind !== "booking" && kind !== "package" && kind !== STUDY_HALL_365_KIND)) return;
  const { error } = await supabase.rpc("cancel_pending_payment", { p_payment_id: paymentId, p_reason: reason });
  if (error) throw new Error(error.message);
}

/**
 * Best-effort customer email after fulfillment (never blocks the webhook). Uses
 * the idempotent notification service so duplicate Stripe deliveries — and the
 * checkout-service path for internally-funded purchases — never double-send.
 */
async function notifyFulfillment(
  supabase: ReturnType<typeof getServiceSupabase>,
  kind: "booking" | "package",
  paymentId: string,
  result: Record<string, unknown> | null,
): Promise<void> {
  try {
    if (kind === "package") {
      await notifyPackagePurchased(paymentId);
    } else if (result?.status === "confirmed") {
      const { data: pay } = await supabase.from("payments").select("booking_id").eq("id", paymentId).maybeSingle();
      if (pay?.booking_id) await notifyBookingConfirmed(pay.booking_id as string);
    }
  } catch {
    // Emails are best-effort; ignore.
  }
}
