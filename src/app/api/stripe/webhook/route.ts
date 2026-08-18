import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

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
      // Phase 4B fulfillment attaches here, e.g.:
      //   case "checkout.session.completed":
      //   case "payment_intent.succeeded":  -> confirm booking / issue package minutes
      //   case "charge.refunded":           -> record refund / restore value
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
