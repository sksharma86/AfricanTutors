export type StatusTone = "positive" | "neutral" | "warning" | "danger" | "info";
export function customerBookingStatus(status: string, paymentStatus?: string): { label: string; tone: StatusTone };
export function issueStatus(status: string): { label: string; tone: StatusTone };
