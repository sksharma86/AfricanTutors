export const HALF_HOUR_STEP_MINUTES: 30;
export const HALF_HOUR_START_ERROR: string;
export function halfHourClockOptions(): string[];
export function parseClock(value: string | null | undefined): { hour: number; minute: number; second: number } | null;
export function isHalfHourClock(value: string | null | undefined): boolean;
export function ceilHalfHourClock(value: string | null | undefined): string | null;
export function floorHalfHourClock(value: string | null | undefined): string | null;
export function halfHourStartsInsideWindow(
  startClock: string,
  endClock: string,
  durationMinutes: number,
  stepMinutes?: number,
): string[];
export function localPartsInTz(
  iso: string,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number };
export function isHalfHourInstant(iso: string | null | undefined, timeZone: string | null | undefined): boolean;
export function assertHalfHourStart(iso: string | null | undefined, timeZones: Array<string | null | undefined>): void;
