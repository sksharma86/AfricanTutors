import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ManagementOverview } from "@/components/dashboard/management-overview";
import { ManagementStudyHalls } from "@/components/dashboard/management-study-halls";
import { ManagementStudyHallActions } from "@/components/dashboard/management-study-hall-actions";
import { ManagementSurface } from "@/components/dashboard/management-surface";
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
  searchParams: Promise<{ empty?: string; scene?: string; view?: string }>;
}) {
  if (process.env.MANAGEMENT_VISUAL_REVIEW !== "1") notFound();
  await requireRole("admin", "/dashboard/admin");
  const params = await searchParams;
  const reviewNow = managementVisualReviewNow(new Date("2026-08-26T23:05:00Z"), "America/Chicago", 18, 5);
  const scene = params.scene === "attention" ? "missed" : params.scene ?? null;
  const fixture = managementHomeVisualFixture(reviewNow, { empty: params.empty === "1", scene });
  const attentionList = params.view === "attention" || params.scene === "attention";

  return (
    <ManagementPage navItems={ADMIN_PORTAL_NAV} compose={!attentionList} wide={attentionList}>
      <p className="sr-only">Visual review fixture. Not Management production data.</p>
      <p className="mb-3 text-[11px] font-medium tracking-[0.1em] text-[#8a8174] uppercase">
        Visual review fixture · not production data
      </p>
      {attentionList ? (
        <Suspense fallback={<p className="text-sm text-ink-500">Loading Study Halls…</p>}>
          <ManagementStudyHalls
            bookings={fixture.bookings as never}
            presenceByBooking={fixture.presenceByBooking as never}
            nowMs={fixture.nowMs}
          />
        </Suspense>
      ) : (
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
      )}
      {scene === "missed" || scene === "replacement" || scene === "resolved" ? (
        <section id="confirm-exception" className="mt-6 max-w-xl">
          <ManagementSurface>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-[#8a8174] uppercase">
              {scene === "resolved" ? "Resolved" : "Guide confirmation missed"}
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--mg-ink)]">
              {scene === "replacement"
                ? "Replacement Guide awaiting confirmation"
                : scene === "resolved"
                  ? "Coverage restored"
                  : "Guide confirmation missed"}
            </p>
            <p className="mt-1 text-sm text-[var(--mg-muted)]">Today · 6:30 PM · Jordan · 60 min</p>
            <p className="mt-1 text-sm text-[var(--mg-muted)]">
              {scene === "replacement"
                ? "Assigned Guide: Grace K. Confirmation requested."
                : scene === "resolved"
                  ? "Assigned Guide: Grace K. Attendance confirmed."
                  : "Assigned Guide: Sarah M. Confirmation deadline missed."}
            </p>
            {scene !== "resolved" ? (
              <div className="mt-4">
                <ManagementStudyHallActions bookingId="visual-review-only" canAct needsGuide={false} coverageCancel />
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--mg-muted)]">No further action required.</p>
            )}
          </ManagementSurface>
        </section>
      ) : null}
    </ManagementPage>
  );
}
