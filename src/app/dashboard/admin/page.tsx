import type { Metadata } from "next";

import { ManagementOverview } from "@/components/dashboard/management-overview";
import { ManagementPage } from "@/components/dashboard/management-page";
import { ADMIN_PORTAL_NAV } from "@/components/dashboard/dashboard-shell";
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
  const nowMs = new Date().getTime();
  const since = new Date(nowMs - 36 * 60 * 60 * 1000).toISOString();
  const { data: payments } = await supabase!
    .from("payments")
    .select("stripe_paid_cents, status, created_at")
    .gte("created_at", since)
    .limit(200);

  return (
    <ManagementPage navItems={ADMIN_PORTAL_NAV} compose>
      <ManagementOverview
        bookings={data.bookings as never}
        presenceByBooking={data.presenceByBooking}
        attentionItems={data.attentionItems}
        guidesActive={guidesActive}
        outstandingTotals={outstandingTotals}
        guides={data.guides as { status: string; approved_at?: string | null }[]}
        reports={data.reports as { booking_id?: string | null; submitted_at?: string | null }[]}
        payments={(payments ?? []) as { created_at?: string | null; status?: string; stripe_paid_cents?: number }[]}
        nowMs={nowMs}
      />
    </ManagementPage>
  );
}
