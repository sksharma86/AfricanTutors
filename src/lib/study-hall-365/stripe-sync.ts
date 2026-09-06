import "server-only";

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

import { STUDY_HALL_365_KIND } from "@/lib/study-hall-365/catalog.mjs";
import { invoiceSubscriptionId, stripeId, subscriptionPaidPeriod } from "@/lib/study-hall-365/stripe-period.mjs";
import { getStripe } from "@/lib/stripe/client";

type Service = SupabaseClient;

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function unixOrNull(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

export async function upsertSubscriptionFromStripe(
  service: Service,
  params: {
    subscription: Stripe.Subscription;
    accountId: string;
    eventId: string;
    eventCreated: number;
    paymentId?: string | null;
  },
) {
  const period = subscriptionPaidPeriod(params.subscription);
  if (!period) {
    throw new Error("Stripe subscription is missing a billing period");
  }
  const customerId = stripeId(params.subscription.customer);
  if (!customerId) throw new Error("Stripe subscription is missing a customer");

  const endedAt =
    params.subscription.status === "incomplete_expired"
      ? unixOrNull(params.subscription.ended_at) ?? new Date().toISOString()
      : unixOrNull(params.subscription.ended_at);

  const { data, error } = await service.rpc("upsert_study_hall_365_subscription", {
    p_account: params.accountId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: params.subscription.id,
    p_stripe_price_id: period.priceId,
    p_status: params.subscription.status,
    p_period_start: period.start.toISOString(),
    p_period_end: period.end.toISOString(),
    p_cancel_at_period_end: Boolean(params.subscription.cancel_at_period_end),
    p_canceled_at: unixOrNull(params.subscription.canceled_at),
    p_ended_at: endedAt,
    p_latest_invoice_id: stripeId(params.subscription.latest_invoice),
    p_event_id: params.eventId,
    p_event_created: params.eventCreated,
    p_payment_id: params.paymentId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { status: string; id?: string };
}

export async function syncSubscriptionById(
  service: Service,
  params: {
    subscriptionId: string;
    accountId?: string | null;
    eventId: string;
    eventCreated: number;
    paymentId?: string | null;
    ended?: boolean;
  },
) {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(params.subscriptionId);
  let accountId: string | null = params.accountId ?? subscription.metadata?.account_id ?? null;
  if (!accountId) {
    const { data } = await service
      .from("study_hall_365_subscriptions")
      .select("account_id")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();
    accountId = (data?.account_id as string | undefined) ?? null;
  }
  if (!accountId) {
    const customerId = stripeId(subscription.customer);
    if (customerId) {
      const { data } = await service
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      accountId = (data?.id as string | undefined) ?? null;
    }
  }
  if (!accountId) return { status: "ignored", reason: "unknown_account" };

  if (params.ended) {
    const period = subscriptionPaidPeriod(subscription);
    if (!period) throw new Error("Stripe subscription is missing a billing period");
    const { data, error } = await service.rpc("upsert_study_hall_365_subscription", {
      p_account: accountId,
      p_stripe_customer_id: stripeId(subscription.customer),
      p_stripe_subscription_id: subscription.id,
      p_stripe_price_id: period.priceId,
      p_status: "canceled",
      p_period_start: period.start.toISOString(),
      p_period_end: period.end.toISOString(),
      p_cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      p_canceled_at: unixOrNull(subscription.canceled_at) ?? new Date().toISOString(),
      p_ended_at: unixOrNull(subscription.ended_at) ?? new Date().toISOString(),
      p_latest_invoice_id: stripeId(subscription.latest_invoice),
      p_event_id: params.eventId,
      p_event_created: params.eventCreated,
      p_payment_id: params.paymentId ?? null,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  return upsertSubscriptionFromStripe(service, {
    subscription,
    accountId,
    eventId: params.eventId,
    eventCreated: params.eventCreated,
    paymentId: params.paymentId,
  });
}

export function isStudyHall365Session(session: Stripe.Checkout.Session): boolean {
  return session.mode === "subscription" && session.metadata?.kind === STUDY_HALL_365_KIND;
}

export async function fulfillStudyHall365Checkout(
  service: Service,
  session: Stripe.Checkout.Session,
  event: Stripe.Event,
) {
  const paymentId = session.metadata?.payment_id ?? null;
  const accountId = session.metadata?.account_id ?? null;
  const subscriptionId = stripeId(session.subscription);
  if (paymentId) {
    const { error } = await service.rpc("fulfill_study_hall_365_payment", {
      p_payment_id: paymentId,
      p_amount_cents: typeof session.amount_total === "number" ? session.amount_total : null,
      p_charge_id: stripeId(session.payment_intent),
      p_subscription_id: subscriptionId,
    });
    if (error) throw new Error(error.message);
  }
  if (subscriptionId) {
    await syncSubscriptionById(service, {
      subscriptionId,
      accountId,
      eventId: event.id,
      eventCreated: event.created,
      paymentId,
    });
  }
}

export async function syncFromInvoice(
  service: Service,
  invoice: Stripe.Invoice,
  event: Stripe.Event,
  ended = false,
) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return { status: "ignored", reason: "no_subscription" };
  const invoiceRecord = invoice as Stripe.Invoice & {
    subscription_details?: { metadata?: { account_id?: string } };
  };
  const accountId =
    invoiceRecord.subscription_details?.metadata?.account_id ?? invoice.metadata?.account_id ?? null;
  return syncSubscriptionById(service, {
    subscriptionId,
    accountId,
    eventId: event.id,
    eventCreated: event.created,
    ended,
  });
}

export { iso };
