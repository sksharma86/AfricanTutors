import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { GuideHomeBoard } from "@/components/dashboard/guide-home-board";
import { GuidePage } from "@/components/dashboard/guide-page";
import { GuideStudyHalls } from "@/components/dashboard/guide-study-halls";
import { requireRole } from "@/lib/auth";
import { guideHomeVisualFixture, guideVisualReviewNow } from "@/lib/guide-home-visual-fixture.mjs";
import { guideAttendanceWhatsApp } from "@/lib/notifications/whatsapp-copy.mjs";
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
  searchParams: Promise<{ report?: string; empty?: string; scene?: string; list?: string }>;
}) {
  if (process.env.GUIDE_HOME_VISUAL_REVIEW !== "1") notFound();
  await requireRole("tutor", "/dashboard/tutor");
  const params = await searchParams;
  const reviewNow = guideVisualReviewNow(new Date("2026-08-26T21:00:00Z"), "America/Chicago", 16, 0);
  const fixture = guideHomeVisualFixture(reviewNow, {
    reportNeeded: params.report === "1",
    empty: params.empty === "1",
    scene: params.scene ?? null,
  });

  if (params.list === "1") {
    return (
      <GuidePage>
        <p className="sr-only">Visual review fixture. Not Guide production data.</p>
        <h1 className="font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-[var(--gp-ink)]">Study Halls</h1>
        <div className="mt-6">
          <Suspense fallback={<p className="text-sm text-ink-500">Loading Study Halls…</p>}>
            <GuideStudyHalls
              bookings={fixture.bookings as GuideBooking[]}
              reportedIds={fixture.reportedBookings}
              openRequestIds={[]}
              tz={fixture.timeZone}
              nowMs={fixture.nowMs}
            />
          </Suspense>
        </div>
      </GuidePage>
    );
  }

  const reviewHalls = fixture.bookings as GuideBooking[];
  const waPreview =
    params.scene === "required" || params.scene === "block2" || params.scene === "block4" || params.scene === "replace2"
      ? guideAttendanceWhatsApp({
          count: params.scene === "block4" ? 4 : params.scene === "block2" || params.scene === "replace2" ? 2 : 1,
          startISO: reviewHalls[0]?.scheduled_start,
          endISO: reviewHalls[Math.max((params.scene === "block4" ? 4 : 2) - 1, 0)]?.scheduled_end,
          tz: fixture.timeZone,
          durationMinutes: 60,
          studentName: "Jordan",
          appUrl: "https://example.com",
          replacement: params.scene === "replace2",
        })
      : null;

  return (
    <GuidePage compose>
      <p className="sr-only">Visual review fixture. Not Guide production data.</p>
      {waPreview ? (
        <section id="whatsapp-preview" className="mb-4 max-w-lg rounded-2xl border border-[#e6e0d4] bg-white px-4 py-3">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[#8a8174] uppercase">WhatsApp preview · not sent</p>
          <pre className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-[#1c1915]">{waPreview.body}</pre>
        </section>
      ) : null}
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
