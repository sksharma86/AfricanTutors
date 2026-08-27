import type { Metadata } from "next";
import Link from "next/link";

import { GuideWorkforceActions } from "@/components/dashboard/guide-workforce-actions";
import { ADMIN_PORTAL_NAV, DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { formatCompensationHourly } from "@/lib/compensation-currency.mjs";
import { guideWorkforceLabel } from "@/lib/guide-workforce.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { approveTutorAction } from "../actions";

export const metadata: Metadata = { title: "Guides · Management" };
export const dynamic = "force-dynamic";

const GROUPS = ["pending", "active", "suspended", "rejected"] as const;

function countUpcomingByGuide(bookings: { tutor_id: string | null; scheduled_start: string | null }[]) {
  const now = Date.now();
  const upcomingByGuide = new Map<string, number>();
  for (const b of bookings) {
    if (!b.tutor_id || !b.scheduled_start) continue;
    if (new Date(b.scheduled_start).getTime() < now) continue;
    upcomingByGuide.set(b.tutor_id, (upcomingByGuide.get(b.tutor_id) ?? 0) + 1);
  }
  return upcomingByGuide;
}

export default async function AdminGuidesPage() {
  await requireRole("admin", "/dashboard/admin/guides");
  const supabase = await createSupabaseServerClient();

  const [{ data: guideRows }, { data: bookings }, { data: avail }] = await Promise.all([
    supabase!
      .from("tutor_profiles")
      .select(
        "profile_id, status, approved_at, timezone, comp_rate_cents_per_hour, comp_currency, profiles!tutor_profiles_profile_id_fkey(display_name)",
      ),
    supabase!
      .from("bookings")
      .select("id, tutor_id, status, scheduled_start")
      .in("status", ["confirmed", "pending"]),
    supabase!.from("tutor_availability").select("tutor_id"),
  ]);

  const upcomingByGuide = countUpcomingByGuide(
    (bookings ?? []) as { tutor_id: string | null; scheduled_start: string | null }[],
  );
  const weeklyHours = new Set(
    ((avail ?? []) as { tutor_id: string }[]).map((row) => row.tutor_id).filter(Boolean),
  );

  const guides = ((guideRows ?? []) as unknown as {
    profile_id: string;
    status: string;
    approved_at: string | null;
    timezone: string | null;
    comp_rate_cents_per_hour: number | null;
    comp_currency: string | null;
    profiles: { display_name: string | null } | null;
  }[]).map((g) => ({
    ...g,
    label: guideWorkforceLabel(g.status, g.approved_at),
    name: g.profiles?.display_name ?? g.profile_id.slice(0, 8),
    upcoming: upcomingByGuide.get(g.profile_id) ?? 0,
    hasWeeklyHours: weeklyHours.has(g.profile_id),
  }));

  const grouped = Object.fromEntries(GROUPS.map((k) => [k, guides.filter((g) => g.label === k)])) as Record<
    (typeof GROUPS)[number],
    typeof guides
  >;

  return (
    <DashboardShell
      role="admin"
      title="Guides"
      description="Applicants, active Guides, and workforce actions."
      navItems={ADMIN_PORTAL_NAV}
    >
      <div className="mb-8 flex flex-wrap gap-4 text-sm text-ink-500">
        <span>{grouped.pending.length} pending</span>
        <span>{grouped.active.length} active</span>
        <span>{grouped.suspended.length} suspended</span>
        <span>{grouped.rejected.length} rejected</span>
      </div>

      {GROUPS.map((key) => (
        <section key={key} className="mb-10">
          <h2 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">
            {key === "pending"
              ? "Pending applicants"
              : key === "active"
                ? "Active Guides"
                : key === "suspended"
                  ? "Suspended Guides"
                  : "Rejected applicants"}
          </h2>
          {grouped[key].length === 0 ? (
            <p className="mt-3 text-sm text-ink-400">None.</p>
          ) : (
            <ul className="mt-3 divide-y divide-ink-100">
              {grouped[key].map((g) => (
                <li key={g.profile_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/admin/tutors/${g.profile_id}`}
                      className="text-sm font-medium text-ink-900 hover:underline"
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
                    {key === "pending" ? (
                      <form action={approveTutorAction}>
                        <input type="hidden" name="profileId" value={g.profile_id} />
                        <Button type="submit" size="sm">
                          Approve as Guide
                        </Button>
                      </form>
                    ) : null}
                    <GuideWorkforceActions
                      profileId={g.profile_id}
                      label={g.label as "pending" | "active" | "suspended" | "rejected" | "unknown"}
                      compact
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </DashboardShell>
  );
}
