/**
 * Pure timezone formatting helpers (ESM) for unit tests + shared use.
 * Authoritative storage remains UTC timestamptz; these only format for display.
 */

export function isValidTimezone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function formatInTz(iso, tz, opts = { dateStyle: "medium", timeStyle: "short" }) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(new Date(iso));
}

export function tzAbbreviation(iso, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "short",
  }).formatToParts(new Date(iso));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
}

export function formatDayHeading(iso, tz) {
  return formatInTz(iso, tz, { weekday: "short", month: "short", day: "numeric" });
}

export function formatTime(iso, tz) {
  return formatInTz(iso, tz, { hour: "numeric", minute: "2-digit" });
}

/**
 * Admin operational display for a UTC booking instant.
 * Primary = admin/manager TZ; optional secondary = family (student) TZ when different.
 */
export function formatAdminSessionWhen(iso, adminTz, familyTz) {
  const admin = isValidTimezone(adminTz) ? adminTz : "UTC";
  const primary = `${formatDayHeading(iso, admin)} ${formatTime(iso, admin)} (${tzAbbreviation(iso, admin)})`;
  const family = familyTz && isValidTimezone(familyTz) ? familyTz : null;
  if (!family || family === admin) return { primary, secondary: null };
  const secondary = `Parent: ${formatDayHeading(iso, family)} ${formatTime(iso, family)} (${tzAbbreviation(iso, family)})`;
  return { primary, secondary };
}
