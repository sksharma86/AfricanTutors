import type Stripe from "stripe";

export const HANDLED_STRIPE_EVENT_TYPES: readonly string[];

export function isPaidCheckoutSession(session: Stripe.Checkout.Session): boolean;
export function shouldFulfillStudyHall365CheckoutSession(session: Stripe.Checkout.Session): boolean;
export function shouldFulfillStudyHall365PaymentForStatus(status: string | null | undefined): boolean;
export function stripeCheckoutKind(
  metadata: Stripe.Metadata | null | undefined,
): "booking" | "package" | "study_hall_365" | null;

export type StripeWebhookDeps = {
  beginStripeEvent: (id: string, type: string) => Promise<string>;
  completeStripeEvent: (id: string) => Promise<void>;
  failStripeEvent: (id: string, error?: string) => Promise<void>;
  fulfillFromMetadata: (
    metadata: Stripe.Metadata | null | undefined,
    amount: number | null | undefined,
    paymentIntent: unknown,
  ) => Promise<void>;
  fulfillStudyHall365Checkout: (session: Stripe.Checkout.Session, event: Stripe.Event) => Promise<void>;
  isStudyHall365Session: (session: Stripe.Checkout.Session) => boolean;
  syncSubscriptionById: (params: {
    subscriptionId: string;
    accountId?: string | null;
    eventId: string;
    eventCreated: number;
    ended?: boolean;
  }) => Promise<unknown>;
  syncFromInvoice: (invoice: Stripe.Invoice, event: Stripe.Event) => Promise<unknown>;
  cancelFromMetadata: (metadata: Stripe.Metadata | null | undefined, reason: string) => Promise<void>;
};

export function processVerifiedStripeEvent(
  event: Stripe.Event,
  deps: StripeWebhookDeps,
): Promise<{ status: number; body: Record<string, unknown> }>;
