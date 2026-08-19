import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET; // Svix "whsec_..." secret

/**
 * Verify a Resend (Svix) webhook signature. signedContent = `${id}.${ts}.${body}`;
 * the secret's base64 body (after the `whsec_` prefix) is the HMAC key; the
 * `svix-signature` header is a space-separated list of `v1,<base64>` values.
 */
function verify(id: string | null, ts: string | null, body: string, header: string | null): boolean {
  if (!RESEND_WEBHOOK_SECRET || !id || !ts || !header) return false;
  try {
    const key = Buffer.from(RESEND_WEBHOOK_SECRET.replace(/^whsec_/, ""), "base64");
    const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
    return header.split(" ").some((part) => {
      const sig = part.includes(",") ? part.split(",")[1] : part;
      try {
        const provided = Buffer.from(sig, "base64");
        return expected.length === provided.length && timingSafeEqual(expected, provided);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Minimal Resend delivery webhook → updates email_deliveries status (delivered /
 * bounced / failed) by provider message id. Idempotent; disabled (503) unless
 * RESEND_WEBHOOK_SECRET is set. Never touches business/financial state.
 */
export async function POST(request: NextRequest) {
  if (!RESEND_WEBHOOK_SECRET) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  const raw = await request.text();
  if (!verify(request.headers.get("svix-id"), request.headers.get("svix-timestamp"), raw, request.headers.get("svix-signature"))) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }
  let parsed: { type?: string; data?: { email_id?: string } } | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload." }, { status: 400 });
  }
  const emailId = parsed?.data?.email_id;
  const status =
    parsed?.type === "email.delivered" ? "delivered" : parsed?.type === "email.bounced" || parsed?.type === "email.complained" ? "bounced" : null;
  if (emailId && status) {
    try {
      await getServiceSupabase().rpc("record_email_provider_status", { p_provider_message_id: emailId, p_status: status, p_error: status === "bounced" ? parsed?.type : null });
    } catch {
      /* best-effort */
    }
  }
  return NextResponse.json({ received: true });
}
