import type { Metadata } from "next";

import { GuideHashRedirect } from "@/components/dashboard/guide-hash-redirect";
import { GuideHomeBoard } from "@/components/dashboard/guide-home-board";
import { GuidePage } from "@/components/dashboard/guide-page";
import { requireRole } from "@/lib/auth";
import { loadGuideWorkspace } from "@/lib/guide-portal-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tutorTimezone } from "@/lib/tutor-schedule.mjs";

export const metadata: Metadata = { title: "Guide workspace" };
export const dynamic = "force-dynamic";

export default async function GuideHomePage() {
  const user = await requireRole("tutor", "/dashboard/tutor");
  const supabase = await createSupabaseServerClient();
  const data = await loadGuideWorkspace(supabase!, user.id);
  const tz = tutorTimezone(data.profile?.timezone);
  const firstName = (user.displayName ?? "").split(" ")[0];

  return (
    <GuidePage compose>
      <GuideHashRedirect />
      <GuideHomeBoard
        firstName={firstName}
        bookings={data.bookings}
        availability={data.availability}
        exceptions={data.exceptions}
        earnings={data.earnings}
        reportedBookings={data.reportedBookings}
        reportsReady={data.reportsReady}
        timeZone={tz}
        currency={data.profile?.comp_currency ?? "USD"}
        profileStatus={data.profile?.status}
      />
    </GuidePage>
  );
}
