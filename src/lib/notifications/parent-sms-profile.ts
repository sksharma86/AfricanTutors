import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Load phone + transactional SMS preference. If migration 0046 is not
 * applied yet, fail closed (treat as not opted in). Never infers consent
 * from phone_e164.
 */
export async function loadParentSmsProfile(
  service: SupabaseClient,
  accountId: string,
): Promise<{ phone_e164: string | null; sms_transactional_opt_in: boolean } | null> {
  const withConsent = await service
    .from("profiles")
    .select("phone_e164, sms_transactional_opt_in")
    .eq("id", accountId)
    .maybeSingle();
  if (!withConsent.error) {
    const row = withConsent.data as {
      phone_e164?: string | null;
      sms_transactional_opt_in?: boolean | null;
    } | null;
    if (!row) return null;
    return {
      phone_e164: typeof row.phone_e164 === "string" ? row.phone_e164 : null,
      sms_transactional_opt_in: row.sms_transactional_opt_in === true,
    };
  }
  if (/sms_transactional_opt_in/i.test(String(withConsent.error.message || ""))) {
    const phoneOnly = await service.from("profiles").select("phone_e164").eq("id", accountId).maybeSingle();
    const row = phoneOnly.data as { phone_e164?: string | null } | null;
    if (!row) return null;
    return {
      phone_e164: typeof row.phone_e164 === "string" ? row.phone_e164 : null,
      sms_transactional_opt_in: false,
    };
  }
  return null;
}
