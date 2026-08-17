import type { Metadata } from "next";
import Link from "next/link";

import { BookingWizard, type StudentRow, type SubjectRow } from "@/components/booking/booking-wizard";
import { Container } from "@/components/ui/container";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Book a Session",
};

export default async function BookSessionPage() {
  await requireRole("student", "/dashboard/student/book");
  const supabase = await createSupabaseServerClient();

  const [{ data: students }, { data: subjects }] = await Promise.all([
    supabase!.from("students").select("id, full_name, grade_level, timezone").order("created_at"),
    supabase!.from("subjects").select("id, name, category").eq("is_active", true).order("category").order("name"),
  ]);

  return (
    <div className="min-h-full bg-ink-50/50 py-10">
      <Container className="max-w-2xl">
        <Link href="/dashboard/student" className="text-sm font-medium text-gold-700 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ink-900">Book tutoring</h1>
        <p className="mt-1 text-sm text-ink-500">
          Tell us who needs help and when — African Tutors matches an approved tutor for you.
        </p>
        <div className="mt-8">
          <BookingWizard
            students={(students ?? []) as StudentRow[]}
            subjects={(subjects ?? []) as SubjectRow[]}
          />
        </div>
      </Container>
    </div>
  );
}
