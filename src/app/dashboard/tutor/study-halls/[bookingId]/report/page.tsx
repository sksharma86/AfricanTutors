import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GuideCompletedHeader } from "@/components/dashboard/guide-completed-header";
import { GuidePage } from "@/components/dashboard/guide-page";
import { GuideSessionReport } from "@/components/dashboard/guide-session-report";
import { GuideSurface } from "@/components/dashboard/guide-surface";
import { requireRole } from "@/lib/auth";
import { firstNameOf } from "@/lib/household-children.mjs";
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
  const kidsRes = await supabase!
    .from("booking_children")
    .select("student_id, sort_order, students!student_id(full_name)")
    .eq("booking_id", bookingId)
    .order("sort_order")
    .then((r) => r, () => ({ data: null, error: null }));
  const storedNames = Array.isArray(booking.student_first_names) ? booking.student_first_names : [];
  const reportChildren = ((kidsRes.data ?? []) as { student_id: string; students?: { full_name?: string | null } | null }[])
    .map((row, i) => ({
      id: row.student_id,
      firstName: firstNameOf(row.students?.full_name, storedNames[i] || "Child"),
    }))
    .filter((c) => c.id);

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
      <GuideCompletedHeader child={guideChildName(booking)} when={when}>
        <p className="mt-4 text-sm text-white/62">Before you finish, tell the parent how the hour went.</p>
        {submitted ? (
          <p className="mt-6 text-sm font-medium text-gold-200">Report submitted</p>
        ) : booking.status === "cancelled" || booking.status === "expired" || booking.status === "no_show" ? (
          <p className="mt-6 text-sm text-white/60">This Study Hall does not need a completion report.</p>
        ) : !needed ? (
          <p className="mt-6 text-sm text-white/60">
            The report opens when this Study Hall ends. Ready to join 5 minutes before start.
          </p>
        ) : null}
      </GuideCompletedHeader>
      {needed && !submitted ? (
        <div className="mt-4">
          <GuideSurface>
            <GuideSessionReport
              bookingId={booking.id}
              childName={booking.student_first_name}
              childList={reportChildren}
              alreadySubmitted={false}
              variant="page"
            />
          </GuideSurface>
        </div>
      ) : null}
    </GuidePage>
  );
}
