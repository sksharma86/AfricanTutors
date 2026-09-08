export function reminderStillTimely(
  booking: { scheduled_start?: string | null } | null | undefined,
  nowMs?: number,
): boolean;

export function decideRetryAction(input?: {
  delivery?: Record<string, unknown> | null;
  booking?: Record<string, unknown> | null;
  membership?: Record<string, unknown> | null;
  profileExists?: boolean;
  reportExists?: boolean | null;
  packageMinutes?: number | null;
  attendanceAwaiting?: boolean | null;
  coverageOfferOpen?: boolean | null;
  nowMs?: number;
}): { ok: true } | { ok: false, reason: string };
