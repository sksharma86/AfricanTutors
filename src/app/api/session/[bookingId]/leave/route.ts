import { NextResponse, type NextRequest } from "next/server";

import { recordLeave } from "@/lib/session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Best-effort presence: record that the authenticated participant left. */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await ctx.params;
  try {
    await recordLeave(bookingId);
  } catch {
    // Presence is best-effort; never surface an error to the client.
  }
  return NextResponse.json({ ok: true });
}
