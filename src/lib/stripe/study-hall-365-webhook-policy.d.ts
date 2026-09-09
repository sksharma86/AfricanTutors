export function isStaleStripeEvent(
  incomingCreated: number | null | undefined,
  lastCreated: number | null | undefined,
): boolean;

export function correlatedStudyHall365PaymentId(ids: {
  subscriptionPaymentId?: string | null;
  explicitPaymentId?: string | null;
}): string | null;

export function paymentMatchesStudyHall365Checkout(
  payment: {
    id?: string;
    purpose?: string;
    account_id?: string | null;
    stripe_customer_id?: string | null;
    stripe_checkout_session_id?: string | null;
  } | null | undefined,
  ctx: {
    accountId?: string | null;
    customerId?: string | null;
    paymentId: string;
    checkoutSessionId?: string | null;
  },
): boolean;

export function shouldFulfillStudyHall365CheckoutPayment(input: {
  applyStatus?: string | null;
  subscriptionStatus?: string | null;
  payment?: object | null;
  accountId?: string | null;
  customerId?: string | null;
  paymentId?: string | null;
  checkoutSessionId?: string | null;
}): boolean;

export function applyStudyHall365MembershipSnapshot(
  row: Record<string, unknown> | null,
  incoming: {
    eventId: string;
    eventCreated: number;
    status: string;
    cancelAtPeriodEnd?: boolean;
    ended?: boolean;
    accountId: string;
    customerId: string;
    subscriptionId: string;
    paymentId?: string | null;
  },
): { status: string; row: Record<string, unknown>; previous: unknown; current: unknown };

export function reconcileStudyHall365WebhookSnapshot(input: {
  membership: Record<string, unknown> | null;
  event: { id: string; created: number; type?: string };
  retrievedSubscription: {
    id: string;
    status: string;
    customer: string;
    cancel_at_period_end?: boolean;
    metadata?: { payment_id?: string; account_id?: string };
  };
  payment?: object | null;
  explicitPaymentId?: string | null;
  ended?: boolean;
}): { apply: { status: string; row: Record<string, unknown> }; fulfill: boolean; paymentId: string | null };
