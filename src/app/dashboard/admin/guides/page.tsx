import type { Metadata } from "next";
import { Suspense } from "react";

import {
  AdminGuidesDirectory,
  type AdminGuideDirectoryRow,
} from "@/components/dashboard/admin-guides-directory";
import { ADMIN_PORTAL_NAV, DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { guideWorkforceLabel } from "@/lib/guide-workforce.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    label: guideWorkforceLabel(g.status, g.approved_at) as AdminGuideDirectoryRow["label"],
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
      <Suspense fallback={<p className="text-sm text-ink-500">Loading Guides…</p>}>
        <AdminGuidesDirectory
          pending={grouped.pending}
          active={grouped.active}
          suspended={grouped.suspended}
          rejected={grouped.rejected}
        />
      </Suspense>
    </DashboardShell>
  );
}
