import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getStripe } from "./client";

/**
 * Ensure the given account has a Stripe Customer id, creating one only when a
 * real Stripe transaction is required (never for free-trial / package-minute /
 * full-credit flows).
 *
 * Concurrency safety: after creating the Customer at Stripe we attempt to claim
 * it with a conditional UPDATE (`... where stripe_customer_id is null`). If a
 * concurrent request won the race, our UPDATE affects 0 rows; we then adopt the
 * winner's id and delete our now-orphaned Stripe Customer so no duplicates
 * linger. `service` must be a service-role client (writes bypass RLS; the column
 * is server-managed and never trusted from the browser).
 */
export async function ensureStripeCustomer(
  service: SupabaseClient,
  accountId: string,
  email?: string | null,
): Promise<string> {
  const { data: profile, error } = await service
    .from("profiles")
    .select("stripe_customer_id, display_name")
    .eq("id", accountId)
    .single();
  if (error) throw new Error(error.message);
  if (profile?.stripe_customer_id) return profile.stripe_customer_id as string;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: (profile?.display_name as string | undefined) ?? undefined,
    metadata: { account_id: accountId },
  });

  const { data: claimed } = await service
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", accountId)
    .is("stripe_customer_id", null)
    .select("stripe_customer_id")
    .maybeSingle();

  if (claimed?.stripe_customer_id === customer.id) return customer.id;

  // Lost the race — adopt the existing id and clean up the duplicate.
  const { data: existing } = await service
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", accountId)
    .single();
  if (existing?.stripe_customer_id) {
    await stripe.customers.del(customer.id).catch(() => {});
    return existing.stripe_customer_id as string;
  }
  return customer.id;
}
