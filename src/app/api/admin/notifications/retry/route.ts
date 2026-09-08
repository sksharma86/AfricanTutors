import { NextResponse, type NextRequest } from "next/server";

import { adminApiContext } from "@/lib/admin-service";
import { isEmailRecipient } from "@/lib/notifications/retry-policy.mjs";
import {
  evaluateEmailDeliveryRetry,
  sendLeasedEmailDelivery,
} from "@/lib/notifications/retry-send";
import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only retry of a FAILED email delivery.
 * Revalidates current-state events before leasing so a skip does not increment
 * attempts. Then retry_email_delivery leases failed→pending (existing concurrency
 * guard) and stored content is sent. Never re-runs the business operation.
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
  const { data: existing } = await service
    .from("email_deliveries")
    .select("*")
    .eq("id", body.deliveryId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Delivery not found." }, { status: 404 });
  if (!isEmailRecipient(existing.to_email)) {
    return NextResponse.json({ retried: false, reason: "Only email deliveries can be retried here." }, { status: 409 });
  }
  if (existing.status !== "failed") {
    return NextResponse.json({ retried: false, reason: "Not a failed delivery (already sent or being retried)." }, { status: 409 });
  }

  const decision = await evaluateEmailDeliveryRetry(existing);
  if (!decision.ok) {
    await service.rpc("complete_email_delivery", {
      p_key: existing.idempotency_key,
      p_status: "skipped",
      p_error: decision.reason,
    });
    return NextResponse.json({ retried: true, status: "skipped", reason: decision.reason });
  }

  const { data, error } = await service.rpc("retry_email_delivery", { p_delivery_id: body.deliveryId });
  if (error) return NextResponse.json({ error: "Retry failed." }, { status: 400 });
  const r = data as { retried: boolean; key?: string };
  if (!r.retried) {
    return NextResponse.json({ retried: false, reason: "Not a failed delivery (already sent or being retried)." }, { status: 409 });
  }

  const { data: leased } = await service.from("email_deliveries").select("*").eq("id", body.deliveryId).maybeSingle();
  if (!leased) return NextResponse.json({ retried: false, reason: "Delivery not found after lease." }, { status: 409 });

  const result = await sendLeasedEmailDelivery(leased, { countAttempt: false });
  return NextResponse.json({ retried: true, status: result.status, reason: result.reason ?? null });
}
