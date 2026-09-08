declare module "@/lib/parent-week.mjs" {
  import type { ParentBooking } from "@/lib/parent-portal-types";

  export const PARENT_BOOK_HREF: "/dashboard/student/book";
  export const PARENT_HOURS_HREF: "/dashboard/student/packages";

  export type ParentMembership = {
    entitled: boolean;
    cancelAtPeriodEnd: boolean;
    periodEnd: string | null;
    customerStatus: string;
  } | null;

  export function parseParentMembership(payload: unknown): ParentMembership;

  export function bookingsOnLocalDate(
    bookings: ParentBooking[] | null | undefined,
    localDate: string,
    timeZone?: string,
  ): ParentBooking[];

  export type ParentWeekDayKind = "today" | "completed" | "scheduled" | "payment_needed" | "none";

  export function parentWeekDayKind(
    bookingsOnDay: Array<{
      status?: string;
      payment_status?: string;
      scheduled_start?: string | null;
      scheduled_end?: string | null;
    }> | null | undefined,
    opts?: { isToday?: boolean; nowMs?: number },
  ): ParentWeekDayKind;

  export function parentWeekDayLabel(kind: ParentWeekDayKind, opts?: { compact?: boolean }): string;

  export type ParentWeekStripDay = {
    localDate: string;
    weekdayLong: string;
    weekdayShort: string;
    monthDay: string;
    isPast: boolean;
    isToday: boolean;
    kind: ParentWeekDayKind;
    label: string;
    compactLabel: string;
    bookingCount: number;
  };

  export function parentWeekStrip(
    bookings: ParentBooking[] | null | undefined,
    timeZone: string,
    nowMs?: number,
  ): ParentWeekStripDay[];

  export function parentWeekCompletion(
    bookings: ParentBooking[] | null | undefined,
    timeZone: string,
    nowMs?: number,
  ): { completed: number; scheduled: number; monday: string; sunday: string; weekLabel: string; empty: boolean };

  export function parentWeekCompletionCopy(completion: {
    completed?: number;
    scheduled?: number;
  }): { headline: string; body: string };

  export function formatMembershipPeriodEnd(iso: string | null | undefined, timeZone?: string): string;

  export function parentMembershipPresentation(
    membership: ParentMembership,
    timeZone?: string,
  ): { title: string; status: string; detail: string } | null;

  export type ParentHomeCtas = {
    primary: { href: string; label: string };
    secondary: { href: string; label: string };
    showBuyHours: boolean;
    showFreeTrial: boolean;
    fundingKind: "membership" | "free_trial" | "prepaid";
  };

  export function parentHomeCtas(input?: { entitled365?: boolean; freeTrialAvailable?: boolean }): ParentHomeCtas;

  export function parentHomeFundingCopy(input?: {
    entitled365?: boolean;
    minutes?: number;
    creditCents?: number;
    freeTrialAvailable?: boolean;
  }): {
    kind: string;
    line: string | null;
    showZeroPrepaid: boolean;
    showBuyHours: boolean;
    creditCents?: number;
  };
}
