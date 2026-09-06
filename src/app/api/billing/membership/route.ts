import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe/client";
import { isStripeConfigured } from "@/lib/stripe/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { syncSubscriptionById } from "@/lib/study-hall-365/stripe-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicMembership(payload: unknown) {
  if (!payload || typeof payload !== "object") return { membership: null };
  const wrapped = payload as { membership?: Record<string, unknown> | null };
  const mem = wrapped.membership ?? null;
  if (!mem) return { membership: null };
  return {
    membership: {
      customerStatus: mem.customer_status ?? null,
      entitled: Boolean(mem.entitled),
      cancelAtPeriodEnd: Boolean(mem.cancel_at_period_end),
      currentPeriodStart: mem.current_period_start ?? null,
      currentPeriodEnd: mem.current_period_end ?? null,
    },
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ membership: null });
  const { data, error } = await supabase.rpc("get_study_hall_365_membership", { p_account: user.id });
  if (error) return NextResponse.json({ error: "Unable to load membership." }, { status: 500 });
  return NextResponse.json(publicMembership(data));
}

/**
 * Schedule cancel at period end, or undo that schedule.
 * No prorated refund. Access continues through the already-paid period.
 * Stripe subscription id is resolved with the service role and never returned.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!isStripeConfigured) {
    return NextResponse.json({ error: "Billing is not available yet." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "cancel" && action !== "resume") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const service = getServiceSupabase();
  const { data: row } = await service
    .from("study_hall_365_subscriptions")
    .select("stripe_subscription_id, status, ended_at")
    .eq("account_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row?.stripe_subscription_id) {
    return NextResponse.json({ error: "No Study Hall 365 membership found." }, { status: 404 });
  }
  if (row.ended_at || row.status === "ended" || row.status === "incomplete_expired") {
    return NextResponse.json({ error: "This membership has already ended." }, { status: 409 });
  }

  const stripe = getStripe();
  const updated = await stripe.subscriptions.update(row.stripe_subscription_id as string, {
    cancel_at_period_end: action === "cancel",
    proration_behavior: "none",
  });

  await syncSubscriptionById(service, {
    subscriptionId: updated.id,
    accountId: user.id,
    eventId: `local-${action}-${updated.id}-${updated.created}`,
    eventCreated: Math.floor(Date.now() / 1000),
  });

  return NextResponse.json({
    ok: true,
    cancelAtPeriodEnd: updated.cancel_at_period_end,
    customerStatus: updated.cancel_at_period_end ? "cancels_at_period_end" : updated.status,
  });
}
