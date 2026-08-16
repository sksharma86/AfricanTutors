import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabaseEnv = Boolean(url && anonKey && serviceKey);

/** Service-role client that bypasses RLS. Server-only, never shipped to the browser. */
export function adminClient() {
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Fresh anon client (one per signed-in user so sessions don't collide). */
export function anonClient() {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

const created = [];

/**
 * Creates a confirmed auth user (no confirmation email sent). The
 * on_auth_user_created trigger runs, creating the matching profile rows.
 */
export async function createUser({ requestedRole = "student", displayName = "Test User" } = {}) {
  const admin = adminClient();
  const email = `phase2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = `Pw-${Math.random().toString(36).slice(2)}-9!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { requested_role: requestedRole, display_name: displayName },
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  created.push(data.user.id);
  return { id: data.user.id, email, password };
}

/** Promotes a user to admin using the service role (bypasses RLS). */
export async function makeAdmin(userId) {
  const admin = adminClient();
  const { error } = await admin.from("profiles").update({ role: "admin" }).eq("id", userId);
  if (error) throw new Error(`makeAdmin failed: ${error.message}`);
}

/** Returns an anon client signed in as the given user. */
export async function signIn(email, password) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn failed: ${error.message}`);
  return client;
}

/** Reads a profile row using the service role (ground truth, ignores RLS). */
export async function adminGetProfile(userId) {
  const admin = adminClient();
  const { data } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data;
}

export async function adminGetTutor(userId) {
  const admin = adminClient();
  const { data } = await admin.from("tutor_profiles").select("*").eq("profile_id", userId).maybeSingle();
  return data;
}

export async function cleanupAll() {
  const admin = adminClient();
  for (const id of created.splice(0)) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}
