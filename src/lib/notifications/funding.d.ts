declare module "@/lib/notifications/funding.mjs" {
  export const NOTIFICATION_FUNDING_SOURCES: readonly string[];
  export function resolveNotificationFunding(input?: {
    isFreeTrial?: boolean | null;
    fundingSource?: string | null;
    stripePaidCents?: number | null;
    creditAppliedCents?: number | null;
    hasPaymentRow?: boolean;
  }): string | null;
  export function isPrepaidFunding(funding: string | null | undefined): boolean;
  export function bookingFundingLine(funding: string | null | undefined): string | null;
}
