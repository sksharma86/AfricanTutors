import { NextResponse, type NextRequest } from "next/server";

import { adminApiContext } from "@/lib/admin-service";
import { mintAuthorizedRecordingAccess } from "@/lib/recording-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only secure recording playback. Verifies admin authorization, confirms
 * the recording exists, enforces retention/deletion, then mints a SHORT-LIVED
 * Daily access link. No permanent/public URL is ever stored or returned.
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await adminApiContext();
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return NextResponse.json({ error: m }, { status: /authenticated/i.test(m) ? 401 : 403 });
  }
  const { supabase, user } = ctx;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.recordingId !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await mintAuthorizedRecordingAccess({
    recordingId: body.recordingId,
    userId: user.id,
    asAdmin: true,
    userClient: supabase,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ url: result.url, expiresAt: result.expiresAt });
}
