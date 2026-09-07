import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PlanMyWeek, type PlanWeekStudent } from "@/components/dashboard/plan-my-week";
import { ParentPage } from "@/components/dashboard/parent-page";
import { requireRole } from "@/lib/auth";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { loadParentWorkspace } from "@/lib/parent-portal-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Plan My Week",
};
export const dynamic = "force-dynamic";

export default async function PlanMyWeekPage() {
  const user = await requireRole("student", "/dashboard/student/plan-week");
  const applicant = await getGuideApplicantInfo(user.id);
  if (applicant) redirect("/dashboard/applicant");
  const supabase = await createSupabaseServerClient();

  const [{ data: tz }, { data: students }, workspace] = await Promise.all([
    supabase!.rpc("resolve_account_timezone", { p_account: user.id }),
    supabase!.from("students").select("id, full_name, grade_level, timezone").order("created_at"),
    loadParentWorkspace(supabase!, user.id),
  ]);

  const householdTz =
    (typeof tz === "string" && tz.trim()) ||
    (students ?? []).find((row) => (row as { timezone?: string }).timezone)?.timezone ||
    "America/Chicago";

  return (
    <ParentPage>
      <Link
        href="/dashboard/student"
        className="text-sm font-medium text-ink-600 underline-offset-4 hover:text-ink-900 hover:underline"
      >
        ← Home
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.03em] text-ink-900 sm:text-4xl">
        Plan My Week
      </h1>
      <p className="mt-2 text-base leading-7 text-ink-500">
        Pick a few days, choose a time for each, and we&apos;ll schedule 60-minute Study Halls through the usual booking flow.
      </p>
      <div className="mt-8">
        <PlanMyWeek
          students={(students ?? []) as PlanWeekStudent[]}
          bookings={workspace.bookings}
          timeZone={householdTz}
        />
      </div>
    </ParentPage>
  );
}
