export const DEFAULT_ACCOUNT_TIMEZONE: string;
export function isValidIanaTimeZone(timeZone: unknown): boolean;
export function safeTimeZone(timeZone: unknown): string;
export function localDateForInstant(instant: Date | string | number, timeZone?: string): string;
export function utcInstantForLocalParts(
  year: number,
  month: number,
  day: number,
  hour?: number,
  minute?: number,
  second?: number,
  timeZone?: string,
): Date;
export function parseLocalDate(localDate: string): { year: number; month: number; day: number } | null;
export function localDayUtcBounds(localDate: string, timeZone?: string): { start: Date; end: Date } | null;
export function localDateOverlapsPaidPeriod(
  localDate: string,
  timeZone: string,
  periodStart: Date | string | number,
  periodEnd: Date | string | number,
): boolean;
export function instantInPaidWindow(
  instant: Date | string | number,
  periodStart: Date | string | number,
  periodEnd: Date | string | number,
): boolean;
export function localDatesOverlappingPeriod(
  periodStart: Date | string | number,
  periodEnd: Date | string | number,
  timeZone?: string,
): string[];
