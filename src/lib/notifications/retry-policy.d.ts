export const EMAIL_RETRY_MAX_ATTEMPTS: 5;
export const EMAIL_STALE_PENDING_MINUTES: 15;
export const EMAIL_RETRY_CRON_PATH: "/api/cron/notification-retry";
export const EMAIL_RETRY_BACKOFF_MINUTES: Readonly<Record<number, number>>;
export const RETRY_CLASS: Readonly<{
  HISTORICAL: "historical";
  CURRENT_STATE: "current_state";
  NON_EMAIL: "non_email";
  UNSUPPORTED: "unsupported";
}>;
export const CURRENT_STATE_RETRY_TYPES: readonly string[];
export const HISTORICAL_RETRY_TYPES: readonly string[];

export function retryClassForType(
  notificationType: unknown,
): "historical" | "current_state" | "non_email" | "unsupported";
export function isEmailRecipient(toEmail: unknown): boolean;
export function isPermanentFailure(error: unknown): boolean;
export function backoffMinutesForAttempt(attempts: unknown): number;
export function nextRetryAt(attempts: number, nowMs?: number): string;
export function isStalePending(row: { status?: string | null; updated_at?: string | null; created_at?: string | null } | null | undefined, nowMs?: number): boolean;
export function isRetryEligible(row: Record<string, unknown> | null | undefined, nowMs?: number): boolean;
export function deliveryOpsLabel(row: Record<string, unknown> | null | undefined): string;
export function leasedRetryRows(data: unknown): object[];
export function parseDeliveryIdentity(row: {
  notification_type?: string | null;
  idempotency_key?: string | null;
  booking_id?: string | null;
  recipient_account_id?: string | null;
}): {
  type: string;
  key: string;
  bookingId: string | null;
  accountId: string | null;
  tutorId: string | null;
  invoiceId: string | null;
  stripeSubscriptionId: string | null;
  reportId: string | null;
  searchKey: string | null;
  keyKind: string | null;
};
