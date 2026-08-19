import { NextResponse, type NextRequest } from "next/server";

import { adminApiContext, lookupEmail } from "@/lib/admin-service";
import { sendRefundIssued } from "@/lib/email";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-initiated Stripe refund. Server-side only: the refundable amount and the
 * Stripe payment identifier come from the DB (never the client). The Stripe
 * refund is created first, then admin_record_refund reconciles internal state
 * (idempotent; caps at the refundable Stripe amount).
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await adminApiContext();
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return NextResponse.json({ error: m }, { status: /authenticated/i.test(m) ? 401 : 403 });
  }
  const { supabase } = ctx;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.paymentId !== "string" || !Number.isInteger(body.amountCents) || body.amountCents <= 0) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason : "admin refund";

  // Authoritative payment (RLS lets admins read any payment).
  const { data: pay } = await supabase
    .from("payments")
    .select("id, account_id, stripe_paid_cents, refunded_cents, stripe_charge_id, stripe_payment_intent_id")
    .eq("id", body.paymentId)
    .maybeSingle();
  if (!pay) return NextResponse.json({ error: "Payment not found." }, { status: 404 });

  const refundable = pay.stripe_paid_cents - pay.refunded_cents;
  if (body.amountCents > refundable) {
    return NextResponse.json({ error: `Refund exceeds refundable Stripe amount ($${(refundable / 100).toFixed(2)}).` }, { status: 400 });
  }
  const paymentIntent = pay.stripe_payment_intent_id || pay.stripe_charge_id;
  if (!isStripeConfigured || !paymentIntent) {
    return NextResponse.json(
      { error: "Stripe is not configured for live refunds in this environment." },
      { status: 503 },
    );
  }

  let refundId: string;
  try {
    // Idempotency key is derived from the payment's CURRENT refunded total + the
    // amount, NOT free text. If a prior attempt succeeded at Stripe but our DB
    // write failed, `refunded_cents` is unchanged, so a retry produces the SAME
    // key → Stripe returns the same refund (no double cash). Two legitimate
    // partial refunds of the same amount have different prior totals → distinct
    // keys, so both are allowed.
    const refund = await getStripe().refunds.create(
      { payment_intent: paymentIntent, amount: body.amountCents, metadata: { payment_id: pay.id, reason } },
      { idempotencyKey: `refund-${pay.id}-${pay.refunded_cents}-${body.amountCents}` },
    );
    refundId = refund.id;
  } catch {
    return NextResponse.json({ error: "Stripe refund failed. No internal changes were made." }, { status: 502 });
  }

  const { data, error } = await supabase.rpc("admin_record_refund", {
    p_payment_id: pay.id,
    p_amount_cents: body.amountCents,
    p_stripe_refund_id: refundId,
    p_reason: reason,
  });
  if (error) return NextResponse.json({ error: "Refund recorded at Stripe but internal update failed; please reconcile." }, { status: 500 });

  const email = await lookupEmail(pay.account_id);
  if (email) void sendRefundIssued({ to: email, amountCents: body.amountCents, reason });

  return NextResponse.json(data);
}
