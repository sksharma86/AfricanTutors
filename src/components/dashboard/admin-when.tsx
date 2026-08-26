"use client";

import { useMemo } from "react";

import { browserTimezone, formatAdminSessionWhen } from "@/lib/timezone";

/**
 * Admin operational timestamp: primary = browser/admin TZ, optional secondary = family TZ.
 * Client-only so we can use the logged-in manager's browser IANA zone without a migration.
 */
export function AdminWhen({
  iso,
  familyTz,
  className,
}: {
  iso: string | null | undefined;
  familyTz?: string | null;
  className?: string;
}) {
  const adminTz = useMemo(() => browserTimezone(), []);
  if (!iso) return <span className={className}>—</span>;
  const { primary, secondary } = formatAdminSessionWhen(iso, adminTz, familyTz);
  return (
    <span className={className}>
      <span className="block text-ink-700">{primary}</span>
      {secondary ? <span className="block text-xs text-ink-400">{secondary}</span> : null}
    </span>
  );
}
