import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagementStudyHalls } from "@/components/dashboard/management-study-halls";
import { ADMIN_PORTAL_NAV, DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { loadManagementWorkspace } from "@/lib/management-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Study Halls · Management" };
export const dynamic = "force-dynamic";

export default async function AdminStudyHallsPage() {
  await requireRole("admin", "/dashboard/admin/study-halls");
  const supabase = await createSupabaseServerClient();
  const data = await loadManagementWorkspace(supabase!);

  return (
    <DashboardShell
      role="admin"
      title="Study Halls"
      description="What you need to care about — today, next, and anything that needs a decision."
      navItems={ADMIN_PORTAL_NAV}
    >
      <Suspense fallback={<p className="text-sm text-ink-500">Loading Study Halls…</p>}>
        <ManagementStudyHalls
          bookings={data.bookings as never}
          presenceByBooking={data.presenceByBooking}
        />
      </Suspense>
    </DashboardShell>
  );
}
