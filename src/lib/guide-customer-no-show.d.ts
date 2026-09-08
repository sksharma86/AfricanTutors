declare module "@/lib/guide-customer-no-show.mjs" {
  export const CUSTOMER_NO_SHOW_WAIT_MIN: number;
  export const CALL_PARENT_PROMPT_MIN: number;
  export function customerNoShowEligibleAt(startISO: string | null | undefined): string | null;
  export function customerNoShowUiState(input?: {
    status?: string | null;
    scheduledStart?: string | null;
    studentJoinedAt?: string | null;
    paymentStatus?: string | null;
    nowMs?: number;
  }): {
    kind:
      | "recorded"
      | "awaiting_payment"
      | "cancelled"
      | "completed"
      | "ineligible"
      | "child_joined"
      | "not_started"
      | "waiting"
      | "eligible";
    remainingMin: number;
    eligibleAtISO: string | null;
    callParentPrompt: boolean;
  };
  export function customerNoShowGuideCopy(kind: string): string | null;
}
