import type { Metadata } from "next";

import { GuideFinishReport } from "@/components/dashboard/guide-finish-report";
import { GuideHashRedirect } from "@/components/dashboard/guide-hash-redirect";
import { GuideNextStudyHall } from "@/components/dashboard/guide-next-study-hall";
import { GuidePage } from "@/components/dashboard/guide-page";
import { GuideTodaySchedule } from "@/components/dashboard/guide-today-schedule";
import { requireRole } from "@/lib/auth";
import { loadGuideWorkspace } from "@/lib/guide-portal-data";
import { guideStudyHallLists, unfinishedGuideReport } from "@/lib/guide-portal.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tutorTimezone } from "@/lib/tutor-schedule.mjs";

export const metadata: Metadata = { title: "Guide workspace" };
export const dynamic = "force-dynamic";

export default async function GuideHomePage() {
  const user = await requireRole("tutor", "/dashboard/tutor");
  const supabase = await createSupabaseServerClient();
  const data = await loadGuideWorkspace(supabase!, user.id);
  const tz = tutorTimezone(data.profile?.timezone);
  const lists = guideStudyHallLists(data.bookings, undefined, tz);
  const unfinished = data.reportsReady ? unfinishedGuideReport(data.bookings, data.reportedBookings) : null;

  return (
    <GuidePage>
      <GuideHashRedirect />
      <h1 className="font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-ink-900 sm:text-3xl">Home</h1>

      {data.profile?.status && data.profile.status !== "approved" ? (
        <p className="mt-4 text-sm text-gold-800">
          Your Guide account is {data.profile.status}. Study Hall tools stay limited until an admin restores approval.
        </p>
      ) : null}

      {unfinished ? (
        <div className="mt-5">
          <GuideFinishReport booking={unfinished} tz={tz} />
        </div>
      ) : null}

      <div id="study-halls" className="mt-5">
        <GuideNextStudyHall next={lists.next} tz={tz} />
      </div>

      <div className="mt-8">
        <GuideTodaySchedule rows={lists.today} tz={tz} />
      </div>

      <p className="mt-10 text-sm text-ink-400">
        Your role: presence, focus, accountability, and calm redirection — not tutoring or homework answers. Ready to join 5 minutes before start. During a live session, use Call Parent when you need parent involvement — the parent&apos;s number stays private.
      </p>
    </GuidePage>
  );
}
