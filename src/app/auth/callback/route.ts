import { NextResponse, type NextRequest } from "next/server";

import { resolvePostAuthHome } from "@/lib/auth-home";
import { sanitizeNextPath } from "@/lib/auth-redirect";
import type { Role } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Supabase Auth email confirmation / recovery / magic-link callback.
 *
 * Establishes the SSR session via code exchange (or OTP verify), then routes
 * parents, pending Guide applicants, Guides, and admins to the right home.
 * Invalid/expired links redirect to a recovery screen — never the homepage.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const error = url.searchParams.get("error");
  const errorCode = url.searchParams.get("error_code");
  const next = sanitizeNextPath(url.searchParams.get("next"), "/dashboard");

  if (error || errorCode) {
    const reason =
      /expired/i.test(error ?? "") || /otp_expired|expired/i.test(errorCode ?? "")
        ? "expired"
        : "invalid";
    return NextResponse.redirect(new URL(`/auth/confirmed?status=error&reason=${reason}`, origin));
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/auth/confirmed?status=error&reason=unavailable", origin));
  }

  let exchangeError: string | null = null;

  if (code) {
    const { error: e } = await supabase.auth.exchangeCodeForSession(code);
    if (e) exchangeError = e.message;
  } else if (tokenHash && type) {
    const { error: e } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "email" | "recovery" | "invite" | "magiclink" | "email_change",
    });
    if (e) exchangeError = e.message;
  } else {
    return NextResponse.redirect(new URL("/auth/confirmed?status=error&reason=invalid", origin));
  }

  if (exchangeError) {
    const reason = /expired|otp_expired/i.test(exchangeError) ? "expired" : "invalid";
    return NextResponse.redirect(new URL(`/auth/confirmed?status=error&reason=${reason}`, origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Link worked but session cookie was not established — polished recovery.
    return NextResponse.redirect(new URL("/auth/confirmed?status=confirmed", origin));
  }

  // Password recovery must land on the reset form.
  if (type === "recovery" || next.startsWith("/reset-password")) {
    return NextResponse.redirect(new URL("/reset-password", origin));
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (profile?.role ?? "student") as Role;
  const home = await resolvePostAuthHome(user.id, role);

  // Always land on the role-appropriate home after confirm/login exchange.
  // Avoid the marketing homepage and avoid ambiguous "confirmed" with no next step.
  void next;
  return NextResponse.redirect(new URL(home, origin));
}
