import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getRecordingAccessLink } from "@/lib/daily/client";
import { isDailyConfigured } from "@/lib/daily/config";
import { isRecordingPlayable } from "@/lib/recording-retention.mjs";
import { getServiceSupabase } from "@/lib/supabase/service";

export type RecordingAccessOutcome =
  | { ok: true; url: string; expiresAt: string }
  | { ok: false; status: number; error: string };

type RecordingRow = {
  id: string;
  booking_id: string;
  daily_recording_id: string | null;
  status: string;
  retention_until: string | null;
  deleted_at: string | null;
};

/**
 * Authorize + mint a short-lived Daily access link.
 *
 * Ownership is always verified server-side via booking.account_id (parents) or
 * is_admin (managers). Client-supplied recording IDs are never trusted alone.
 * Guides cannot access historical recordings through this path.
 */
export async function mintAuthorizedRecordingAccess(opts: {
  recordingId: string;
  /** Authenticated user id (parent or admin). */
  userId: string;
  /** When true, skip account ownership (admin path). */
  asAdmin?: boolean;
  /** Optional user-scoped client for admin RLS path; service used for ownership join. */
  userClient?: SupabaseClient;
}): Promise<RecordingAccessOutcome> {
  if (!opts.recordingId || typeof opts.recordingId !== "string") {
    return { ok: false, status: 400, error: "Invalid request." };
  }
  if (!isDailyConfigured) {
    return { ok: false, status: 503, error: "Video service is not configured." };
  }

  const service = getServiceSupabase();
  const { data: rec } = await service
    .from("session_recordings")
    .select("id, booking_id, daily_recording_id, status, retention_until, deleted_at")
    .eq("id", opts.recordingId)
    .maybeSingle();

  if (!rec) {
    // Uniform 404 — do not leak whether the id exists for another family.
    return { ok: false, status: 404, error: "Recording not found." };
  }

  const row = rec as RecordingRow;

  if (!opts.asAdmin) {
    const { data: booking } = await service
      .from("bookings")
      .select("account_id")
      .eq("id", row.booking_id)
      .maybeSingle();
    if (!booking || booking.account_id !== opts.userId) {
      return { ok: false, status: 404, error: "Recording not found." };
    }
  } else {
    // Admin path: prefer userClient RLS read as defense-in-depth when provided.
    if (opts.userClient) {
      const { data: adminSeen } = await opts.userClient
        .from("session_recordings")
        .select("id")
        .eq("id", opts.recordingId)
        .maybeSingle();
      if (!adminSeen) {
        return { ok: false, status: 404, error: "Recording not found." };
      }
    }
  }

  if (row.deleted_at) {
    return { ok: false, status: 410, error: "Recording expired." };
  }
  if (isRetentionExpiredSafe(row.retention_until)) {
    return { ok: false, status: 410, error: "Recording expired." };
  }
  if (!isRecordingPlayable(row)) {
    return { ok: false, status: 409, error: "Recording is not available for playback." };
  }

  const link = await getRecordingAccessLink(row.daily_recording_id!);
  if (!link) {
    return { ok: false, status: 502, error: "Could not generate a secure link. Try again." };
  }
  return { ok: true, url: link.url, expiresAt: link.expiresAt };
}

function isRetentionExpiredSafe(retentionUntil: string | null): boolean {
  if (!retentionUntil) return false;
  const t = new Date(retentionUntil).getTime();
  return !Number.isNaN(t) && t <= Date.now();
}
