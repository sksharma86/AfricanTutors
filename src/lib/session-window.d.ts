export const JOIN_OPEN_LEAD_MIN: number;
export const JOIN_CLOSE_GRACE_MIN: number;
export function customerJoinState(
  status: string,
  startISO: string | null,
  endISO: string | null,
  nowMs: number,
): { state: "join" | "opens_at" | "ended" | "not_scheduled" | "not_joinable"; openAtISO: string | null };
