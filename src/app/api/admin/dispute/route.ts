import { NextResponse, type NextRequest } from "next/server";

import { adminApiContext } from "@/lib/admin-service";
import { notifyDisputeResolved } from "@/lib/notify";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESOLUTIONS = new Set(["denied", "courtesy", "upheld"]);

/**
 * Admin resolves a dispute. Financial outcomes are explicit (no hard-coded
 * "upheld" behavior). If a Stripe refund is requested, it is created server-side
 * first and the resulting refund id is passed into admin_resolve_dispute.
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
  if (!body || typeof body.disputeId !== "string" || !RESOLUTIONS.has(body.resolution)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const restoreMinutes = Number.isInteger(body.restoreMinutes) && body.restoreMinutes > 0 ? body.restoreMinutes : 0;
  const creditCents = Number.isInteger(body.creditCents) && body.creditCents > 0 ? body.creditCents : 0;
  const refundCents = Number.isInteger(body.refundCents) && body.refundCents > 0 ? body.refundCents : 0;
  const refundPaymentId = typeof body.refundPaymentId === "string" ? body.refundPaymentId : null;
  const earningAction = body.earningAction === "void" || body.earningAction === "adjust" ? body.earningAction : null;
  const earningNewCents = Number.isInteger(body.earningNewCents) ? body.earningNewCents : null;
  const notes = typeof body.notes === "string" ? body.notes : null;

  // If a Stripe refund is part of the resolution, create it first to get an id.
  let refundStripeId: string | null = null;
  if (refundCents > 0 && refundPaymentId) {
    // Authoritatively confirm the refund payment belongs to THIS dispute BEFORE
    // touching Stripe, so we never send cash for an unrelated payment and only
    // discover the mismatch afterward. The DB function re-enforces this too.
    const { data: dispute } = await supabase
      .from("disputes")
      .select("account_id, booking_id")
      .eq("id", body.disputeId)
      .maybeSingle();
    if (!dispute) return NextResponse.json({ error: "Dispute not found." }, { status: 404 });

    const { data: pay } = await supabase
      .from("payments")
      .select("id, account_id, booking_id, purpose, stripe_paid_cents, refunded_cents, stripe_charge_id, stripe_payment_intent_id")
      .eq("id", refundPaymentId)
      .maybeSingle();
    if (!pay) return NextResponse.json({ error: "Refund payment not found." }, { status: 404 });
    if (pay.purpose !== "booking" || pay.account_id !== dispute.account_id || pay.booking_id !== dispute.booking_id) {
      return NextResponse.json({ error: "That payment does not belong to this dispute." }, { status: 400 });
    }
    if (refundCents > pay.stripe_paid_cents - pay.refunded_cents) {
      return NextResponse.json({ error: "Refund exceeds refundable Stripe amount." }, { status: 400 });
    }
    const pi = pay.stripe_payment_intent_id || pay.stripe_charge_id;
    if (!isStripeConfigured || !pi) {
      return NextResponse.json({ error: "Stripe not configured for refunds; resolve without a Stripe refund." }, { status: 503 });
    }
    try {
      // Key on the payment's current refunded total (see /api/admin/refund) so a
      // retry after an uncertain outcome cannot double-refund cash.
      const refund = await getStripe().refunds.create(
        { payment_intent: pi, amount: refundCents, metadata: { dispute: body.disputeId, payment_id: pay.id } },
        { idempotencyKey: `refund-${pay.id}-${pay.refunded_cents}-${refundCents}` },
      );
      refundStripeId = refund.id;
    } catch {
      return NextResponse.json({ error: "Stripe refund failed; no changes made." }, { status: 502 });
    }
  }

  const { data, error } = await supabase.rpc("admin_resolve_dispute", {
    p_dispute: body.disputeId,
    p_resolution: body.resolution,
    p_notes: notes,
    p_restore_minutes: restoreMinutes,
    p_credit_cents: creditCents,
    p_refund_payment: refundStripeId ? refundPaymentId : null,
    p_refund_cents: refundStripeId ? refundCents : 0,
    p_refund_stripe_id: refundStripeId,
    p_earning_action: earningAction,
    p_earning_new_cents: earningNewCents,
  });
  if (error) return NextResponse.json({ error: error.message.replace(/^.*:\s*/, "") }, { status: 400 });

  // Notify the customer (best-effort, idempotent).
  const { data: d } = await supabase.from("disputes").select("account_id").eq("id", body.disputeId).maybeSingle();
  if (d?.account_id) {
    void notifyDisputeResolved(body.disputeId, d.account_id, {
      resolution: body.resolution,
      creditCents,
      restoredMinutes: restoreMinutes,
      refundCents: refundStripeId ? refundCents : 0,
    });
  }
  return NextResponse.json(data);
}
