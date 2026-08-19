import { NextResponse, type NextRequest } from "next/server";

import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operational cleanup endpoint for expired checkouts. Fulfillment already
 * self-enforces the internal deadline (see 0009), so this sweep is housekeeping:
 * it releases abandoned booking holds and expired package reservations (restoring
 * reserved credit) via `release_expired_checkouts()`.
 *
 * Protected by a shared secret (`CRON_SECRET`) so only the scheduler can call it.
 * Wire it to a scheduler once the deployment target is known, e.g.:
 *   - Vercel Cron: add a crons entry in vercel.json pointing at this path on a
 *     "every 5 minutes" schedule; Vercel sends `Authorization: Bearer $CRON_SECRET`.
 *   - Supabase pg_cron: schedule a job that net.http_post()s this route with the
 *     `x-cron-secret` header on a "every 5 minutes" schedule.
 *   - Any external scheduler POSTing with header `x-cron-secret: $CRON_SECRET`.
 * If `CRON_SECRET` is unset the endpoint is disabled (503) and cleanup can still
 * be run manually via the DB function.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Scheduling is not configured (CRON_SECRET unset)." }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (headerSecret !== secret && bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.rpc("release_expired_checkouts");
    if (error) throw new Error(error.message);
    return NextResponse.json({ released: data ?? 0 });
  } catch {
    return NextResponse.json({ error: "Sweep failed." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
