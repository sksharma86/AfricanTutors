import "server-only";

import { computeSessionAccessWindow } from "@/lib/daily/access-window.mjs";
import { DailyUnavailableError, createMeetingToken, ensureRoom, roomUrl, updateRoomBounds } from "@/lib/daily/client";
import { isDailyConfigured } from "@/lib/daily/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";

export interface SessionInfo {
  authorized: boolean;
  reason?: string;
  role?: "student" | "tutor" | "admin";
  status?: string;
  subject?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  duration_minutes?: number | null;
  join_open_at?: string | null;
  join_close_at?: string | null;
  server_now?: string;
  join_state?: "open" | "too_early" | "too_late" | "not_joinable" | "not_scheduled";
  room_name?: string;
  is_owner?: boolean;
  safe_name?: string;
  counterpart?: string;
  videoConfigured?: boolean;
}

async function authed() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("Not authenticated");
  return { supabase, user: data.user };
}

/** Authoritative session info for the session page (no room/token created). */
export async function getSessionInfo(bookingId: string): Promise<SessionInfo> {
  const { supabase } = await authed();
  const { data, error } = await supabase.rpc("authorize_session_join", { p_booking: bookingId });
  if (error) throw new Error(error.message);
  return { ...(data as SessionInfo), videoConfigured: isDailyConfigured };
}

export interface JoinResult {
  roomUrl: string;
  token: string;
  expiresAt: string;
  role: string;
  safeName: string;
}

/**
 * Authorize the caller for this booking's session, then (only if the window is
 * OPEN) create/reuse the Daily room and mint a short-lived, room-scoped token.
 * Records the participant's join presence. Never mutates booking/payment/earning
 * state; a Daily failure surfaces as a temporary 503-style error and is safe to
 * retry (room + presence are idempotent).
 */
export async function joinSession(bookingId: string): Promise<JoinResult> {
  const { supabase, user } = await authed();
  const { data, error } = await supabase.rpc("authorize_session_join", { p_booking: bookingId });
  if (error) throw new Error(error.message);
  const info = data as SessionInfo;

  if (!info.authorized) {
    throw new SessionError(info.reason === "not_found" ? "not_found" : "forbidden");
  }
  if (info.join_state !== "open") {
    throw new SessionError(info.join_state ?? "not_joinable");
  }
  if (!isDailyConfigured) {
    throw new SessionError("video_unavailable");
  }

  const roomName = info.room_name as string;
  // Normal students/tutors use the 10-min-before .. 15-min-after window; admins
  // get an immediate, short-lived support window (server time).
  const win = computeSessionAccessWindow(
    { role: info.role, joinOpenAt: info.join_open_at, joinCloseAt: info.join_close_at },
    Date.now(),
  );

  const service = getServiceSupabase();
  try {
    const room = await ensureRoom(roomName, win.roomNbf, win.roomExp);
    // A reused room created for the normal window could otherwise lock an admin
    // out before it opens / after it expires — widen its bounds for support.
    if (info.role === "admin") {
      await updateRoomBounds(roomName, win.roomNbf, win.roomExp);
    }
    const token = await createMeetingToken({
      room: roomName,
      userName: info.safe_name ?? "Participant",
      userId: (info.role as string) ?? "participant",
      isOwner: Boolean(info.is_owner),
      expUnix: win.tokenExp,
      // Mandatory automatic recording: begins when the first participant joins.
      autoStartRecording: true,
    });

    // Record which Daily room backs this booking (opaque; observability only).
    await service.from("bookings").update({ daily_room_name: roomName }).eq("id", bookingId).is("daily_room_name", null);
    // Record join presence for student/tutor (admins are support, not attendees).
    if (info.role === "student" || info.role === "tutor") {
      await service.rpc("record_session_presence", { p_booking: bookingId, p_role: info.role, p_event: "join" });
    }

    return {
      roomUrl: room.url || roomUrl(roomName),
      token,
      expiresAt: new Date(win.tokenExp * 1000).toISOString(),
      role: info.role as string,
      safeName: info.safe_name ?? "Participant",
    };
  } catch (err) {
    if (err instanceof DailyUnavailableError) throw new SessionError("video_unavailable");
    throw err;
  }
  void user;
}

/** Record that the caller left the session (best-effort presence). */
export async function recordLeave(bookingId: string): Promise<void> {
  const { supabase } = await authed();
  const { data } = await supabase.rpc("authorize_session_join", { p_booking: bookingId });
  const info = data as SessionInfo | null;
  if (!info?.authorized || (info.role !== "student" && info.role !== "tutor")) return;
  const service = getServiceSupabase();
  await service.rpc("record_session_presence", { p_booking: bookingId, p_role: info.role, p_event: "leave" });
}

export class SessionError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.name = "SessionError";
    this.code = code;
  }
}
