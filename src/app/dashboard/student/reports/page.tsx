import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ParentPage } from "@/components/dashboard/parent-page";
import { WatchRecordingButton } from "@/components/dashboard/watch-recording-button";
import { requireRole } from "@/lib/auth";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { childFirstName, parentGuideLabel, parentStudyHallLists } from "@/lib/parent-portal.mjs";
import { loadParentWorkspace, recordingSummary } from "@/lib/parent-portal-data";
import { recordingAvailabilityLabel } from "@/lib/recording-retention.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDayHeading } from "@/lib/timezone";

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
      <h1 className="font-display text-2xl font-semibold text-ink-900">Reports &amp; Recordings</h1>
      <p className="mt-1 text-sm text-ink-500">
        What happened in each completed Study Hall — not grades or academic assessments. Recordings stay available for
        60 days after the Study Hall.
      </p>

      <div id="reports" className="mt-8">
        {past.length === 0 ? (
          <p className="text-sm text-ink-500">Your completed Study Halls will appear here.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {past.map((b) => {
              const report = data.reportByBooking.get(b.id);
              const rec = data.recordingByBooking.get(b.id);
              const recView = recordingSummary(rec);
              const tz = b.students?.timezone || DEFAULT_TZ;
              const when = b.scheduled_start ? formatDayHeading(b.scheduled_start, tz) : "Recently";
              return (
                <li key={b.id} id={`hall-${b.id}`} className="scroll-mt-24 py-4">
                  <p className="text-sm font-medium text-ink-900">
                    {when} · {childFirstName(b.students?.full_name)}
                  </p>
                  <p className="text-sm text-ink-500">Guide: {parentGuideLabel(b) ?? "—"}</p>
                  {data.escalatedBookings.has(b.id) ? (
                    <p className="mt-2 text-xs text-ink-600">A parent attention request was sent during this session.</p>
                  ) : null}
                  <p className="mt-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">Report</p>
                  {report ? (
                    <p className="mt-1 text-sm text-ink-700 whitespace-pre-wrap">{report.work_summary}</p>
                  ) : (
                    <p className="mt-1 text-sm text-ink-500">Reports from completed Study Halls will appear here.</p>
                  )}
                  <p className="mt-3 text-xs font-semibold tracking-wide text-ink-400 uppercase">Recording</p>
                  {!recView ? (
                    <p className="mt-1 text-sm text-ink-500">Recordings from completed Study Halls will appear here.</p>
                  ) : recView.status === "failed" ? (
                    <p className="mt-1 text-sm text-ink-600">Recording unavailable</p>
                  ) : recView.deleted_at || (!recView.playable && recView.status === "completed") ? (
                    <p className="mt-1 text-sm text-ink-600">Recording expired</p>
                  ) : recView.status !== "completed" ? (
                    <p className="mt-1 text-sm text-ink-600">Recording processing</p>
                  ) : (
                    <p className="mt-1 text-sm text-ink-700">{recordingAvailabilityLabel(recView.retention_until)}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Link
                      href={`/dashboard/student/study-halls/${b.id}`}
                      className="text-sm font-semibold text-gold-700 hover:underline"
                    >
                      Read report
                    </Link>
                    {recView?.playable ? <WatchRecordingButton recordingId={recView.id} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

    </ParentPage>
  );
}
