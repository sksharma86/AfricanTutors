/**
 * Timezone-safe civil-date helpers for Study Hall 365.
 *
 * Authoritative 365 "one per calendar day" resolver:
 *   1. SQL `public.resolve_account_timezone(account_id)`
 *      — profiles.timezone, else the household's first student timezone,
 *      else America/Chicago. Never the Guide timezone. Never the server TZ.
 *   2. Local civil date = `(booking_start AT TIME ZONE account_tz)::date`
 *      inside book_session / consume_study_hall_365_day.
 *   3. These JS helpers (`localDateForInstant`, `utcInstantForLocalParts`)
 *      mirror that civil-date math for UI, Plan My Week, and tests.
 *
 * Entitlement days are the household's local calendar dates, never UTC
 * truncation and never a Guide's IANA zone.
 *
 * Fallback IANA zone when none is stored: America/Chicago.
 * That is a documented default, not a hardcoded product assumption —
 * callers should pass the resolved household zone.
 */

export const DEFAULT_ACCOUNT_TIMEZONE = "America/Chicago";

/**
 * @param {unknown} timeZone
 * @returns {boolean}
 */
export function isValidIanaTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timeZone.trim() }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} timeZone
 * @returns {string}
 */
export function safeTimeZone(timeZone) {
  return isValidIanaTimeZone(timeZone) ? String(timeZone).trim() : DEFAULT_ACCOUNT_TIMEZONE;
}

/**
 * Civil date (YYYY-MM-DD) of an instant in an IANA zone.
 * @param {Date|string|number} instant
 * @param {string} [timeZone]
 * @returns {string}
 */
export function localDateForInstant(instant, timeZone = DEFAULT_ACCOUNT_TIMEZONE) {
  const date = instant instanceof Date ? instant : new Date(instant);
  const tz = safeTimeZone(timeZone);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date);
}

/**
 * @param {Date} instant
 * @param {string} timeZone
 */
function tzParts(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * UTC instant for a local civil date-time in an IANA zone.
 * Iterates to converge on the zone offset (DST-safe).
 *
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} day
 * @param {number} [hour]
 * @param {number} [minute]
 * @param {number} [second]
 * @param {string} [timeZone]
 * @returns {Date}
 */
export function utcInstantForLocalParts(
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
  timeZone = DEFAULT_ACCOUNT_TIMEZONE,
) {
  const tz = safeTimeZone(timeZone);
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = desired;
  for (let i = 0; i < 4; i += 1) {
    const shown = tzParts(new Date(utc), tz);
    const asUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    utc += desired - asUtc;
  }
  return new Date(utc);
}

/**
 * @param {string} localDate YYYY-MM-DD
 * @returns {{ year: number, month: number, day: number } | null}
 */
export function parseLocalDate(localDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(localDate ?? ""));
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Half-open UTC bounds [start, end) of a local civil date.
 * @param {string} localDate
 * @param {string} [timeZone]
 * @returns {{ start: Date, end: Date } | null}
 */
export function localDayUtcBounds(localDate, timeZone = DEFAULT_ACCOUNT_TIMEZONE) {
  const parts = parseLocalDate(localDate);
  if (!parts) return null;
  const start = utcInstantForLocalParts(parts.year, parts.month, parts.day, 0, 0, 0, timeZone);
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + 36 * 3600 * 1000);
  const nextCivil = localDateForInstant(next, timeZone);
  const nextParts = parseLocalDate(nextCivil);
  if (!nextParts) return null;
  // Walk forward one civil day from start (handles 23h/25h DST days).
  let probe = new Date(start.getTime() + 20 * 3600 * 1000);
  while (localDateForInstant(probe, timeZone) === localDate) {
    probe = new Date(probe.getTime() + 60 * 60 * 1000);
  }
  // Snap to the first instant of the next civil date.
  const end = utcInstantForLocalParts(nextParts.year, nextParts.month, nextParts.day, 0, 0, 0, timeZone);
  return { start, end };
}

/**
 * Paid window is [periodStart, periodEnd). A local date is covered when that
 * civil day overlaps the paid window. A booking start must itself fall inside
 * the paid window (PR3 wires scheduled_start to this check).
 *
 * @param {string} localDate
 * @param {string} timeZone
 * @param {Date|string|number} periodStart
 * @param {Date|string|number} periodEnd
 */
export function localDateOverlapsPaidPeriod(localDate, timeZone, periodStart, periodEnd) {
  const bounds = localDayUtcBounds(localDate, timeZone);
  if (!bounds) return false;
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
  return bounds.start.getTime() < end && bounds.end.getTime() > start;
}

/**
 * @param {Date|string|number} instant
 * @param {Date|string|number} periodStart
 * @param {Date|string|number} periodEnd
 */
export function instantInPaidWindow(instant, periodStart, periodEnd) {
  const t = new Date(instant).getTime();
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  if (![t, start, end].every(Number.isFinite) || end <= start) return false;
  return t >= start && t < end;
}

/**
 * Inclusive list of local YYYY-MM-DD dates whose civil day overlaps [start, end).
 * Used in tests for month-length / rolling-period assertions — never to mint credits.
 *
 * @param {Date|string|number} periodStart
 * @param {Date|string|number} periodEnd
 * @param {string} [timeZone]
 * @returns {string[]}
 */
export function localDatesOverlappingPeriod(periodStart, periodEnd, timeZone = DEFAULT_ACCOUNT_TIMEZONE) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (!(start < end)) return [];
  const tz = safeTimeZone(timeZone);
  const dates = [];
  // Start from the civil date of periodStart and walk until day start >= periodEnd.
  let cursor = localDateForInstant(start, tz);
  for (let i = 0; i < 400; i += 1) {
    if (!localDateOverlapsPaidPeriod(cursor, tz, start, end)) {
      const bounds = localDayUtcBounds(cursor, tz);
      if (bounds && bounds.start.getTime() >= end.getTime()) break;
      const parts = parseLocalDate(cursor);
      if (!parts) break;
      const next = utcInstantForLocalParts(parts.year, parts.month, parts.day, 12, 0, 0, tz);
      cursor = localDateForInstant(new Date(next.getTime() + 24 * 3600 * 1000), tz);
      continue;
    }
    dates.push(cursor);
    const parts = parseLocalDate(cursor);
    if (!parts) break;
    const noon = utcInstantForLocalParts(parts.year, parts.month, parts.day, 12, 0, 0, tz);
    cursor = localDateForInstant(new Date(noon.getTime() + 24 * 3600 * 1000), tz);
  }
  return dates;
}
