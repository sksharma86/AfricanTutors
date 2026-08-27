import type { Metadata } from "next";

import { ManagementOverview } from "@/components/dashboard/management-overview";
import { ADMIN_PORTAL_NAV, DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { aggregateCompensationByCurrency } from "@/lib/compensation-currency.mjs";
import { guideWorkforceLabel } from "@/lib/guide-workforce.mjs";
import { loadManagementWorkspace } from "@/lib/management-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Operations · Study Hall (at home)" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireRole("admin", "/dashboard/admin");
  const supabase = await createSupabaseServerClient();
  const data = await loadManagementWorkspace(supabase!);
  const guidesActive = (data.guides as { status: string; approved_at: string | null }[]).filter(
    (g) => guideWorkforceLabel(g.status, g.approved_at) === "active",
  ).length;
  const outstandingTotals = aggregateCompensationByCurrency(
    data.earnings as { amount_cents: number; status: string; currency?: string | null }[],
  );

  return (
    <DashboardShell
      role="admin"
      title="Overview"
      description="What is happening today, and what needs you."
      navItems={ADMIN_PORTAL_NAV}
    >
      <ManagementOverview
        bookings={data.bookings as never}
        presenceByBooking={data.presenceByBooking}
        attentionItems={data.attentionItems}
        guidesActive={guidesActive}
        outstandingTotals={outstandingTotals}
      />
    </DashboardShell>
  );
}
