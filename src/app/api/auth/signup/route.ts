import { NextResponse, type NextRequest } from "next/server";

import { authCallbackUrl } from "@/lib/auth-redirect";
import { notifyWelcome } from "@/lib/notify";
import { friendlySignupError, parentWelcomeEligible } from "@/lib/notifications/parent-welcome.mjs";
import type { RequestableRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestedRoleOf(value: unknown): RequestableRole {
  return value === "tutor" ? "tutor" : "student";
}

/**
 * Authoritative parent (and Guide-applicant) signup.
 * Welcome email fires only after a successful new parent account is created.
 * Failed signup, duplicate/unconfirmed ghosts, and Guide applicants do not send.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const requestedRole = requestedRoleOf(body?.requestedRole);

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Choose a stronger password (at least 8 characters)." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not available." }, { status: 503 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/+$/, "");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, requested_role: requestedRole },
      emailRedirectTo: authCallbackUrl(appUrl, "/dashboard"),
    },
  });

  if (error) {
    return NextResponse.json({ error: friendlySignupError(error.message) }, { status: 400 });
  }

  if (parentWelcomeEligible({ requestedRole, user: data.user, error: null })) {
    try {
      await notifyWelcome(data.user!.id, displayName || data.user?.email || null);
    } catch {
      /* best-effort — never undo account creation */
    }
  }

  if (data.session) {
    return NextResponse.json({
      status: "authenticated",
      redirect: requestedRole === "tutor" ? "/dashboard/applicant" : "/dashboard/student",
    });
  }

  return NextResponse.json({ status: "confirm_email" });
}
