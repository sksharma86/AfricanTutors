import Link from "next/link";

import { BalanceCards } from "@/components/dashboard/balance-cards";
import { ParentGreeting } from "@/components/dashboard/parent-greeting";
import { ParentHabitCard } from "@/components/dashboard/parent-habit";
import { ParentNextStudyHall } from "@/components/dashboard/parent-next-study-hall";
import { ParentRecentActivity } from "@/components/dashboard/parent-recent-activity";
import { ParentUpcomingList } from "@/components/dashboard/parent-upcoming-list";
import type { ParentBooking, ParentRecording, ParentReport } from "@/lib/parent-portal-types";

/**
 * Stable Parent Home composition. Missing data changes content, not the desktop grid.
 */
export function ParentHomeBoard({
  firstName,
  next,
  last,
  lastReport,
  lastRecording,
  later,
  bookings,
  householdTz,
  minutes,
  creditCents,
  preferFreeSession,
  showPhoneNudge = false,
}: {
  firstName: string;
  next: ParentBooking | null;
  last: ParentBooking | null;
  lastReport: ParentReport | null;
  lastRecording: ParentRecording | null;
  later: ParentBooking[];
  bookings: ParentBooking[];
  householdTz: string;
  minutes: number;
  creditCents: number;
  preferFreeSession: boolean;
  showPhoneNudge?: boolean;
}) {
  const hasRecent = Boolean(last);

  return (
    <div className="pp-home">
      <ParentGreeting firstName={firstName} />

      <div className={`pp-home-grid${hasRecent ? "" : " is-empty"}`}>
        <div className="pp-home-hero">
          <ParentNextStudyHall next={next} />
        </div>
        <div className="pp-home-secondary">
          {hasRecent ? (
            <ParentRecentActivity booking={last} report={lastReport} recording={lastRecording} />
          ) : (
            <ParentHabitCard bookings={bookings} timeZone={householdTz} />
          )}
        </div>
        <div className="pp-home-upcoming">
          <ParentUpcomingList bookings={later} showEmpty hasNext={Boolean(next)} />
        </div>
        <div className="pp-home-utility">
          {hasRecent ? (
            <ParentHabitCard bookings={bookings} timeZone={householdTz} />
          ) : (
            <BalanceCards minutes={minutes} creditCents={creditCents} preferFreeSession={preferFreeSession} slim />
          )}
        </div>
      </div>

      {hasRecent ? (
        <BalanceCards minutes={minutes} creditCents={creditCents} preferFreeSession={preferFreeSession} slim />
      ) : null}

      {preferFreeSession ? (
        <p className="pp-home-note">
          Your first Study Hall is on us — 60 minutes free, no credit card required.{" "}
          <Link href="/dashboard/student/book" className="font-medium text-[var(--pp-ink)] underline-offset-4 hover:underline">
            Book free session
          </Link>
          <span className="mt-0.5 block">After your free session, you can book pay-as-you-go or save with prepaid hours.</span>
        </p>
      ) : null}

      {showPhoneNudge ? (
        <p className="pp-home-note">
          Add a number in{" "}
          <Link href="/dashboard/student/account" className="font-medium text-[var(--pp-ink)] underline-offset-4 hover:underline">
            Account
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
