import { NextResponse, type NextRequest } from "next/server";

import { adminApiContext } from "@/lib/admin-service";
import { notifyAccountCreditApplied } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin balance adjustments with optional parent notification on positive credit.
 * Keeps RPC authorization (admin) while allowing idempotent notify on credit grants.
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await adminApiContext();
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return NextResponse.json({ error: m || "Unauthorized." }, { status: /authenticated/i.test(m) ? 401 : 403 });
  }
  const { supabase } = ctx;

  const body = (await request.json().catch(() => null)) as {
    kind?: "credit" | "minutes";
    accountId?: string;
    amountCents?: number;
    minutes?: number;
    reason?: string;
  } | null;

  const accountId = typeof body?.accountId === "string" ? body.accountId.trim() : "";
  if (!accountId) return NextResponse.json({ error: "Account id required." }, { status: 400 });
  const reason = (body?.reason || "admin adjustment").slice(0, 500);
  const reference = `adj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (body?.kind === "credit") {
    const cents = Number(body.amountCents);
    if (!Number.isFinite(cents) || cents === 0) {
      return NextResponse.json({ error: "Invalid credit amount." }, { status: 400 });
    }
    const { error } = await supabase.rpc("admin_adjust_dollar_credit", {
      p_account: accountId,
      p_amount_cents: Math.round(cents),
      p_reason: reason,
      p_reference: reference,
    });
    if (error) return NextResponse.json({ error: error.message.replace(/^.*:\s*/, "") }, { status: 400 });
    if (cents > 0) {
      try {
        await notifyAccountCreditApplied(accountId, Math.round(cents), { reason, reference });
      } catch {
        /* best-effort */
      }
    }
    return NextResponse.json({ ok: true, reference });
  }

  if (body?.kind === "minutes") {
    const minutes = Number(body.minutes);
    if (!Number.isInteger(minutes) || minutes === 0) {
      return NextResponse.json({ error: "Invalid minute amount." }, { status: 400 });
    }
    const { error } = await supabase.rpc("admin_adjust_package_minutes", {
      p_account: accountId,
      p_minutes: minutes,
      p_reason: reason,
      p_reference: reference,
    });
    if (error) return NextResponse.json({ error: error.message.replace(/^.*:\s*/, "") }, { status: 400 });
    return NextResponse.json({ ok: true, reference });
  }

  return NextResponse.json({ error: "Unknown adjustment kind." }, { status: 400 });
}
