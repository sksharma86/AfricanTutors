import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CustomerBookingActions } from "@/components/dashboard/customer-booking-actions";
import { ParentPage } from "@/components/dashboard/parent-page";
import { WatchRecordingButton } from "@/components/dashboard/watch-recording-button";
import { LinkButton } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { formatDuration } from "@/lib/format.mjs";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import {
  childFirstName,
  parentGuideLabel,
  parentJoinHint,
  parentPaymentLineLabel,
  parentStatusLabel,
} from "@/lib/parent-portal.mjs";
import { FOCUS_LABELS, REDIRECTION_LABELS } from "@/lib/session-report.mjs";
import { loadParentWorkspace, recordingSummary } from "@/lib/parent-portal-data";
import { recordingAvailabilityLabel } from "@/lib/recording-retention.mjs";
import { issueStatus } from "@/lib/status-labels.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDayHeading, formatTime, tzAbbreviation } from "@/lib/timezone";

export const metadata: Metadata = { title: "Study Hall" };
export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/Chicago";

export default async function ParentStudyHallDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const user = await requireRole("student", `/dashboard/student/study-halls/${bookingId}`);
  const applicant = await getGuideApplicantInfo(user.id);
  if (applicant) redirect("/dashboard/applicant");
  const supabase = await createSupabaseServerClient();
  const data = await loadParentWorkspace(supabase!, user.id);
  const booking = data.bookings.find((b) => b.id === bookingId);
  if (!booking) notFound();

  const tz = booking.students?.timezone || DEFAULT_TZ;
  const join = parentJoinHint(booking);
  const report = data.reportByBooking.get(booking.id) ?? null;
  const rec = data.recordingByBooking.get(booking.id) ?? null;
  const recView = recordingSummary(rec);
  const issue = data.issueByBooking.get(booking.id);
  const issueView = issue ? issueStatus(issue) : null;

  return (
    <ParentPage>
      <p className="mb-5">
        <Link href="/dashboard/student/study-halls" className="text-sm font-medium text-ink-500 hover:text-ink-800">
          ← Study Halls
        </Link>
      </p>
      <p className="text-sm font-semibold tracking-wide text-ink-400 uppercase">Study Hall</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink-900">
        {childFirstName(booking.students?.full_name)}
      </h1>
      <p className="mt-1 text-sm text-ink-500">{parentStatusLabel(booking)}</p>

      <dl className="mt-6 grid gap-4 text-sm">
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">When</dt>
          <dd className="mt-1 text-ink-800">
            {booking.scheduled_start
              ? `${formatDayHeading(booking.scheduled_start, tz)} · ${formatTime(booking.scheduled_start, tz)}${
                  booking.scheduled_end ? ` – ${formatTime(booking.scheduled_end, tz)}` : ""
                } (${tzAbbreviation(booking.scheduled_start, tz)})`
              : "Time to confirm"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Guide</dt>
          <dd className="mt-1 text-ink-800">{parentGuideLabel(booking) ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Length</dt>
          <dd className="mt-1 text-ink-800">{booking.duration_minutes ? formatDuration(booking.duration_minutes) : "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Booking reference</dt>
          <dd className="mt-1 text-ink-800">{booking.public_reference}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">Payment</dt>
          <dd className="mt-1 text-ink-800">{parentPaymentLineLabel(booking)}</dd>
        </div>
      </dl>

      {join.state === "join" ? (
        <div className="mt-6">
          <LinkButton href={`/dashboard/session/${booking.id}`} variant="primary" size="lg">
            Join Study Hall
          </LinkButton>
        </div>
      ) : join.label ? (
        <p className="mt-6 text-sm text-ink-600">{join.label}</p>
      ) : null}

      {booking.request_note ? <p className="mt-6 text-sm text-ink-600">Note: {booking.request_note}</p> : null}

      <section className="mt-8 border-t border-ink-100 pt-6">
        <h2 className="text-sm font-semibold tracking-wide text-ink-400 uppercase">Report</h2>
        {data.escalatedBookings.has(booking.id) ? (
          <p className="mt-2 text-sm text-ink-600">A parent attention request was sent during this session.</p>
        ) : null}
        {report ? (
          <div className="mt-2 space-y-3 text-sm text-ink-700">
            <p className="whitespace-pre-wrap">{report.work_summary}</p>
            <p>
              <span className="text-ink-400">Focus · </span>
              {FOCUS_LABELS[report.focus_rating] ?? report.focus_rating}
            </p>
            <p>
              <span className="text-ink-400">Redirection · </span>
              {REDIRECTION_LABELS[report.redirection_level] ?? report.redirection_level}
            </p>
            {report.guide_note ? (
              <p>
                <span className="text-ink-400">Note from Guide · </span>
                {report.guide_note}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-500">Reports from completed Study Halls will appear here.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-ink-400 uppercase">Recording</h2>
        <p className="mt-1 text-xs text-ink-400">Available for 60 days after the Study Hall.</p>
        {!recView ? (
          <p className="mt-2 text-sm text-ink-500">Recordings from completed Study Halls will appear here.</p>
        ) : recView.status === "failed" ? (
          <p className="mt-2 text-sm text-ink-600">Recording unavailable</p>
        ) : recView.deleted_at || (!recView.playable && recView.status === "completed") ? (
          <p className="mt-2 text-sm text-ink-600">Recording expired</p>
        ) : recView.status !== "completed" ? (
          <p className="mt-2 text-sm text-ink-600">Recording processing</p>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-ink-700">{recordingAvailabilityLabel(recView.retention_until)}</p>
            <WatchRecordingButton recordingId={recView.id} />
          </div>
        )}
      </section>

      {issueView ? (
        <p className="mt-6 text-sm text-ink-500">Issue: {issueView.label}</p>
      ) : null}

      <div className="mt-8">
        <CustomerBookingActions
          bookingId={booking.id}
          canCancel={booking.status === "pending" || booking.status === "confirmed"}
          canDispute={(booking.status === "completed" || booking.status === "no_show") && !issue}
          scheduledStartISO={booking.scheduled_start}
        />
      </div>
    </ParentPage>
  );
}
