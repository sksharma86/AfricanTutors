#!/usr/bin/env node
/**
 * Promotes an existing African Tutors account to the "admin" role.
 *
 * This is the only supported way to create an administrator account: there
 * is no public "sign up as admin" option anywhere in the app, and no
 * client-facing code path can set profiles.role to 'admin' (see
 * SETUP.md > "Creating the first administrator", and
 * supabase/migrations/20260816000000_roles_and_profiles.sql, which never
 * grants UPDATE on profiles.role to the `authenticated` role).
 *
 * This script uses the Supabase SERVICE ROLE key, which bypasses Row Level
 * Security entirely — it must only ever be run by a trusted developer/
 * operator from a secure machine, never shipped to a browser.
 *
 * Usage:
 *   node --env-file=.env.local scripts/promote-admin.mjs someone@example.com
 *
 * The person must have already signed up for a normal African Tutors
 * account (as a student or tutor) with that email before running this.
 */

import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];

if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/promote-admin.mjs <email>");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run this with --env-file=.env.local (or otherwise ensure both are set).",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(targetEmail) {
  let page = 1;
  const perPage = 200;

  // The Admin API only supports listing users, not filtering by email
  // directly, so we page through until we find a match.
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === targetEmail.toLowerCase(),
    );
    if (match) return match;

    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const user = await findUserByEmail(email);

  if (!user) {
    console.error(
      `No account found for ${email}. They need to sign up for a normal account first.`,
    );
    process.exit(1);
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", user.id)
    .select("id, display_name, role")
    .single();

  if (error) throw error;

  console.log(`Success: ${updated.display_name} (${email}) is now an admin.`);
}

main().catch((error) => {
  console.error("Failed to promote user to admin:", error.message ?? error);
  process.exit(1);
});
