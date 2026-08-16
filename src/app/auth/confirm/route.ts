import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Handles the links Supabase sends in confirmation/recovery emails, using
 * the current recommended `token_hash` + `type` pattern (not the older,
 * deprecated implicit hash-fragment flow) — see
 * https://supabase.com/docs/guides/auth/server-side/nextjs.
 *
 * Covers both "confirm your email" (type=signup) and "reset your
 * password" (type=recovery) links with one route, since both just need to
 * exchange a token_hash for a real session before sending the user
 * onward.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const explicitNext = searchParams.get("next");

  const defaultNextByType: Partial<Record<EmailOtpType, string>> = {
    recovery: "/reset-password",
    signup: "/dashboard",
    email_change: "/dashboard",
    invite: "/dashboard",
  };

  const next = explicitNext ?? (type ? defaultNextByType[type] : undefined) ?? "/dashboard";

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();

    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

      if (!error) {
        return NextResponse.redirect(new URL(next, origin));
      }
    }
  }

  const errorUrl = new URL("/auth/error", origin);
  errorUrl.searchParams.set("reason", "invalid-or-expired-link");
  return NextResponse.redirect(errorUrl);
}
