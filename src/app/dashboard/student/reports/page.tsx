import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ParentIconPlay, ParentIconReports } from "@/components/dashboard/parent-icons";
import { ParentPage } from "@/components/dashboard/parent-page";
import { ParentSurface } from "@/components/dashboard/parent-surface";
import { WatchRecordingButton } from "@/components/dashboard/watch-recording-button";
import { LinkButton } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { bookingChildNames } from "@/lib/household-children.mjs";
import { parentGuideLabel, parentStudyHallLists } from "@/lib/parent-portal.mjs";
import { loadParentWorkspace, recordingSummary } from "@/lib/parent-portal-data";
import { recordingAvailabilityLabel } from "@/lib/recording-retention.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDayHeading, formatTime } from "@/lib/timezone";

export const metadata: Metadata = { title: "Reports & Recordings" };
export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/Chicago";

export default async function ParentReportsPage() {
  const user = await requireRole("student", "/dashboard/student/reports");
  const applicant = await getGuideApplicantInfo(user.id);
  if (applicant) redirect("/dashboard/applicant");
  const supabase = await createSupabaseServerClient();
  const data = await loadParentWorkspace(supabase!, user.id);
  const { past } = parentStudyHallLists(data.bookings);

  return (
    <ParentPage>
      <h1 className="font-display text-3xl font-semibold tracking-[-0.035em] text-[var(--pp-ink)]">
        Reports &amp; Recordings
      </h1>
      <p className="mt-1 text-sm text-[var(--pp-muted)]">Session notes — not grades or academic assessments.</p>

      <div id="reports" className="mt-6">
        {past.length === 0 ? (
          <ParentSurface>
            <p className="font-display text-xl font-semibold tracking-[-0.03em] text-[var(--pp-ink)]">None yet.</p>
            <p className="mt-1.5 text-sm text-[var(--pp-muted)]">
              Recaps appear here after a Study Hall is completed.
            </p>
          </ParentSurface>
        ) : (
          <ParentSurface>
            <ul className="divide-y divide-[#1c1915]/[0.06]">
              {past.map((b: (typeof past)[number]) => {
                const report = data.reportByBooking.get(b.id);
                const rec = data.recordingByBooking.get(b.id);
                const recView = recordingSummary(rec);
                const tz = b.students?.timezone || DEFAULT_TZ;
                const when = b.scheduled_start
                  ? `${formatDayHeading(b.scheduled_start, tz)}${
                      b.scheduled_start ? ` · ${formatTime(b.scheduled_start, tz)}` : ""
                    }`
                  : "Recently";
                const recCopy = !recView
                  ? "No recording yet"
                  : recView.status === "failed"
                    ? "Recording unavailable"
                    : recView.deleted_at || (!recView.playable && recView.status === "completed")
                      ? "Recording expired"
                      : recView.status !== "completed"
                        ? "Recording processing"
                        : recordingAvailabilityLabel(recView.retention_until);
                return (
                  <li key={b.id} id={`hall-${b.id}`} className="scroll-mt-24 py-5 first:pt-1 last:pb-1">
                    <p className="text-sm font-medium text-[var(--pp-ink)]">
                      {bookingChildNames(b)}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--pp-muted)]">{when}</p>
                    <p className="text-sm text-[var(--pp-muted)]">Guide {parentGuideLabel(b) ?? "—"}</p>
                    {data.escalatedBookings.has(b.id) ? (
                      <p className="mt-2 text-sm text-[var(--pp-attention)]">
                        A parent attention request was sent during this session.
                      </p>
                    ) : null}
                    <div className="mt-3 space-y-1.5 text-sm">
                      <p className="flex items-center gap-2 text-[var(--pp-ink)]">
                        <ParentIconReports className="h-4 w-4 text-[var(--pp-muted)]" />
                        {report ? (
                          report.children && report.children.length > 1 ? (
                            <span>Report ready</span>
                          ) : (
                            <span className="whitespace-pre-wrap">{report.work_summary}</span>
                          )
                        ) : (
                          <span className="text-[var(--pp-muted)]">No report yet</span>
                        )}
                      </p>
                      <p className="flex items-center gap-2 text-[var(--pp-muted)]">
                        <ParentIconPlay className="h-4 w-4" />
                        {recCopy}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <LinkButton href={`/dashboard/student/study-halls/${b.id}`} variant="outline" size="sm">
                        Read report
                      </LinkButton>
                      {recView?.playable ? <WatchRecordingButton recordingId={recView.id} /> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </ParentSurface>
        )}
      </div>
    </ParentPage>
  );
}
