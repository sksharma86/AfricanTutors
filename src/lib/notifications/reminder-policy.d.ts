export const REMINDER_1H_WINDOW_MIN: Readonly<{ from: number; to: number }>;
export function shouldSendReminder(role: "customer" | "tutor", kind: "24h" | "1h"): boolean;
export function reminder1hWindow(nowMs?: number): { fromISO: string; toISO: string };
export const REMINDER_EXCLUDED_STATUSES: readonly string[];
export function reminderEmailIdempotencyKey(input: {
  kind: "24h" | "1h";
  bookingId: string;
  role: "customer" | "tutor";
  tutorId?: string | null;
}): string | null;
export function reminderStillValid(
  booking:
    | {
        status?: string | null;
        payment_status?: string | null;
        scheduled_start?: string | null;
        tutor_id?: string | null;
      }
    | null
    | undefined,
  opts: { role: "customer" | "tutor"; tutorId?: string | null },
): boolean;
