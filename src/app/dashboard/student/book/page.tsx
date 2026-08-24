import type { Metadata } from "next";
import Link from "next/link";

import { BookingWizard, type StudentRow } from "@/components/booking/booking-wizard";
import { CustomerShell } from "@/components/dashboard/customer-shell";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Book a Study Hall Session",
};

export default async function BookSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ duration?: string }>;
}) {
  await requireRole("student", "/dashboard/student/book");
  const supabase = await createSupabaseServerClient();

  // Whole-hour Study Hall only (60 / 120 / 180); anything else defaults to 1 hour.
  const { duration } = await searchParams;
  const parsed = Number(duration);
  const initialDuration: 60 | 120 | 180 =
    parsed === 120 || parsed === 180 || parsed === 60 ? parsed : 60;

  const { data: students } = await supabase!
    .from("students")
    .select("id, full_name, grade_level, timezone")
    .order("created_at");

  return (
    <CustomerShell>
      <div className="mx-auto w-full max-w-2xl px-6 py-10 lg:px-8">
        <Link href="/dashboard/student" className="text-sm font-medium text-gold-700 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
          Book a Study Hall session
        </h1>
        <p className="mt-2 text-base text-ink-500">
          Choose your child, session length, and time — we match an approved Guide for live homework supervision.
        </p>
        <div className="mt-8">
          <BookingWizard students={(students ?? []) as StudentRow[]} initialDuration={initialDuration} />
        </div>
      </div>
    </CustomerShell>
  );
}
