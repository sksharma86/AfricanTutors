declare module "@/lib/notifications/study-hall-365-payment-failure.mjs" {
  export const STUDY_HALL_365_PAYMENT_PROBLEM_STATUSES: readonly string[];
  export function studyHall365PaymentFailureKey(invoiceId: unknown): string | null;
  export function studyHall365PaymentFailureSmsKey(invoiceId: unknown): string | null;
  export function invoiceIndicatesOpenBalance(invoice: object | null | undefined): boolean;
  export function shouldNotifyStudyHall365PaymentFailure(input?: {
    applyStatus?: string | null;
    previous?: object | null;
    current?: object | null;
    invoice?: object | null;
  }): boolean;
}
