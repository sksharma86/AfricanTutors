import { ParentGreeting } from "@/components/dashboard/parent-greeting";
import { ParentHouseholdStatus } from "@/components/dashboard/parent-household-status";
import { ParentNextStudyHall } from "@/components/dashboard/parent-next-study-hall";
import { ParentRecentActivity } from "@/components/dashboard/parent-recent-activity";
import { ParentStudyHallWeek } from "@/components/dashboard/parent-study-hall-week";
import { parentHomeCtas, type ParentMembership } from "@/lib/parent-week.mjs";
import type { ParentBooking, ParentRecording, ParentReport } from "@/lib/parent-portal-types";

/**
 * Parent Home: Your Study Hall Week + next action. Not a finance dashboard.
 */
export function ParentHomeBoard({
  firstName,
  next,
  last,
  lastReport,
  lastRecording,
  later: _later,
  bookings,
  householdTz,
  minutes,
  creditCents,
  preferFreeSession,
  showPhoneNudge = false,
  membership = null,
  nowMs,
}: {
  firstName: string;
  next: ParentBooking | null;
  last: ParentBooking | null;
  lastReport: ParentReport | null;
  lastRecording: ParentRecording | null;
  later?: ParentBooking[];
  bookings: ParentBooking[];
  householdTz: string;
  minutes: number;
  creditCents: number;
  preferFreeSession: boolean;
  showPhoneNudge?: boolean;
  membership?: ParentMembership;
  nowMs?: number;
}) {
  void _later;
  const entitled365 = Boolean(membership?.entitled);
  const ctas = parentHomeCtas({ entitled365, freeTrialAvailable: preferFreeSession });

  return (
    <div className="pp-home">
      <ParentGreeting firstName={firstName} />

      <div className="pp-home-grid">
        <div className="pp-home-hero">
          <ParentNextStudyHall next={next} ctas={ctas} />
        </div>
        <div className="pp-home-week">
          <ParentStudyHallWeek bookings={bookings} timeZone={householdTz} nowMs={nowMs} ctas={ctas} />
        </div>
        <div className="pp-home-status">
          <ParentHouseholdStatus
            membership={membership}
            minutes={minutes}
            creditCents={creditCents}
            freeTrialAvailable={preferFreeSession}
            timeZone={householdTz}
          />
        </div>
        <div className="pp-home-recent">
          {last ? (
            <ParentRecentActivity booking={last} report={lastReport} recording={lastRecording} />
          ) : (
            <p className="px-1 text-[13px] leading-5 text-[var(--pp-muted)]">
              Reports appear after a completed Study Hall.
            </p>
          )}
        </div>
      </div>

      {showPhoneNudge ? (
        <p className="pp-home-note">
          Add a number in{" "}
          <a href="/dashboard/student/account" className="font-medium text-[var(--pp-ink)] underline-offset-4 hover:underline">
            Account
          </a>{" "}
          so we can reach you during Study Hall if needed.
        </p>
      ) : null}
    </div>
  );
}
