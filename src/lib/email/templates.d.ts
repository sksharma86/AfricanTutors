export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
export function formatMoney(cents: number | null | undefined): string;
export function formatWhen(iso: string | null | undefined, tz: string | null | undefined): string;
export function sessionUrl(appUrl: string | null | undefined, bookingId: string): string;

export function welcome(ctx: { name?: string | null; appUrl?: string | null }): RenderedEmail;
export function bookingConfirmed(ctx: {
  isFreeTrial?: boolean;
  subject?: string | null;
  whenISO?: string | null;
  tz?: string | null;
  durationMinutes?: number | null;
  tutorName?: string | null;
  studentName?: string | null;
  funding?: string | null;
  appUrl?: string | null;
  bookingId: string;
}): RenderedEmail;
export function packagePurchased(ctx: {
  minutes: number;
  amountCents: number;
  balanceMinutes?: number | null;
  packageName?: string | null;
  appUrl?: string | null;
}): RenderedEmail;
export function reminder(ctx: {
  role: "customer" | "tutor";
  kind: "24h" | "1h";
  subject?: string | null;
  whenISO?: string | null;
  tz?: string | null;
  durationMinutes?: number | null;
  tutorName?: string | null;
  studentName?: string | null;
  appUrl?: string | null;
  bookingId: string;
}): RenderedEmail;
export function cancellation(ctx: { early: boolean; restoredMinutes?: number | null; restoredCreditCents?: number | null }): RenderedEmail;
export function tutorReassignment(ctx: {
  reassigned: boolean;
  compCreditCents?: number | null;
  subject?: string | null;
  bookingId: string;
  appUrl?: string | null;
}): RenderedEmail;
export function refundIssued(ctx: { amountCents: number; reason?: string | null }): RenderedEmail;
export function disputeReceived(ctx: { subject?: string | null }): RenderedEmail;
export function sessionReportReady(ctx: {
  studentName?: string | null;
  whenISO?: string | null;
  tz?: string | null;
  appUrl?: string | null;
}): RenderedEmail;
export function disputeResolved(ctx: {
  resolution: string;
  creditCents?: number | null;
  restoredMinutes?: number | null;
  refundCents?: number | null;
}): RenderedEmail;
export function tutorApproved(ctx: { name?: string | null; appUrl?: string | null }): RenderedEmail;
export function tutorNewSession(ctx: {
  subject?: string | null;
  whenISO?: string | null;
  tz?: string | null;
  durationMinutes?: number | null;
  studentName?: string | null;
  appUrl?: string | null;
  bookingId: string;
}): RenderedEmail;
export function tutorCancelled(ctx: {
  early: boolean;
  subject?: string | null;
  whenISO?: string | null;
  tz?: string | null;
}): RenderedEmail;
export function tutorRemoved(ctx: { subject?: string | null; whenISO?: string | null; tz?: string | null }): RenderedEmail;
export function adminAlert(ctx: { title?: string; summary?: string; lines?: string[] }): RenderedEmail;
export function guideReportRequired(ctx: {
  studentName?: string | null;
  whenISO?: string | null;
  tz?: string | null;
  appUrl?: string | null;
}): RenderedEmail;
export function guideReportOverdue(ctx: {
  studentName?: string | null;
  whenISO?: string | null;
  tz?: string | null;
  appUrl?: string | null;
}): RenderedEmail;
