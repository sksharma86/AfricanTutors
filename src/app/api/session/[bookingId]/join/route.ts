import { NextResponse, type NextRequest } from "next/server";

import { SessionError, joinSession } from "@/lib/session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  not_found: 404,
  forbidden: 403,
  too_early: 403,
  too_late: 410,
  not_joinable: 409,
  not_scheduled: 409,
  video_unavailable: 503,
};

const MESSAGE: Record<string, string> = {
  not_found: "Session not found.",
  forbidden: "You are not authorized to join this session.",
  too_early: "This session room isn't open yet.",
  too_late: "This session has ended.",
  not_joinable: "This booking is not eligible for a live session.",
  not_scheduled: "This booking has no scheduled time yet.",
  video_unavailable: "Video service is temporarily unavailable. Please try again shortly.",
};

/**
 * Mint a room-scoped Daily token for the authenticated participant. All
 * authorization + join-window enforcement is server-side (authorize_session_join);
 * the client cannot self-authorize by manipulating the booking id.
 */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await ctx.params;
  try {
    const result = await joinSession(bookingId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SessionError) {
      return NextResponse.json({ error: MESSAGE[err.code] ?? "Unable to join.", code: err.code }, { status: STATUS[err.code] ?? 400 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (/not authenticated/i.test(msg)) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    return NextResponse.json({ error: "Unable to join the session." }, { status: 400 });
  }
}
