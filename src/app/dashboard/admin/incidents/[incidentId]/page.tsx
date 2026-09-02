import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ManagementIncidentDetail, ManagementIncidentNotFound } from "@/components/dashboard/management-incident-detail";
import { ManagementPage } from "@/components/dashboard/management-page";
import { ADMIN_PORTAL_NAV } from "@/components/dashboard/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { loadManagementIncident } from "@/lib/management-incidents-data";
import { parseIncidentId } from "@/lib/management-incidents.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Incident · Management" };
export const dynamic = "force-dynamic";

export default async function AdminIncidentDetailPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  await requireRole("admin", `/dashboard/admin/incidents/${incidentId}`);
  if (!parseIncidentId(incidentId)) notFound();
  const supabase = await createSupabaseServerClient();
  const incident = await loadManagementIncident(supabase!, incidentId);
  const timeZone = "America/Chicago";

  return (
    <ManagementPage navItems={ADMIN_PORTAL_NAV} wide>
      {incident ? <ManagementIncidentDetail incident={incident} timeZone={timeZone} /> : <ManagementIncidentNotFound />}
    </ManagementPage>
  );
}
