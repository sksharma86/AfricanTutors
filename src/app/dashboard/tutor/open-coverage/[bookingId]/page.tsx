import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuideOpenCoverageCard } from "@/components/dashboard/guide-open-coverage-card";
import { GuidePage } from "@/components/dashboard/guide-page";
import { requireRole } from "@/lib/auth";
import { claimResultMessage, offerIsClaimable } from "@/lib/open-coverage.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatTime, tzAbbreviation } from "@/lib/timezone-format.mjs";
import { tutorTimezone } from "@/lib/tutor-schedule.mjs";

export const metadata: Metadata = { title: "Open Study Hall" };
export const dynamic = "force-dynamic";

export default async function GuideOpenCoveragePage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const user = await requireRole("tutor", `/dashboard/tutor/open-coverage/${bookingId}`);
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, scheduled_start, scheduled_end, duration_minutes, tutor_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) notFound();

  const offerRes = await supabase
    .from("guide_open_coverage_offers")
    .select("id, status, tutor_id, created_at")
    .eq("booking_id", bookingId)
    .eq("tutor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const offer = offerRes.error ? null : offerRes.data;

  const { data: profile } = await supabase.from("tutor_profiles").select("timezone").eq("profile_id", user.id).maybeSingle();
  const tz = tutorTimezone(profile?.timezone);
  const start = booking.scheduled_start ? formatTime(booking.scheduled_start, tz) : "Scheduled time";
  const end = booking.scheduled_end ? formatTime(booking.scheduled_end, tz) : start;
  const abbr = booking.scheduled_start ? tzAbbreviation(booking.scheduled_start, tz) : "";
  const mins = Number(booking.duration_minutes) > 0 ? Number(booking.duration_minutes) : 60;
  const timeLabel = abbr ? `${start}–${end} ${abbr}` : `${start}–${end}`;
  const durationLabel = mins === 60 ? "60 minutes" : `${mins} minutes`;

  const claimable = offerIsClaimable(offer, { booking });
  const won = offer?.status === "claimed" && offer.tutor_id === user.id;
  const state = won ? "accepted" : claimable.ok ? "open" : "covered";

  return (
    <GuidePage>
      <GuideOpenCoverageCard
        bookingId={bookingId}
        timeLabel={timeLabel}
        durationLabel={durationLabel}
        state={state}
        message={state === "open" ? null : won ? claimResultMessage("won") : claimResultMessage(claimable.reason)}
      />
    </GuidePage>
  );
}
