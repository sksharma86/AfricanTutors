export function tutorSessionAction(status: string, hasSchedule: boolean): "join" | "awaiting" | "closed" | "none";
export function guideJoinUiState(
  status: string,
  startISO: string | null | undefined,
  endISO: string | null | undefined,
  nowMs?: number,
): { kind: "join" | "opens_at" | "ended" | "awaiting" | "closed" | "none"; openAtISO?: string | null };
export function tutorTimezone(stored: string | null | undefined): string;
