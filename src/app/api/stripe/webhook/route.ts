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
 * Authoritative for Stripe payment state. Verifies the signature, then records
 * the event id for idempotency so duplicate deliveries are safe no-ops. The
 * actual fulfillment handlers (issue package minutes, confirm booking, issue
 * credit, record refunds — all via the atomic SECURITY DEFINER ledger
 * functions) are wired in Phase 4B. Success redirects are never trusted as
 * proof of payment; only verified webhook events are.
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
    // Do not leak verification internals.
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Idempotency: record the event id; if it already existed, this is a duplicate.
  const { data: isNew, error } = await supabase.rpc("mark_stripe_event_processed", {
    p_event_id: event.id,
    p_type: event.type,
  });
  if (error) {
    // 500 so Stripe retries; we have not yet fulfilled anything.
    return NextResponse.json({ error: "Event processing failed." }, { status: 500 });
  }
  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    // Phase 4B will handle fulfillment here, e.g.:
    //   case "checkout.session.completed":
    //   case "payment_intent.succeeded":  -> confirm booking / issue package minutes
    //   case "charge.refunded":           -> record refund / restore value
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
