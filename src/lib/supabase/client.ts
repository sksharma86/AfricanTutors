"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * Browser Supabase client for use inside Client Components.
 *
 * Returns `null` when Supabase has not been configured yet (no project
 * connected). Callers must handle the `null` case and show a friendly
 * "not configured" state rather than crashing. Once the owner supplies
 * Supabase credentials (see SETUP.md) this starts working automatically.
 */
let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  // One GoTrue client per browser tab. Creating a new client on every call
  // races cookie/storage writes and can stall the post-login navigation.
  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  }
  return browserClient;
}
