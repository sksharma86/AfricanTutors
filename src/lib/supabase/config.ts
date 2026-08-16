/**
 * Central place to read Supabase configuration from the environment.
 *
 * Nothing in this file throws if the environment variables are missing.
 * That lets the rest of the app (and this early foundation phase, before a
 * Supabase project is connected) render normally and simply treat auth as
 * "not configured yet" instead of crashing the whole app at build/runtime.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
