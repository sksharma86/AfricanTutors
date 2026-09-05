import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe/client";
import { isStripeConfigured } from "@/lib/stripe/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { isSubscriptionEntitled } from "@/lib/study-hall-365/entitlement.mjs";
import { syncSubscriptionById } from "@/lib/study-hall-365/stripe-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadOwnSubscription(accountId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("study_hall_365_subscriptions")
    .select("id, status, current_period_start, current_period_end, cancel_at_period_end, ended_at, stripe_subscription_id")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const row = await loadOwnSubscription(user.id);
  if (!row) return NextResponse.json({ membership: null });
  return NextResponse.json({
    membership: {
      status: row.status,
      entitled: isSubscriptionEntitled(row.status, {
        cancelAtPeriodEnd: row.cancel_at_period_end,
        periodEnd: row.current_period_end,
        endedAt: row.ended_at,
      }),
      cancelAtPeriodEnd: row.cancel_at_period_end,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
    },
  });
}

/**
 * Schedule cancel at period end, or undo that schedule.
 * No prorated refund. Access continues through the already-paid period.
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

  const row = await loadOwnSubscription(user.id);
  if (!row?.stripe_subscription_id) {
    return NextResponse.json({ error: "No Study Hall 365 membership found." }, { status: 404 });
  }
  if (row.ended_at || row.status === "ended" || row.status === "incomplete_expired") {
    return NextResponse.json({ error: "This membership has already ended." }, { status: 409 });
  }

  const stripe = getStripe();
  const updated = await stripe.subscriptions.update(row.stripe_subscription_id, {
    cancel_at_period_end: action === "cancel",
    proration_behavior: "none",
  });

  const service = getServiceSupabase();
  await syncSubscriptionById(service, {
    subscriptionId: updated.id,
    accountId: user.id,
    eventId: `local-${action}-${updated.id}-${updated.created}`,
    eventCreated: Math.floor(Date.now() / 1000),
  });

  return NextResponse.json({
    ok: true,
    cancelAtPeriodEnd: updated.cancel_at_period_end,
    status: updated.status,
  });
}
