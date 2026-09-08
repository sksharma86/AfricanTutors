import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ParentPage } from "@/components/dashboard/parent-page";
import { ParentStudyHalls } from "@/components/dashboard/parent-study-halls";
import { requireRole } from "@/lib/auth";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { loadParentWorkspace } from "@/lib/parent-portal-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Study Halls" };
export const dynamic = "force-dynamic";

export default async function ParentStudyHallsPage() {
  const user = await requireRole("student", "/dashboard/student/study-halls");
  const applicant = await getGuideApplicantInfo(user.id);
  if (applicant) redirect("/dashboard/applicant");
  const supabase = await createSupabaseServerClient();
  const data = await loadParentWorkspace(supabase!, user.id);

  return (
    <ParentPage>
      <h1 className="font-display text-3xl font-semibold tracking-[-0.035em] text-[var(--pp-ink)]">Study Halls</h1>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        <Link
          href="/dashboard/student/plan-week"
          className="text-sm font-medium text-ink-600 underline-offset-4 hover:text-ink-900 hover:underline"
        >
          Plan my week
        </Link>
        <Link
          href="/dashboard/student/book"
          className="text-sm font-medium text-ink-600 underline-offset-4 hover:text-ink-900 hover:underline"
        >
          Book one Study Hall
        </Link>
      </p>
      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-ink-500">Loading Study Halls…</p>}>
          <ParentStudyHalls bookings={data.bookings} />
        </Suspense>
      </div>
    </ParentPage>
  );
}
