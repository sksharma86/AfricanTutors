export const REMINDER_1H_WINDOW_MIN: Readonly<{ from: number; to: number }>;
export function shouldSendReminder(role: "customer" | "tutor", kind: "24h" | "1h"): boolean;
export function reminder1hWindow(nowMs?: number): { fromISO: string; toISO: string };
export const REMINDER_EXCLUDED_STATUSES: readonly string[];
