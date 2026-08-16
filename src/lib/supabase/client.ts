"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * Browser Supabase client for use inside Client Components.
 *
 * Returns `null` when Supabase has not been configured yet (no project
 * connected). Callers must handle the `null` case and show a friendly
 * "not configured" state rather than crashing. Once the owner supplies
 * Supabase credentials (see SETUP.md) this starts working automatically.
 */
export function createSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  return createBrowserClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}
