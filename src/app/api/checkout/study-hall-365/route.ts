import { NextResponse, type NextRequest } from "next/server";

import { createStudyHall365Checkout } from "@/lib/checkout-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE = /^[A-Za-z0-9 .,'!?()\-:$]+$/;
function safeError(message: string): string {
  return SAFE.test(message) && message.length < 160 ? message : "Something went wrong. Please try again.";
}

/**
 * Start Study Hall 365 subscription Checkout. Price is server-authoritative
 * ($149/month). Refuses a second open membership for the same household.
 */
export async function POST(request: NextRequest) {
  try {
    const result = await createStudyHall365Checkout(request.nextUrl.origin);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Purchase failed.";
    const status = /not authenticated/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: safeError(message) }, { status });
  }
}
