import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagementIncidentHistory } from "@/components/dashboard/management-incident-history";
import { ManagementPage } from "@/components/dashboard/management-page";
import { ADMIN_PORTAL_NAV } from "@/components/dashboard/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { loadManagementIncidents } from "@/lib/management-incidents-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Incident History · Management" };
export const dynamic = "force-dynamic";

export default async function AdminIncidentHistoryPage() {
  await requireRole("admin", "/dashboard/admin/incidents");
  const supabase = await createSupabaseServerClient();
  const data = await loadManagementIncidents(supabase!);

  return (
    <ManagementPage navItems={ADMIN_PORTAL_NAV} wide>
      <h1 className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--mg-ink)]">
        Incident History
      </h1>
      <p className="mt-1 text-sm text-[var(--mg-muted)]">
        What went wrong, what the system did, and how it ended.
      </p>
      <div className="mt-4">
        <Suspense fallback={<p className="text-sm text-ink-500">Loading incidents…</p>}>
          <ManagementIncidentHistory incidents={data.incidents} />
        </Suspense>
      </div>
    </ManagementPage>
  );
}
