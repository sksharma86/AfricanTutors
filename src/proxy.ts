import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";
import { DASHBOARD_PATH_BY_ROLE, type Role } from "@/lib/roles";

const PROTECTED_PREFIX = "/dashboard";

/**
 * Refreshes the Supabase session cookie on every request and enforces
 * server-side route protection for `/dashboard/*`.
 *
 * This is the "authorization is not a UI feature" seam described in
 * ARCHITECTURE.md > "Role Based Access Strategy": a logged-out visitor is
 * sent to /login, and a logged-in user who manually navigates to a
 * dashboard that isn't theirs (e.g. a student typing /dashboard/admin into
 * the address bar) is redirected to their own dashboard — the wrong
 * dashboard is never rendered for them, regardless of what the UI would or
 * wouldn't have linked to.
 *
 * Row Level Security in Postgres is still the ultimate authority (this
 * proxy only decides what page to *render*, never what data a query can
 * *return*), but this stops the obvious "just change the URL" bypass at
 * the routing layer too.
 *
 * While no Supabase project is connected yet, this proxy simply passes
 * requests through unchanged so the dashboard placeholder routes remain
 * reachable during local development without credentials.
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.next();
  }

  const isProtectedRoute = request.nextUrl.pathname.startsWith(PROTECTED_PREFIX);

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
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

  const { data } = await supabase.auth.getUser();

  if (!isProtectedRoute) {
    return response;
  }

  if (!data.user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    // Defensive: every auth user should get a profile row via the
    // on_auth_user_created trigger. If one is somehow missing, don't
    // render a dashboard we can't attribute a role to.
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("error", "profile-not-found");
    return NextResponse.redirect(redirectUrl);
  }

  const ownDashboardPath = DASHBOARD_PATH_BY_ROLE[profile.role as Role];
  const isOwnDashboard = request.nextUrl.pathname.startsWith(ownDashboardPath);

  if (!isOwnDashboard) {
    return NextResponse.redirect(new URL(ownDashboardPath, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
