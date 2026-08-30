import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuideHomeBoard } from "@/components/dashboard/guide-home-board";
import { GuidePage } from "@/components/dashboard/guide-page";
import { requireRole } from "@/lib/auth";
import { guideHomeVisualFixture } from "@/lib/guide-home-visual-fixture.mjs";
import type { GuideAvailabilityBlock, GuideExceptionRow } from "@/lib/guide-portal-data";
import type { GuideBooking, GuideEarning } from "@/lib/guide-portal-types";

export const metadata: Metadata = { title: "Guide Home visual review" };
export const dynamic = "force-dynamic";

/**
 * Isolated composition review. 404 unless GUIDE_HOME_VISUAL_REVIEW=1.
 * Does not write to the database. Not linked from Guide navigation.
 */
export default async function GuideHomeVisualReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; empty?: string }>;
}) {
  if (process.env.GUIDE_HOME_VISUAL_REVIEW !== "1") notFound();
  await requireRole("tutor", "/dashboard/tutor");
  const params = await searchParams;
  const fixture = guideHomeVisualFixture(new Date(), {
    reportNeeded: params.report === "1",
    empty: params.empty === "1",
  });

  return (
    <GuidePage compose>
      <p className="sr-only">Visual review fixture. Not Guide production data.</p>
      <GuideHomeBoard
        firstName={fixture.firstName}
        bookings={fixture.bookings as GuideBooking[]}
        availability={fixture.availability as GuideAvailabilityBlock[]}
        exceptions={fixture.exceptions as GuideExceptionRow[]}
        earnings={fixture.earnings as GuideEarning[]}
        reportedBookings={fixture.reportedBookings}
        reportsReady={fixture.reportsReady}
        timeZone={fixture.timeZone}
        nowMs={fixture.nowMs}
        currency={fixture.currency}
        profileStatus={fixture.profileStatus}
      />
    </GuidePage>
  );
}
