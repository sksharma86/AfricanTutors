import { NextResponse, type NextRequest } from "next/server";

import { guideMessage, guideStatusFromDb } from "@/lib/call-parent-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Guide polls Call Parent outcome (async Twilio status). Never returns phone
 * numbers or Twilio SIDs.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: row, error } = await supabase
    .from("parent_escalation_requests")
    .select("id, status, tutor_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // RLS already scopes SELECT; double-check assigned Guide / admin via status mapping only.
  const guideStatus = guideStatusFromDb(row.status);
  return NextResponse.json({
    id: row.id,
    status: guideStatus,
    message: guideMessage(guideStatus),
    final: !["contacting", "pending"].includes(row.status),
  });
}
