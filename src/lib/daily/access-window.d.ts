export const ADMIN_SUPPORT_SECONDS: number;
export function computeSessionAccessWindow(
  info: { role?: string; joinOpenAt?: string | null; joinCloseAt?: string | null },
  nowMs?: number,
): { roomNbf: number; roomExp: number; tokenExp: number };
