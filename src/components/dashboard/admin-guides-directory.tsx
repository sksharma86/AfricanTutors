"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { GuideWorkforceActions } from "@/components/dashboard/guide-workforce-actions";
import { Button } from "@/components/ui/button";
import { PortalSegmentedControl } from "@/components/ui/portal-segmented-control";
import { formatCompensationHourly } from "@/lib/compensation-currency.mjs";

import { approveTutorAction } from "@/app/dashboard/admin/actions";

const GROUPS = ["pending", "active", "suspended", "rejected"] as const;

const VIEWS = [
  { id: "pending", label: "Pending" },
  { id: "active", label: "Active" },
  { id: "suspended", label: "Suspended" },
  { id: "rejected", label: "Rejected" },
] as const;

const HEADING: Record<(typeof GROUPS)[number], string> = {
  pending: "Pending applicants",
  active: "Active Guides",
  suspended: "Suspended Guides",
  rejected: "Rejected applicants",
};

export type AdminGuideDirectoryRow = {
  profile_id: string;
  label: "pending" | "active" | "suspended" | "rejected" | "unknown";
  name: string;
  upcoming: number;
  hasWeeklyHours: boolean;
  comp_rate_cents_per_hour: number | null;
  comp_currency: string | null;
};

export function AdminGuidesDirectory({
  pending,
  active,
  suspended,
  rejected,
}: {
  pending: AdminGuideDirectoryRow[];
  active: AdminGuideDirectoryRow[];
  suspended: AdminGuideDirectoryRow[];
  rejected: AdminGuideDirectoryRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const grouped = useMemo(
    () => ({ pending, active, suspended, rejected }),
    [pending, active, suspended, rejected],
  );

  const requested = params.get("view");
  const fallback = GROUPS.find((key) => grouped[key].length > 0) ?? "pending";
  const view = GROUPS.some((key) => key === requested) ? (requested as (typeof GROUPS)[number]) : fallback;
  const rows = grouped[view];

  function setView(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (next === fallback) sp.delete("view");
    else sp.set("view", next);
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`);
  }

  return (
    <div className="space-y-6">
      <PortalSegmentedControl
        ariaLabel="Guide workforce views"
        items={VIEWS}
        value={view}
        onChange={setView}
      />

      <p className="flex flex-wrap gap-4 text-sm text-ink-500">
        <span>{pending.length} pending</span>
        <span>{active.length} active</span>
        <span>{suspended.length} suspended</span>
        <span>{rejected.length} rejected</span>
      </p>

      <section>
        <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">{HEADING[view]}</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-400">None.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {rows.map((g) => (
              <li key={g.profile_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/admin/tutors/${g.profile_id}`}
                    className="text-sm font-medium text-ink-900 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
                  >
                    {g.name}
                  </Link>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {typeof g.comp_rate_cents_per_hour === "number"
                      ? formatCompensationHourly(g.comp_rate_cents_per_hour, g.comp_currency ?? "USD")
                      : "Rate not set"}
                    {g.hasWeeklyHours ? " · Weekly hours set" : " · No weekly hours"}
                    {g.upcoming > 0 ? ` · ${g.upcoming} upcoming` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {view === "pending" ? (
                    <form action={approveTutorAction}>
                      <input type="hidden" name="profileId" value={g.profile_id} />
                      <Button type="submit" size="sm">
                        Approve as Guide
                      </Button>
                    </form>
                  ) : null}
                  <GuideWorkforceActions
                    profileId={g.profile_id}
                    label={g.label}
                    compact
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
