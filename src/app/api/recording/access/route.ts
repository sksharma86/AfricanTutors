import { NextResponse, type NextRequest } from "next/server";

import { mintAuthorizedRecordingAccess } from "@/lib/recording-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Parent/account recording playback. Verifies booking.account_id = auth.uid(),
 * recording playable (not expired/deleted), then mints a short-lived Daily link.
 * Uniform 404 for cross-account IDOR attempts (no metadata leak).
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.recordingId !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Reject attempts to pass a raw Daily recording id as if it were our row id —
  // ownership is always resolved from session_recordings.id → booking.account_id.
  const result = await mintAuthorizedRecordingAccess({
    recordingId: body.recordingId,
    userId: auth.user.id,
    asAdmin: false,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ url: result.url, expiresAt: result.expiresAt });
}
