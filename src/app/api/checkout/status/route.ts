import { NextResponse, type NextRequest } from "next/server";

import { getCheckoutStatus } from "@/lib/checkout-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authoritative checkout status for the return page. Reads internal
 * payment/booking state (RLS-scoped to the caller); it never trusts the Stripe
 * redirect as proof of payment.
 */
export async function GET(request: NextRequest) {
  const paymentId = request.nextUrl.searchParams.get("payment");
  if (!paymentId) {
    return NextResponse.json({ error: "Missing payment id." }, { status: 400 });
  }
  try {
    const status = await getCheckoutStatus(paymentId);
    if (!status) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lookup failed.";
    const code = /not authenticated/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: "Unable to load payment status." }, { status: code });
  }
}
