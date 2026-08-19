import { NextResponse, type NextRequest } from "next/server";

import { adminApiContext } from "@/lib/admin-service";
import { sendEmail } from "@/lib/email/transport";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only retry of a FAILED email delivery. Re-sends the stored rendered
 * content to the original recipient; it NEVER re-runs the underlying business
 * operation and never touches money/bookings/credits. `retry_email_delivery`
 * atomically flips 'failed' → 'pending' and bumps attempts, so two concurrent
 * retries cannot both send.
 */
export async function POST(request: NextRequest) {
  try {
    await adminApiContext();
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return NextResponse.json({ error: m }, { status: /authenticated/i.test(m) ? 401 : 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body.deliveryId !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const service = getServiceSupabase();
  const { data, error } = await service.rpc("retry_email_delivery", { p_delivery_id: body.deliveryId });
  if (error) return NextResponse.json({ error: "Retry failed." }, { status: 400 });
  const r = data as { retried: boolean; key?: string; to?: string; subject?: string; html?: string; text?: string };
  if (!r.retried) {
    return NextResponse.json({ retried: false, reason: "Not a failed delivery (already sent or being retried)." }, { status: 409 });
  }

  const result = await sendEmail({ to: r.to ?? "", subject: r.subject ?? "", html: r.html ?? "", text: r.text ?? "" });
  await service.rpc("complete_email_delivery", {
    p_key: r.key,
    p_status: result.status,
    p_provider_message_id: result.id ?? null,
    p_error: result.error ?? null,
  });
  return NextResponse.json({ retried: true, status: result.status });
}
