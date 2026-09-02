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
  const scene = params.scene === "attention" ? (params.view === "block4" ? "block4missed" : "missed") : params.scene ?? null;
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
      {scene === "missed" ||
      scene === "search" ||
      scene === "restored" ||
      scene === "history" ||
      scene === "replacement" ||
      scene === "resolved" ||
      scene === "block4missed" ||
      scene === "replace2" ||
      scene === "split" ||
      scene === "critical" ||
      scene === "criticalresolved" ||
      scene === "protected" ||
      scene === "mixedblock" ||
      scene === "firstprotect" ? (
        <section id="confirm-exception" className="mt-6 max-w-xl">
          <ManagementSurface>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-[#8a8174] uppercase">
              {scene === "critical"
                ? "OPERATIONAL EMERGENCY — no Guide coverage"
                : scene === "protected" || scene === "firstprotect"
                  ? "Customer protected"
                  : scene === "criticalresolved" || scene === "resolved" || scene === "split" || scene === "restored" || scene === "history"
                    ? "Resolved"
                    : scene === "search" || scene === "block4missed" || scene === "mixedblock"
                      ? "Guide coverage unconfirmed"
                      : "Guide confirmation missed"}
            </p>
            <p className={`mt-2 text-sm font-semibold ${scene === "critical" ? "text-[var(--mg-critical)]" : "text-[var(--mg-ink)]"}`}>
              {scene === "critical"
                ? "OPERATIONAL EMERGENCY — no Guide coverage"
                : scene === "protected" || scene === "firstprotect"
                  ? "Customer protected"
                  : scene === "replacement" || scene === "replace2"
                    ? "Replacement Guide awaiting confirmation"
                    : scene === "criticalresolved" || scene === "resolved" || scene === "split" || scene === "restored" || scene === "history"
                      ? "Coverage restored"
                      : scene === "search" || scene === "block4missed" || scene === "mixedblock"
                        ? "Guide coverage unconfirmed"
                        : "Guide confirmation missed"}
            </p>
            <p className="mt-1 text-sm text-[var(--mg-muted)]">
              {scene === "critical"
                ? "Starts in 8 minutes · Jordan · No confirmed Guide"
                : scene === "protected"
                  ? "Study Hall cancelled before start · Booking restored · +1 complimentary hour issued"
                  : scene === "firstprotect"
                    ? "6:13 PM cancelled · later halls proceed with confirmed coverage"
                    : scene === "mixedblock"
                      ? "6:13 PM critical · 7:13–9:13 PM still T-20 coverage issues"
                      : scene === "search"
                        ? "Today · 6:00 PM · Replacement search active"
                        : scene === "restored" || scene === "history"
                          ? "James M. · Confirmed"
                          : scene === "block4missed"
                            ? "Today · 6:23 PM–10:23 PM · 4 Study Halls affected"
                            : scene === "replace2"
                              ? "Today · 6:23 PM–8:23 PM · 2 consecutive Study Halls"
                              : scene === "split"
                                ? "Grace K. 6:23–8:23 · James O. 8:23–10:23"
                                : "Today · 6:30 PM · Jordan · 60 min"}
            </p>
            <p className="mt-1 text-sm text-[var(--mg-muted)]">
              {scene === "critical"
                ? "Assigned Guide: Sarah M. No current confirmation."
                : scene === "criticalresolved"
                  ? "Assigned Guide: Grace K. Attendance confirmed."
                  : scene === "protected" || scene === "firstprotect"
                    ? "Automatic customer protection completed. No further action required."
                    : scene === "search"
                      ? "8 eligible Guides offered. Management can still reassign."
                      : scene === "restored" || scene === "history"
                        ? "Assigned Guide: James M. Attendance confirmed."
                        : scene === "replacement" || scene === "replace2"
                          ? "Assigned Guide: Grace K. Confirmation requested."
                          : scene === "resolved"
                            ? "Assigned Guide: Grace K. Attendance confirmed."
                            : scene === "split"
                              ? "Coverage split. Confirmations recorded per assignment."
                              : scene === "block4missed" || scene === "mixedblock"
                                ? "Assigned Guide: Sarah M. Confirmation deadline missed."
                                : "Assigned Guide: Sarah M. Confirmation deadline missed."}
            </p>
            {scene !== "resolved" &&
            scene !== "split" &&
            scene !== "criticalresolved" &&
            scene !== "protected" &&
            scene !== "firstprotect" &&
            scene !== "restored" &&
            scene !== "history" ? (
              <div className="mt-4">
                <ManagementStudyHallActions bookingId="visual-review-only" canAct needsGuide={false} coverageCancel />
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--mg-muted)]">No further action required.</p>
            )}
          </ManagementSurface>
        </section>
      ) : null}
      {scene === "history" ? (
        <section id="replacement-history" className="mt-6 max-w-xl">
          <ManagementSurface>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-[#8a8174] uppercase">Booking history</p>
            <p className="mt-2 text-sm font-semibold text-[var(--mg-ink)]">Automatic replacement chain</p>
            <ul className="mt-3 divide-y divide-[#ece6d8] text-sm">
              <li className="py-2">
                <p className="text-[var(--mg-ink)]">Confirmation missed</p>
                <p className="text-xs text-[var(--mg-muted)]">Sarah M. · T-20 · original assignment</p>
              </li>
              <li className="py-2">
                <p className="text-[var(--mg-ink)]">Replacement search opened</p>
                <p className="text-xs text-[var(--mg-muted)]">8 eligible Guides offered · private email offers</p>
              </li>
              <li className="py-2">
                <p className="text-[var(--mg-ink)]">Emergency replacement accepted</p>
                <p className="text-xs text-[var(--mg-muted)]">James M. · attendance confirmed · coverage restored</p>
              </li>
            </ul>
          </ManagementSurface>
        </section>
      ) : null}
    </ManagementPage>
  );
}
