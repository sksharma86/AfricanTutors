import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ParentHomeBoard } from "@/components/dashboard/parent-home-board";
import { ParentPage } from "@/components/dashboard/parent-page";
import { ParentCompletedHeader, ParentSessionRecap } from "@/components/dashboard/parent-session-recap";
import { ParentSurface } from "@/components/dashboard/parent-surface";
import { RecordingViewerFrame } from "@/components/dashboard/recording-viewer-frame";
import { requireRole } from "@/lib/auth";
import { parentHomeVisualFixture } from "@/lib/parent-home-visual-fixture.mjs";

export const metadata: Metadata = { title: "Home visual review" };
export const dynamic = "force-dynamic";

/**
 * Isolated composition review. 404 unless PARENT_HOME_VISUAL_REVIEW=1.
 * Does not write to the database. Not linked from Parent navigation.
 */
export default async function ParentHomeVisualReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string }>;
}) {
  if (process.env.PARENT_HOME_VISUAL_REVIEW !== "1") notFound();
  await requireRole("student", "/dashboard/student");
  const params = await searchParams;
  const scene = params.scene ?? null;
  const fixture = parentHomeVisualFixture(new Date(), { scene });

  if (scene === "completed") {
    return (
      <ParentPage>
        <p className="sr-only">Visual review fixture. Not customer data.</p>
        <ParentCompletedHeader
          when="Wednesday, Aug 27 · 6:30 PM – 7:30 PM"
          childrenLine="Jordan"
          guide="Sarah"
        />
        <div className="mt-6">
          <ParentSurface>
            <ParentSessionRecap
              report={{
                id: "fixture-report",
                booking_id: "fixture-recent",
                submitted_at: "2026-08-27T00:30:00.000Z",
                focus_rating: "good_focus",
                work_summary: "Homework stayed on track.",
                redirection_level: "a_little",
                guide_note: null,
              }}
              recording={{
                id: "fixture-rec",
                status: "completed",
                retention_until: "2026-10-26T00:00:00.000Z",
                deleted_at: null,
                playable: true,
              }}
            />
          </ParentSurface>
        </div>
      </ParentPage>
    );
  }

  if (scene === "recording" || scene === "recording-missing" || scene === "recording-expired") {
    return (
      <ParentPage>
        <p className="sr-only">Visual review fixture. Not customer data.</p>
        <RecordingViewerFrame
          backHref="/dashboard/student/reports"
          backLabel="← Back to Reports & Recordings"
          secondaryHref="/dashboard/student/study-halls/fixture-recent"
          secondaryLabel="← Back to Study Hall"
          url={scene === "recording" ? undefined : null}
          errorStatus={scene === "recording-missing" ? 404 : scene === "recording-expired" ? 410 : null}
          heading="Study Hall recording"
          note={scene === "recording" ? <p>Available for 58 more days</p> : null}
        />
        {scene === "recording" ? (
          <div className="mt-6">
            <video className="aspect-video w-full rounded-xl bg-black" controls playsInline />
            <p className="mt-3 text-sm font-medium text-[var(--pp-ink)]">Open recording in this tab</p>
          </div>
        ) : null}
      </ParentPage>
    );
  }

  return (
    <ParentPage compose>
      <p className="sr-only">Visual review fixture. Not customer data.</p>
      <ParentHomeBoard {...fixture} />
    </ParentPage>
  );
}
