import "server-only";

import { getCurrentUser } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-side context for admin API routes. Returns the admin's RLS-scoped
 * Supabase client (so SECURITY DEFINER functions see auth.uid() = the admin and
 * enforce is_admin) plus the resolved user. Throws for non-admins.
 */
export async function adminApiContext() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (user.role !== "admin") throw new Error("Not authorized");
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return { supabase, user };
}

/** Look up a user's email via the service role (profiles has no email column). */
export async function lookupEmail(accountId: string): Promise<string | null> {
  try {
    const service = getServiceSupabase();
    const { data } = await service.auth.admin.getUserById(accountId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}
