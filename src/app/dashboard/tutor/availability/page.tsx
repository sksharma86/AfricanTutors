import type { Metadata } from "next";

import { AvailabilityManager } from "@/components/dashboard/availability-manager";
import { GuidePage } from "@/components/dashboard/guide-page";
import { requireRole } from "@/lib/auth";
import { loadGuideWorkspace } from "@/lib/guide-portal-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tutorTimezone } from "@/lib/tutor-schedule.mjs";

export const metadata: Metadata = { title: "Availability" };
export const dynamic = "force-dynamic";

export default async function GuideAvailabilityPage() {
  const user = await requireRole("tutor", "/dashboard/tutor/availability");
  const supabase = await createSupabaseServerClient();
  const data = await loadGuideWorkspace(supabase!, user.id);
  const tz = tutorTimezone(data.profile?.timezone);

  return (
    <GuidePage>
      <h1 id="availability" className="font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-[var(--gp-ink)]">
        Availability
      </h1>
      <p className="mt-2 text-sm text-[var(--gp-muted)]">
        Keep continuous blocks open for the full Study Hall length parents book (1, 2, or 3 hours). A Study Hall is
        never split across multiple Guides.
      </p>
      <div className="gp-ops mt-6">
        <AvailabilityManager
          tutorId={user.id}
          timezone={tz}
          blocks={data.availability}
          exceptions={data.exceptions}
        />
      </div>
    </GuidePage>
  );
}
