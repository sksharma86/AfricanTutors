import type { Metadata } from "next";
import Link from "next/link";

import { BookingWizard, type StudentRow, type SubjectRow } from "@/components/booking/booking-wizard";
import { CustomerShell } from "@/components/dashboard/customer-shell";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Book a Session",
};

export default async function BookSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ duration?: string }>;
}) {
  await requireRole("student", "/dashboard/student/book");
  const supabase = await createSupabaseServerClient();

  // Only 30 or 60 are valid; anything else falls back to the default (30).
  const { duration } = await searchParams;
  const initialDuration: 30 | 60 = duration === "60" ? 60 : 30;

  const [{ data: students }, { data: subjects }] = await Promise.all([
    supabase!.from("students").select("id, full_name, grade_level, timezone").order("created_at"),
    supabase!.from("subjects").select("id, name, category").eq("is_active", true).order("category").order("name"),
  ]);

  return (
    <CustomerShell>
      <div className="mx-auto w-full max-w-2xl px-6 py-10 lg:px-8">
        <Link href="/dashboard/student" className="text-sm font-medium text-gold-700 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ink-900 sm:text-4xl">Book a session</h1>
        <p className="mt-2 text-base text-ink-500">
          Tell us who it&apos;s for and when — Study Hall at Home matches an approved Guide for you.
        </p>
        <div className="mt-8">
          <BookingWizard
            students={(students ?? []) as StudentRow[]}
            subjects={(subjects ?? []) as SubjectRow[]}
            initialDuration={initialDuration}
          />
        </div>
      </div>
    </CustomerShell>
  );
}
