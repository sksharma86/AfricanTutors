import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe/client";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe Customer Portal for card updates, cancel-at-period-end, and
 * undo-cancel when the Dashboard portal is configured for those actions.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!isStripeConfigured) {
    return NextResponse.json({ error: "Billing is not available yet." }, { status: 503 });
  }

  const service = getServiceSupabase();
  const { data: profile } = await service
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account is on file yet." }, { status: 404 });
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id as string,
      return_url: `${request.nextUrl.origin}/dashboard/student/packages`,
    });
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json(
      {
        error:
          "Stripe Customer Portal is not configured. In Stripe Dashboard → Settings → Customer portal, enable subscription cancel (at period end) and payment-method updates.",
        portalUnconfigured: true,
      },
      { status: 409 },
    );
  }
}
