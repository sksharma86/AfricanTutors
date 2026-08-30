import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CustomerBookingActions } from "@/components/dashboard/customer-booking-actions";
import { ParentCompletedHeader, ParentSessionRecap } from "@/components/dashboard/parent-session-recap";
import { ParentPage } from "@/components/dashboard/parent-page";
import { ParentSurface } from "@/components/dashboard/parent-surface";
import { LinkButton } from "@/components/ui/button";
import { PortalTextLink } from "@/components/ui/portal-text-link";
import { requireRole } from "@/lib/auth";
import { formatDuration } from "@/lib/format.mjs";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { bookingChildCount, bookingChildNames, firstNameOf } from "@/lib/household-children.mjs";
import {
  parentCanCancel,
  parentCanDispute,
  parentGuideLabel,
  parentJoinHint,
  parentPaymentLineLabel,
  parentStatusLabel,
} from "@/lib/parent-portal.mjs";
import { loadParentWorkspace, recordingSummary } from "@/lib/parent-portal-data";
import { issueStatus } from "@/lib/status-labels.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDayHeading, formatTime, tzAbbreviation } from "@/lib/timezone";

export const metadata: Metadata = { title: "Study Hall" };
export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/Chicago";

export default async function ParentStudyHallDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const user = await requireRole("student", `/dashboard/student/study-halls/${bookingId}`);
  const applicant = await getGuideApplicantInfo(user.id);
  if (applicant) redirect("/dashboard/applicant");
  const supabase = await createSupabaseServerClient();
  const data = await loadParentWorkspace(supabase!, user.id);
  const booking = data.bookings.find((b) => b.id === bookingId);
  if (!booking) notFound();

  const tz = booking.students?.timezone || DEFAULT_TZ;
  const join = parentJoinHint(booking);
  const report = data.reportByBooking.get(booking.id) ?? null;
  const rec = data.recordingByBooking.get(booking.id) ?? null;
  const recView = recordingSummary(rec);
  const issue = data.issueByBooking.get(booking.id);
  const issueView = issue ? issueStatus(issue) : null;
  const canCancel = parentCanCancel(booking);
  const canDispute = parentCanDispute(booking, Boolean(issue));
  const isPast = !canCancel && join.state !== "join" && join.state !== "opens_at";

  return (
    <ParentPage>
      <p className="mb-5">
        <PortalTextLink href="/dashboard/student/study-halls">← Study Halls</PortalTextLink>
      </p>

      {isPast ? (
        <div className="space-y-6">
          <ParentCompletedHeader
            when={
              booking.scheduled_start
                ? `${formatDayHeading(booking.scheduled_start, tz)} · ${formatTime(booking.scheduled_start, tz)}${
                    booking.scheduled_end ? ` – ${formatTime(booking.scheduled_end, tz)}` : ""
                  }`
                : "Recently"
            }
            childrenLine={bookingChildNames(booking)}
            guide={parentGuideLabel(booking)}
          />
          <ParentSurface>
            <ParentSessionRecap
              report={report}
              recording={recView}
              escalated={data.escalatedBookings.has(booking.id)}
            />
            <p className="mt-5 text-xs text-ink-400">
              {parentPaymentLineLabel(booking)}
              {booking.public_reference ? ` · Booking reference ${booking.public_reference}` : ""}
            </p>
            {canDispute ? (
              <div className="mt-4">
                <CustomerBookingActions
                  bookingId={booking.id}
                  canCancel={canCancel}
                  canDispute={canDispute}
                  scheduledStartISO={booking.scheduled_start}
                />
              </div>
            ) : null}
          </ParentSurface>
          {issueView ? <p className="text-sm text-ink-500">{issueView.label}</p> : null}
        </div>
      ) : (
        <ParentSurface featured>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-300 uppercase">Study Hall</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-white">
            {bookingChildNames(booking)}
          </h1>
          <p data-kind="status" className="mt-1 text-sm text-white/62">
            {parentStatusLabel(booking)}
          </p>

          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-medium tracking-[0.12em] text-white/45 uppercase">When</dt>
              <dd className="mt-1 text-white/88">
                {booking.scheduled_start
                  ? `${formatDayHeading(booking.scheduled_start, tz)} · ${formatTime(booking.scheduled_start, tz)}${
                      booking.scheduled_end ? ` – ${formatTime(booking.scheduled_end, tz)}` : ""
                    } (${tzAbbreviation(booking.scheduled_start, tz)})`
                  : "Time to confirm"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium tracking-[0.12em] text-white/45 uppercase">Guide</dt>
              <dd className="mt-1 text-white/88">{parentGuideLabel(booking) ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium tracking-[0.12em] text-white/45 uppercase">Length</dt>
              <dd className="mt-1 text-white/88">{booking.duration_minutes ? formatDuration(booking.duration_minutes) : "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium tracking-[0.12em] text-white/45 uppercase">Payment</dt>
              <dd className="mt-1 text-white/88">{parentPaymentLineLabel(booking)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-medium tracking-[0.12em] text-white/45 uppercase">
                {bookingChildCount(booking) > 1 ? "Children" : "Child"}
              </dt>
              <dd className="mt-1 text-white/88">
                {booking.student_first_names && booking.student_first_names.length > 1 ? (
                  <ul className="space-y-0.5">
                    {booking.student_first_names.map((name) => (
                      <li key={name}>{firstNameOf(name)}</li>
                    ))}
                  </ul>
                ) : (
                  bookingChildNames(booking)
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-white/40">Booking reference {booking.public_reference}</p>

          {join.state === "join" ? (
            <div className="mt-6">
              <LinkButton href={`/dashboard/session/${booking.id}`} variant="secondary" size="lg">
                Join Study Hall
              </LinkButton>
            </div>
          ) : join.state === "opens_at" && join.label ? (
            <p className="mt-6 text-sm font-medium text-gold-200">{join.label}</p>
          ) : null}

          {booking.request_note ? <p className="mt-5 text-sm text-white/70">{booking.request_note}</p> : null}

          {canCancel || canDispute ? (
            <div className="mt-6">
              <CustomerBookingActions
                bookingId={booking.id}
                canCancel={canCancel}
                canDispute={canDispute}
                scheduledStartISO={booking.scheduled_start}
              />
            </div>
          ) : null}
        </ParentSurface>
      )}
    </ParentPage>
  );
}
