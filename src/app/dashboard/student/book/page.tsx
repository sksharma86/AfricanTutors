import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BookingWizard, type StudentRow } from "@/components/booking/booking-wizard";
import { ParentPage } from "@/components/dashboard/parent-page";
import { requireRole } from "@/lib/auth";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Book a Study Hall Session",
};

export default async function BookSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ duration?: string }>;
}) {
  const user = await requireRole("student", "/dashboard/student/book");
  const applicant = await getGuideApplicantInfo(user.id);
  if (applicant) {
    redirect("/dashboard/applicant");
  }
  const supabase = await createSupabaseServerClient();

  // Duration query params cannot create a longer booking. Always 60 minutes.
  void searchParams;

  const { data: students } = await supabase!
    .from("students")
    .select("id, full_name, grade_level, timezone")
    .order("created_at");

  return (
    <ParentPage>
      <Link
        href="/dashboard/student"
        className="text-sm font-medium text-ink-600 underline-offset-4 hover:text-ink-900 hover:underline"
      >
        ← Home
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.03em] text-ink-900 sm:text-4xl">
        Book a Study Hall session
      </h1>
      <p className="mt-2 text-base leading-7 text-ink-500">
        Choose who is joining and a time. Every Study Hall is 60 minutes.
      </p>
      <div className="mt-8">
        <BookingWizard students={(students ?? []) as StudentRow[]} />
      </div>
    </ParentPage>
  );
}
