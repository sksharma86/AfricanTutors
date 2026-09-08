import { NextResponse, type NextRequest } from "next/server";

import {
  EMAIL_RETRY_MAX_ATTEMPTS,
  EMAIL_STALE_PENDING_MINUTES,
  leasedRetryRows,
} from "@/lib/notifications/retry-policy.mjs";
import { sendLeasedEmailDelivery } from "@/lib/notifications/retry-send";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PR7E — bounded automatic retry of failed and stale-pending email deliveries.
 * Protected by CRON_SECRET. Does not re-run business events. Does not create
 * new idempotency keys. Vercel Cron ~every 15 minutes.
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

  const service = getServiceSupabase();
  const { data, error } = await service.rpc("claim_email_delivery_retry_batch", {
    p_limit: 40,
    p_stale_pending_minutes: EMAIL_STALE_PENDING_MINUTES,
    p_max_attempts: EMAIL_RETRY_MAX_ATTEMPTS,
  });
  if (error) {
    if (/could not find|does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json({ ok: true, skipped: true, reason: "migration_pending" });
    }
    return NextResponse.json({ error: "Notification retry sweep failed." }, { status: 500 });
  }

  const rows = leasedRetryRows(data);
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    const result = await sendLeasedEmailDelivery(row as Parameters<typeof sendLeasedEmailDelivery>[0]);
    if (result.status === "sent") sent += 1;
    else if (result.status === "skipped") skipped += 1;
    else failed += 1;
  }

  return NextResponse.json({ ok: true, claimed: rows.length, sent, skipped, failed });
}

export const GET = handle;
export const POST = handle;
