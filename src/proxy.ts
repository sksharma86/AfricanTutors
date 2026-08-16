import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { DASHBOARD_PATH_BY_ROLE, type Role } from "@/lib/roles";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

const PROTECTED_PREFIXES = ["/dashboard"];

/**
 * Refreshes the Supabase session cookie on every request and enforces
 * server-side access control on protected routes (see ARCHITECTURE.md,
 * "Role Based Access Strategy"):
 *
 *   * Unauthenticated visitors to `/dashboard/*` are redirected to `/login`.
 *   * Authenticated users who hit a dashboard that does not match their
 *     authoritative role (read from `profiles`, not from the client) are
 *     redirected to their own dashboard.
 *
 * This is real access control, not security-by-hidden-UI. When Supabase is
 * not configured it passes requests through so the app still runs.
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isProtectedRoute) {
    return response;
  }

  if (!user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", path);
    return NextResponse.redirect(redirectUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role ?? "student") as Role;
  const roleHome = DASHBOARD_PATH_BY_ROLE[role];

  for (const [otherRole, home] of Object.entries(DASHBOARD_PATH_BY_ROLE)) {
    if (path.startsWith(home) && role !== otherRole) {
      return NextResponse.redirect(new URL(roleHome, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
