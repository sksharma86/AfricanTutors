import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagementStudyHalls } from "@/components/dashboard/management-study-halls";
import { ManagementPage } from "@/components/dashboard/management-page";
import { ADMIN_PORTAL_NAV } from "@/components/dashboard/dashboard-shell";
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
    <ManagementPage navItems={ADMIN_PORTAL_NAV} wide>
      <h1 className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">Study Halls</h1>
      <div className="mt-4">
        <Suspense fallback={<p className="text-sm text-ink-500">Loading Study Halls…</p>}>
          <ManagementStudyHalls
            bookings={data.bookings as never}
            presenceByBooking={data.presenceByBooking}
          />
        </Suspense>
      </div>
    </ManagementPage>
  );
}
