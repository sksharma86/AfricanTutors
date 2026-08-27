import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GuidePage } from "@/components/dashboard/guide-page";
import { GuideSessionReport } from "@/components/dashboard/guide-session-report";
import { GuideSurface } from "@/components/dashboard/guide-surface";
import { requireRole } from "@/lib/auth";
import { guideChildName, guideNeedsReport } from "@/lib/guide-portal.mjs";
import { loadGuideWorkspace } from "@/lib/guide-portal-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tutorTimezone } from "@/lib/tutor-schedule.mjs";
import { formatDayHeading, formatTime } from "@/lib/timezone";

export const metadata: Metadata = { title: "Study Hall complete" };
export const dynamic = "force-dynamic";

export default async function GuideReportPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const user = await requireRole("tutor", `/dashboard/tutor/study-halls/${bookingId}/report`);
  const supabase = await createSupabaseServerClient();
  const data = await loadGuideWorkspace(supabase!, user.id);
  const booking = data.bookings.find((b) => b.id === bookingId);
  if (!booking) notFound();

  const tz = tutorTimezone(data.profile?.timezone);
  const submitted = data.reportedBookings.has(booking.id);
  const needed = guideNeedsReport(booking, submitted);
  const when = booking.scheduled_start
    ? `${formatDayHeading(booking.scheduled_start, tz)} · ${formatTime(booking.scheduled_start, tz)}`
    : "Recently";

  return (
    <GuidePage>
      <p className="mb-5">
        <Link href="/dashboard/tutor" className="text-sm font-medium text-ink-500 hover:text-ink-800">
          ← Home
        </Link>
      </p>
      <GuideSurface featured>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-700 uppercase">Study Hall complete</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-ink-900">
          {guideChildName(booking)}
        </h1>
        <p className="mt-1 text-sm text-ink-500">{when}</p>
        <p className="mt-4 text-sm text-ink-600">Before you finish, tell the parent how the hour went.</p>

        {submitted ? (
          <p className="mt-6 text-sm font-medium text-forest-700">Report submitted</p>
        ) : booking.status === "cancelled" || booking.status === "expired" || booking.status === "no_show" ? (
          <p className="mt-6 text-sm text-ink-500">This Study Hall does not need a completion report.</p>
        ) : !needed ? (
          <p className="mt-6 text-sm text-ink-500">
            The report opens when this Study Hall ends. Ready to join 5 minutes before start.
          </p>
        ) : (
          <div className="mt-6">
            <GuideSessionReport
              bookingId={booking.id}
              childName={booking.student_first_name}
              alreadySubmitted={false}
              variant="page"
            />
          </div>
        )}
      </GuideSurface>
    </GuidePage>
  );
}
