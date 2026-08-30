import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ManagementOverview } from "@/components/dashboard/management-overview";
import { ManagementPage } from "@/components/dashboard/management-page";
import { ADMIN_PORTAL_NAV } from "@/components/dashboard/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { managementHomeVisualFixture, managementVisualReviewNow } from "@/lib/management-visual-fixture.mjs";

export const metadata: Metadata = { title: "Management visual review" };
export const dynamic = "force-dynamic";

/**
 * Isolated composition review. 404 unless MANAGEMENT_VISUAL_REVIEW=1.
 * Does not write to the database. Not linked from Management navigation.
 */
export default async function ManagementVisualReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ empty?: string }>;
}) {
  if (process.env.MANAGEMENT_VISUAL_REVIEW !== "1") notFound();
  await requireRole("admin", "/dashboard/admin");
  const params = await searchParams;
  const reviewNow = managementVisualReviewNow(new Date("2026-08-26T23:05:00Z"), "America/Chicago", 18, 5);
  const fixture = managementHomeVisualFixture(reviewNow, { empty: params.empty === "1" });

  return (
    <ManagementPage navItems={ADMIN_PORTAL_NAV} compose>
      <p className="sr-only">Visual review fixture. Not Management production data.</p>
      <p className="mb-3 text-[11px] font-medium tracking-[0.1em] text-[#8a8174] uppercase">
        Visual review fixture · not production data
      </p>
      <ManagementOverview
        bookings={fixture.bookings as never}
        presenceByBooking={fixture.presenceByBooking as never}
        attentionItems={fixture.attentionItems as never}
        guidesActive={fixture.guidesActive}
        outstandingTotals={fixture.outstandingTotals}
        guides={fixture.guides as never}
        reports={fixture.reports as never}
        payments={fixture.payments as never}
        nowMs={fixture.nowMs}
        timeZone={fixture.timeZone}
      />
    </ManagementPage>
  );
}
