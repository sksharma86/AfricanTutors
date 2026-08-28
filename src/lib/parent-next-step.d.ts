declare module "@/lib/parent-next-step.mjs" {
  export const FREE_CONVERT_HEADLINE: string;
  export const FREE_CONVERT_BODY: string;
  export const BOOK_ANOTHER_LABEL: string;
  export const BUY_HOURS_LABEL: string;

  export function parentPostSessionOffer(input?: {
    bookings?: { id?: string; is_free_trial?: boolean; status?: string; scheduled_start?: string | null; scheduled_end?: string | null }[];
    last?: { id?: string; is_free_trial?: boolean; status?: string } | null;
    report?: unknown;
    minutes?: number;
    nowMs?: number;
  }): {
    kind: "free_available" | "free_convert" | "repeat" | "none";
    headline?: string | null;
    body?: string | null;
    bookLabel?: string;
    bookHref?: string;
    showBuyHours?: boolean;
  };

  export function parentRecordingHomeLabel(recording: {
    status?: string | null;
    deleted_at?: string | null;
  } | null | undefined): string | null;
}
