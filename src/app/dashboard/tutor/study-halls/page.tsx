import type { Metadata } from "next";
import { Suspense } from "react";

import { GuidePage } from "@/components/dashboard/guide-page";
import { GuideStudyHalls } from "@/components/dashboard/guide-study-halls";
import { requireRole } from "@/lib/auth";
import { loadGuideWorkspace } from "@/lib/guide-portal-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tutorTimezone } from "@/lib/tutor-schedule.mjs";

export const metadata: Metadata = { title: "Study Halls" };
export const dynamic = "force-dynamic";

export default async function GuideStudyHallsPage() {
  const user = await requireRole("tutor", "/dashboard/tutor/study-halls");
  const supabase = await createSupabaseServerClient();
  const data = await loadGuideWorkspace(supabase!, user.id);
  const tz = tutorTimezone(data.profile?.timezone);

  return (
    <GuidePage>
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-ink-900">Study Halls</h1>
      <p className="mt-1 text-sm text-ink-500">Upcoming assignments and completed Study Halls.</p>
      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-ink-500">Loading Study Halls…</p>}>
          <GuideStudyHalls
            bookings={data.bookings}
            reportedIds={[...data.reportedBookings]}
            openRequestIds={[...data.openRequestIds]}
            tz={tz}
          />
        </Suspense>
      </div>
    </GuidePage>
  );
}
