import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

const PROTECTED_PREFIXES = ["/dashboard"];

/**
 * Refreshes the Supabase session cookie on every request and, once
 * authorization data is available, will redirect unauthenticated users
 * away from protected routes. This is the seam future prompts will build
 * real server-enforced authorization on top of (see ARCHITECTURE.md,
 * "Role Based Access Strategy").
 *
 * While no Supabase project is connected yet, this proxy simply passes
 * requests through unchanged so the dashboard placeholder routes remain
 * reachable during this foundation phase.
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.next();
  }

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

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

  const { data } = await supabase.auth.getUser();

  if (isProtectedRoute && !data.user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
