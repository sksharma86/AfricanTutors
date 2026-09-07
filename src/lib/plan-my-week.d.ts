import type { ParentBooking } from "@/lib/parent-portal-types";

export const PLAN_WEEK_DURATION_MINUTES: 60;
export const PLAN_WEEK_MAX_OFFSET: 1;
export const PLAN_WEEK_MAX_SESSIONS: 14;
export const PLAN_MY_WEEK_HREF: "/dashboard/student/plan-week";
export const PLAN_WEEK_NOTICE_MINUTES: 120;

export function addLocalDays(
  localDate: string,
  days: number,
  timeZone?: string,
): string | null;
export function mondayOfLocalDate(localDate: string, timeZone?: string): string | null;

export type PlanWeekDay = {
  localDate: string;
  weekdayLong: string;
  weekdayShort: string;
  monthDay: string;
  isPast: boolean;
  isToday: boolean;
};

export type PlanningWeek = {
  timeZone: string;
  weekOffset: number;
  monday: string;
  sunday: string;
  today: string;
  days: PlanWeekDay[];
  canGoBack: boolean;
  canGoForward: boolean;
  label: string;
};

export function planningWeek(timeZone: string, now?: Date | string | number, weekOffset?: number): PlanningWeek;
export function planningHorizon(
  timeZone: string,
  now?: Date | string | number,
): { from: string; to: string; monday: string };
export function isWithinPlanningHorizon(iso: string, timeZone: string, now?: Date | string | number): boolean;
export function canScheduleStart(
  iso: string,
  timeZone: string,
  nowMs?: number,
  noticeMinutes?: number,
): boolean;
export function slotsForLocalDate(
  slotStarts: string[] | null | undefined,
  localDate: string,
  timeZone: string,
  nowMs?: number,
  noticeMinutes?: number,
): string[];
export function isActiveWeekBooking(booking: { status?: string; scheduled_start?: string | null } | null | undefined): boolean;
export function bookingsInLocalRange<T extends { status?: string; scheduled_start?: string | null }>(
  bookings: T[] | null | undefined,
  fromDate: string,
  toDate: string,
  timeZone: string,
): T[];
export function bookingsByLocalDate<T extends { status?: string; scheduled_start?: string | null }>(
  bookings: T[] | null | undefined,
  timeZone: string,
): Map<string, T[]>;
export function startAlreadyBooked<T extends ParentBooking | { id: string; status?: string; scheduled_start?: string | null }>(
  existing: T[] | null | undefined,
  startISO: string,
): T | null;

export type PlanWeekSessionInput = {
  startISO?: string;
  replaceBookingId?: string | null;
};

export type NormalizedPlanSession = {
  startISO: string;
  localDate: string | null;
  replaceBookingId: string | null;
  status?: string;
  message?: string;
  bookingId?: string;
};

export function normalizePlanWeekRequest(
  input: { duration?: number; sessions?: PlanWeekSessionInput[] } | null | undefined,
  options?: {
    timeZone?: string;
    nowMs?: number;
    noticeMinutes?: number;
    existingBookings?: Array<{ id: string; status?: string; scheduled_start?: string | null }>;
  },
): { ok: boolean; error: string | null; sessions: NormalizedPlanSession[]; skipped?: NormalizedPlanSession[] };

export function planWeekResultMessage(errorMessage: string | null | undefined): string;
export function formatPlanSessionLine(iso: string, timeZone: string): string;
