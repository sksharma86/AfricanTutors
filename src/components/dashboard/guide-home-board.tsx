import { GuideAvailabilityCard } from "@/components/dashboard/guide-availability-card";
import { GuideEarningsCard } from "@/components/dashboard/guide-earnings-card";
import { GuideFinishReport } from "@/components/dashboard/guide-finish-report";
import { GuideGreeting } from "@/components/dashboard/guide-greeting";
import { GuideGuidance } from "@/components/dashboard/guide-guidance";
import { GuideNextStudyHall } from "@/components/dashboard/guide-next-study-hall";
import { GuideTodaySchedule } from "@/components/dashboard/guide-today-schedule";
import { GuideWeekCard } from "@/components/dashboard/guide-week-card";
import type { GuideAvailabilityBlock, GuideExceptionRow } from "@/lib/guide-portal-data";
import {
  guideAvailabilitySummary,
  guideDaySchedule,
  guideEarningsHomeSummary,
  guideStudyHallLists,
  guideWeekSummary,
  unfinishedGuideReport,
} from "@/lib/guide-portal.mjs";
import type { GuideBooking, GuideEarning } from "@/lib/guide-portal-types";

export function GuideHomeBoard({
  firstName,
  bookings,
  availability,
  exceptions,
  earnings,
  reportedBookings,
  reportsReady,
  timeZone,
  nowMs,
  currency = "USD",
  profileStatus,
}: {
  firstName: string;
  bookings: GuideBooking[];
  availability: GuideAvailabilityBlock[];
  exceptions: GuideExceptionRow[];
  earnings: GuideEarning[];
  reportedBookings: Set<string> | string[];
  reportsReady: boolean;
  timeZone: string;
  nowMs?: number;
  currency?: string;
  profileStatus?: string | null;
}) {
  const lists = guideStudyHallLists(bookings, nowMs, timeZone);
  const today = guideDaySchedule(bookings, nowMs, timeZone);
  const week = guideWeekSummary(bookings, nowMs, timeZone);
  const avail = guideAvailabilitySummary(availability, exceptions, nowMs, timeZone);
  const pay = guideEarningsHomeSummary(earnings, nowMs, timeZone, currency);
  const unfinished = reportsReady ? unfinishedGuideReport(bookings, reportedBookings, nowMs) : null;

  return (
    <div className="gp-home">
      <GuideGreeting firstName={firstName} timeZone={timeZone} nowMs={nowMs} />
      {profileStatus && profileStatus !== "approved" ? (
        <p className="text-sm text-[#a15c1a]">
          Your Guide account is {profileStatus}. Study Hall tools stay limited until an admin restores approval.
        </p>
      ) : null}
      <div className="gp-home-grid">
        <div className="gp-home-hero">
          <GuideNextStudyHall next={lists.next} tz={timeZone} nowMs={nowMs} />
        </div>
        <div className="gp-home-today">
          <GuideTodaySchedule rows={today} nextId={lists.next?.id} tz={timeZone} nowMs={nowMs} />
        </div>
        <div className="gp-home-week">
          {unfinished ? (
            <GuideFinishReport booking={unfinished} tz={timeZone} />
          ) : (
            <GuideWeekCard count={week.count} hours={week.hours} completed={week.completed} upcoming={week.upcoming} />
          )}
        </div>
        <div className="gp-home-avail">
          <GuideAvailabilityCard
            availableNow={avail.availableNow}
            availableToday={avail.availableToday}
            nextWindow={avail.nextWindow}
            hasSchedule={avail.hasSchedule}
          />
        </div>
        <div className="gp-home-earn">
          <GuideEarningsCard outstanding={pay.outstanding} paidMonth={pay.paidMonth} currency={pay.currency} />
        </div>
        <div className="gp-home-guide">
          <GuideGuidance />
        </div>
      </div>
    </div>
  );
}
