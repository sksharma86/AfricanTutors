export function tutorSessionAction(status: string, hasSchedule: boolean): "join" | "awaiting" | "closed" | "none";
export function tutorTimezone(stored: string | null | undefined): string;
