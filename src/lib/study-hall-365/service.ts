import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { chooseBookingSource, evaluateStudyHall365Day, isSubscriptionEntitled } from "@/lib/study-hall-365/entitlement.mjs";
import { DEFAULT_ACCOUNT_TIMEZONE, safeTimeZone } from "@/lib/study-hall-365/calendar.mjs";
import { getServiceSupabase } from "@/lib/supabase/service";

export type StudyHall365Row = {
  id: string;
  account_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string | null;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  ended_at: string | null;
};

export async function resolveAccountTimeZone(
  service: SupabaseClient,
  accountId: string,
): Promise<string> {
  const { data, error } = await service.rpc("resolve_account_timezone", { p_account: accountId });
  if (error || typeof data !== "string" || !data) return DEFAULT_ACCOUNT_TIMEZONE;
  return safeTimeZone(data);
}

export async function hasOpenStudyHall365(accountId: string, client?: SupabaseClient): Promise<boolean> {
  const db = client ?? getServiceSupabase();
  const { data, error } = await db.rpc("study_hall_365_has_open_membership", { p_account: accountId });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function getStudyHall365Entitlement(params: {
  accountId: string;
  localDate?: string;
  asOf?: Date;
  bookingStart?: Date | string | null;
  prepaidMinutes?: number;
  freeTrialEligible?: boolean;
  client?: SupabaseClient;
}) {
  const db = params.client ?? getServiceSupabase();
  const { data, error } = await db.rpc("get_study_hall_365_entitlement", {
    p_account: params.accountId,
    p_local_date: params.localDate ?? null,
    p_as_of: (params.asOf ?? new Date()).toISOString(),
  });
  if (error) throw new Error(error.message);

  const row = (data ?? {}) as {
    entitled?: boolean;
    source?: string;
    reason?: string;
    local_date?: string;
    time_zone?: string;
    status?: string | null;
    cancel_at_period_end?: boolean;
    current_period_start?: string | null;
    current_period_end?: string | null;
    ended_at?: string | null;
    consumed?: boolean;
    consumed_booking_id?: string | null;
  };

  const evaluated = evaluateStudyHall365Day({
    status: row.status,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    periodStart: row.current_period_start,
    periodEnd: row.current_period_end,
    endedAt: row.ended_at,
    consumed: Boolean(row.consumed),
    timeZone: row.time_zone,
    localDate: row.local_date,
    now: params.asOf,
    bookingStart: params.bookingStart,
  });

  const combined = chooseBookingSource({
    studyHall365: evaluated,
    prepaidMinutes: params.prepaidMinutes,
    freeTrialEligible: params.freeTrialEligible,
  });

  return {
    entitled: evaluated.entitled,
    source: evaluated.entitled ? "study_hall_365" : combined.source,
    date: evaluated.date,
    timeZone: evaluated.timeZone,
    reason: evaluated.entitled ? evaluated.reason : row.reason ?? evaluated.reason,
    consumed: evaluated.consumed,
    consumedBookingId: row.consumed_booking_id ?? null,
    status: row.status ?? null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    currentPeriodStart: row.current_period_start ?? null,
    currentPeriodEnd: row.current_period_end ?? null,
    bookingSource: combined,
  };
}

export async function consumeStudyHall365Day(params: {
  accountId: string;
  localDate: string;
  bookingId?: string | null;
  asOf?: Date;
}) {
  const db = getServiceSupabase();
  const { data, error } = await db.rpc("consume_study_hall_365_day", {
    p_account: params.accountId,
    p_local_date: params.localDate,
    p_booking_id: params.bookingId ?? null,
    p_as_of: (params.asOf ?? new Date()).toISOString(),
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; reason: string; local_date?: string; id?: string };
}

export async function loadOwnMembership(
  client: SupabaseClient,
  accountId: string,
): Promise<Pick<
  StudyHall365Row,
  "status" | "current_period_end" | "current_period_start" | "cancel_at_period_end" | "ended_at"
> | null> {
  const { data, error } = await client
    .from("study_hall_365_subscriptions")
    .select("status, current_period_start, current_period_end, cancel_at_period_end, ended_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

export function membershipSummaryForUi(
  row: {
    status: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    ended_at: string | null;
  } | null,
  now = new Date(),
) {
  if (!row) return { hasMembership: false as const };
  const entitled = isSubscriptionEntitled(row.status, {
    cancelAtPeriodEnd: row.cancel_at_period_end,
    periodEnd: row.current_period_end,
    endedAt: row.ended_at,
    now,
  });
  return {
    hasMembership: true as const,
    status: row.status,
    entitled,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    periodEnd: row.current_period_end,
  };
}
