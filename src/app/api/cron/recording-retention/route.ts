import { NextResponse, type NextRequest } from "next/server";

import { deleteDailyRecording } from "@/lib/daily/client";
import { isDailyConfigured } from "@/lib/daily/config";
import { notifyRecordingDeletionFailure } from "@/lib/notify";
import { isDueForRetentionDeletion } from "@/lib/recording-retention.mjs";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Study Hall PR9 — 60-day recording retention cron.
 *
 * Protected by CRON_SECRET (same pattern as /api/cron/reminders).
 * Suggested cadence: once daily (vercel.json).
 *
 * For each completed recording past retention_until:
 *   1. Attempt Daily DELETE /recordings/{id}
 *   2. On success (or provider 404): mark deleted_at
 *   3. On failure: store deletion_error, alert manager once (idempotent key)
 *
 * Never deletes early. Never marks deleted without a provider attempt.
 * Duplicate cron runs are safe (skips deleted_at rows).
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Scheduling is not configured (CRON_SECRET unset)." }, { status: 503 });
  }
  const bearer = request.headers.get("authorization")?.startsWith("Bearer ")
    ? request.headers.get("authorization")!.slice(7)
    : null;
  if (request.headers.get("x-cron-secret") !== secret && bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isDailyConfigured) {
    return NextResponse.json({ ok: true, skipped: "daily_not_configured", deleted: 0, failed: 0 });
  }

  const service = getServiceSupabase();
  const nowISO = new Date().toISOString();

  const { data: candidates, error } = await service
    .from("session_recordings")
    .select("id, daily_recording_id, status, retention_until, deleted_at")
    .eq("status", "completed")
    .is("deleted_at", null)
    .not("daily_recording_id", "is", null)
    .not("retention_until", "is", null)
    .lte("retention_until", nowISO)
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Retention query failed." }, { status: 500 });
  }

  let deleted = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of candidates ?? []) {
    if (!isDueForRetentionDeletion(row)) {
      skipped += 1;
      continue;
    }
    const providerId = row.daily_recording_id as string;
    const result = await deleteDailyRecording(providerId);
    if (result.status === "deleted") {
      await service.rpc("mark_recording_deleted", { p_id: row.id, p_clear_error: true });
      deleted += 1;
      continue;
    }
    if (result.status === "skipped") {
      skipped += 1;
      continue;
    }
    await service.rpc("mark_recording_deletion_failed", {
      p_id: row.id,
      p_error: result.error ?? "deletion failed",
    });
    try {
      await notifyRecordingDeletionFailure(row.id as string, result.error ?? "deletion failed");
    } catch {
      /* best-effort */
    }
    failed += 1;
  }

  return NextResponse.json({ ok: true, deleted, failed, skipped, scanned: (candidates ?? []).length });
}

export const GET = handle;
export const POST = handle;
