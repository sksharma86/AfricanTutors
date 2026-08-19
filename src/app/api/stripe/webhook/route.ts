import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { sendBookingConfirmed, sendPackagePurchased } from "@/lib/email";
import { getStripe } from "@/lib/stripe/client";
import { STRIPE_WEBHOOK_SECRET, isStripeWebhookConfigured } from "@/lib/stripe/config";
import { getServiceSupabase } from "@/lib/supabase/service";

// Stripe signature verification needs the raw body + Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook endpoint (foundation).
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
 * permanently suppresses retries. Phase 4B implements the fulfillment handlers
 * (issue package minutes, confirm booking, issue credit, record refunds — via
 * the atomic SECURITY DEFINER ledger functions).
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
    event = getStripe().webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET as string);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { data: claim, error: claimError } = await supabase.rpc("begin_stripe_event", {
    p_id: event.id,
    p_type: event.type,
  });
  if (claimError) {
    return NextResponse.json({ error: "Event processing failed." }, { status: 500 });
  }
  if (claim === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (claim === "in_progress") {
    // Another delivery is fulfilling this event; ask Stripe to retry later.
    return NextResponse.json({ received: false, inProgress: true }, { status: 409 });
  }

  // claim === "claimed": we own fulfillment.
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Only fulfill fully-paid sessions (async/pending payments fulfill later
        // via payment_intent.succeeded or checkout.session.async_payment_succeeded).
        if (session.payment_status === "paid") {
          await fulfillFromMetadata(supabase, session.metadata, session.amount_total, session.payment_intent);
        }
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await fulfillFromMetadata(supabase, session.metadata, session.amount_total, session.payment_intent);
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await fulfillFromMetadata(supabase, pi.metadata, pi.amount_received ?? pi.amount, pi.id);
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await cancelFromMetadata(supabase, session.metadata, "Stripe checkout expired/failed");
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await cancelFromMetadata(supabase, pi.metadata, "Stripe payment failed");
        break;
      }
      // Internal 15-minute expiry is authoritative and additionally swept by
      // release_expired_checkouts (booking holds + package reservations).
      default:
        break;
    }
  } catch {
    // Mark failed so Stripe's retry can reclaim and fulfill; do not leak internals.
    await supabase.rpc("fail_stripe_event", { p_id: event.id, p_error: "fulfillment_error" });
    return NextResponse.json({ error: "Fulfillment failed." }, { status: 500 });
  }

  await supabase.rpc("complete_stripe_event", { p_id: event.id });
  return NextResponse.json({ received: true });
}

type Meta = Stripe.Metadata | null | undefined;

/**
 * Route a verified, paid Stripe object to the authoritative fulfillment function
 * for its business object. Fulfillment is idempotent at the payment-object and
 * ledger level, so re-delivery (or overlapping session/payment_intent events for
 * the same payment) can never double-issue minutes or double-confirm a booking.
 */
async function fulfillFromMetadata(
  supabase: ReturnType<typeof getServiceSupabase>,
  metadata: Meta,
  amountTotal: number | null | undefined,
  paymentIntent: string | Stripe.PaymentIntent | null | undefined,
): Promise<void> {
  const kind = metadata?.kind;
  const paymentId = metadata?.payment_id;
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
  if (!paymentId || (kind !== "booking" && kind !== "package")) return;
  const { error } = await supabase.rpc("cancel_pending_payment", { p_payment_id: paymentId, p_reason: reason });
  if (error) throw new Error(error.message);
}

/** Best-effort customer email after fulfillment (never blocks the webhook). */
async function notifyFulfillment(
  supabase: ReturnType<typeof getServiceSupabase>,
  kind: "booking" | "package",
  paymentId: string,
  result: Record<string, unknown> | null,
): Promise<void> {
  try {
    const { data: pay } = await supabase
      .from("payments")
      .select("account_id, gross_cents, stripe_paid_cents, package_product_id, booking_id")
      .eq("id", paymentId)
      .maybeSingle();
    if (!pay) return;
    const { data: userRes } = await supabase.auth.admin.getUserById(pay.account_id as string);
    const to = userRes?.user?.email ?? "";
    if (!to) return;

    if (kind === "package") {
      const { data: prod } = await supabase
        .from("package_products")
        .select("minutes")
        .eq("id", pay.package_product_id)
        .maybeSingle();
      await sendPackagePurchased({ to, minutes: (prod?.minutes as number) ?? 0, amountCents: pay.gross_cents });
    } else if (result?.status === "confirmed" && pay.booking_id) {
      const { data: b } = await supabase
        .from("bookings")
        .select("public_reference, subject_name, scheduled_start, student_first_name")
        .eq("id", pay.booking_id)
        .maybeSingle();
      await sendBookingConfirmed({
        to,
        studentName: b?.student_first_name,
        subject: b?.subject_name,
        when: b?.scheduled_start,
        reference: b?.public_reference,
      });
    }
  } catch {
    // Emails are best-effort; ignore.
  }
}
