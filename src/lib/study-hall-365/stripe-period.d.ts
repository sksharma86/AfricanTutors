export function stripeId(value: unknown): string | null;
export function fromUnixSeconds(seconds: number | null | undefined): Date | null;
export function subscriptionPaidPeriod(subscription: object | null | undefined): {
  start: Date;
  end: Date;
  priceId: string | null;
} | null;
export function invoiceSubscriptionId(invoice: object | null | undefined): string | null;
