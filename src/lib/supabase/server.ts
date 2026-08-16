import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * Server-side Supabase client for use in Server Components, Route Handlers,
 * and Server Actions. Reads/writes the auth session via cookies so that
 * session state is available on the server (needed for future server
 * enforced authorization checks).
 *
 * Returns `null` when Supabase has not been configured yet.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component without a mutable response.
          // Session refresh in this case is handled by middleware instead.
        }
      },
    },
  });
}
