import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudyHallMark } from "@/components/brand/study-hall-mark";
import { CameraRequiredBanner } from "@/components/session/camera-required-banner";
import { requireUser } from "@/lib/auth";
import { cameraWarningCopy } from "@/lib/daily/camera-presence.mjs";

export const metadata: Metadata = { title: "Study Hall camera visual review" };
export const dynamic = "force-dynamic";

/**
 * Isolated composition review. 404 unless SESSION_VISUAL_REVIEW=1.
 * Renders the same CameraRequiredBanner used in the live room.
 * Does not join Daily or write to the database.
 */
export default async function SessionCameraVisualReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string }>;
}) {
  if (process.env.SESSION_VISUAL_REVIEW !== "1") notFound();
  await requireUser("/dashboard/session/visual-review");
  const params = await searchParams;
  const scene = params.scene ?? "normal";
  const guide = cameraWarningCopy("tutor");
  const student = cameraWarningCopy("student");

  return (
    <div className="min-h-full bg-[#0b0d10] px-4 py-8 sm:px-6">
      <p className="sr-only">Visual review fixture. Not a live Study Hall.</p>
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[20px] border border-white/10 bg-[#12141a]">
        <div className="flex items-start gap-3 border-b border-white/10 px-5 py-5 sm:px-6">
          <StudyHallMark size={36} variant="dark" className="mt-0.5" />
          <div>
            <p className="text-xs font-semibold tracking-wide text-gold-300 uppercase">Study Hall (at home) · Live session</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-white">Study Hall</h1>
            <p className="mt-1 text-sm text-ink-300">Visual review · camera presence</p>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          {scene === "guide-warning" ? (
            <div className="mb-4">
              <CameraRequiredBanner title={guide.title} body={guide.body} variant="guide" />
            </div>
          ) : null}
          {scene === "student-warning" ? (
            <div className="mb-4">
              <CameraRequiredBanner title={student.title} body={student.body} variant="student" />
            </div>
          ) : null}
          <div className="flex h-[52vh] items-center justify-center rounded-2xl bg-black text-center">
            <div>
              <p className="text-sm font-medium text-white/80">
                {scene === "normal" || scene === "restored" ? "Camera on" : "Camera off — restore required"}
              </p>
              <p className="mt-1 text-xs text-white/45">
                {scene === "restored"
                  ? "Warning cleared. Room is back to normal."
                  : "Fixture placeholder. Daily Prebuilt is not mounted here."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
