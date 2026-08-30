import { cache } from "react";
import { redirect } from "next/navigation";

import { getUserBounded } from "@/lib/auth-user.mjs";
import { DASHBOARD_PATH_BY_ROLE, type Role } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string | null;
  role: Role;
  displayName: string | null;
}

/**
 * Resolves the currently authenticated user together with their authoritative
 * role from the `profiles` table (never from client-supplied data). Returns
 * `null` when Supabase is not configured or no user is signed in.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await getUserBounded(() => supabase.auth.getUser(), { label: "server.getUser" });
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    role: (profile?.role ?? "student") as Role,
    displayName: profile?.display_name ?? null,
  };
});

/** Redirects to login when there is no authenticated user. */
export async function requireUser(currentPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
  }
  return user;
}

/**
 * Server-side role guard (defense in depth on top of `proxy.ts`). Sends
 * unauthenticated visitors to login and users with the wrong role back to
 * their own dashboard.
 */
export async function requireRole(role: Role, currentPath: string): Promise<CurrentUser> {
  const user = await requireUser(currentPath);
  if (user.role !== role) {
    redirect(DASHBOARD_PATH_BY_ROLE[user.role]);
  }
  return user;
}
