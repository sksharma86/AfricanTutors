import { NextResponse, type NextRequest } from "next/server";

import { createPackageCheckout } from "@/lib/checkout-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE = /^[A-Za-z0-9 .,'!?()\-:$]+$/;
function safeError(message: string): string {
  return SAFE.test(message) && message.length < 160 ? message : "Something went wrong. Please try again.";
}

/**
 * Start checkout for a package purchase. Price and minute quantity come from
 * `package_products` via `purchase_package`; the client only names the package id.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.packageId !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const result = await createPackageCheckout(body.packageId, request.nextUrl.origin);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Purchase failed.";
    const status = /not authenticated/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: safeError(message) }, { status });
  }
}
