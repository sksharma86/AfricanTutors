/**
 * Timezone helpers. Authoritative appointment times are always stored in UTC
 * (timestamptz) in the database; these helpers format those instants into each
 * user's local IANA timezone for display. We never treat an ambiguous local
 * timestamp as the source of truth.
 */

/** A curated list of IANA timezones offered in selects (US + Africa focus). */
export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Arizona (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
  { value: "Africa/Lagos", label: "West Africa (Lagos)" },
  { value: "Africa/Accra", label: "Ghana (Accra)" },
  { value: "Africa/Nairobi", label: "East Africa (Nairobi)" },
  { value: "Africa/Johannesburg", label: "South Africa (Johannesburg)" },
  { value: "Africa/Cairo", label: "Egypt (Cairo)" },
  { value: "Europe/London", label: "UK (London)" },
  { value: "UTC", label: "UTC" },
];

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The viewer's own IANA timezone (client-side). */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";
  } catch {
    return "America/Chicago";
  }
}

/** Format a UTC ISO instant in a given timezone. */
export function formatInTz(
  iso: string,
  tz: string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(new Date(iso));
}

/** Short timezone label, e.g. "CST" / "WAT", for the given instant + zone. */
export function tzAbbreviation(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "short",
  }).formatToParts(new Date(iso));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
}

/** e.g. "Mon, Aug 24" in the given timezone (for grouping slots by day). */
export function formatDayHeading(iso: string, tz: string): string {
  return formatInTz(iso, tz, { weekday: "short", month: "short", day: "numeric" });
}

/** e.g. "5:30 PM" in the given timezone. */
export function formatTime(iso: string, tz: string): string {
  return formatInTz(iso, tz, { hour: "numeric", minute: "2-digit" });
}

/**
 * Convert a wall-clock date + time (as entered by a user in timezone `tz`) into
 * the corresponding UTC ISO instant. Uses the zone's offset at that instant, so
 * it stays correct across DST.
 */
export function wallTimeToUtcIso(dateStr: string, timeStr: string, tz: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcGuess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0;
  const shown = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  const offset = shown - utcGuess;
  return new Date(utcGuess - offset).toISOString();
}
