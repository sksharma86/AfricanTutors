import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BalanceCards } from "@/components/dashboard/balance-cards";
import { ParentBrandStrip } from "@/components/dashboard/parent-brand-strip";
import { ParentGreeting, ParentGreetingSupport } from "@/components/dashboard/parent-greeting";
import { ParentHabitCard } from "@/components/dashboard/parent-habit";
import { ParentHashRedirect } from "@/components/dashboard/parent-hash-redirect";
import { ParentNextStep } from "@/components/dashboard/parent-next-step";
import { ParentNextStudyHall } from "@/components/dashboard/parent-next-study-hall";
import { ParentPage } from "@/components/dashboard/parent-page";
import { ParentRecentActivity } from "@/components/dashboard/parent-recent-activity";
import { ParentUpcomingList } from "@/components/dashboard/parent-upcoming-list";
import { requireRole } from "@/lib/auth";
import { accountFreeTrialUsed } from "@/lib/free-trial.mjs";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { parentPostSessionOffer } from "@/lib/parent-next-step.mjs";
import { lastCompletedStudyHall, parentStudyHallLists } from "@/lib/parent-portal.mjs";
import { loadParentWorkspace } from "@/lib/parent-portal-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Home",
};

export default async function StudentDashboardPage() {
  const user = await requireRole("student", "/dashboard/student");
  const applicant = await getGuideApplicantInfo(user.id);
  if (applicant) {
    redirect("/dashboard/applicant");
  }
  const supabase = await createSupabaseServerClient();

  try {
    const { notifyWelcome } = await import("@/lib/notify");
    void notifyWelcome(user.id, user.displayName ?? user.email ?? null).catch(() => {
      /* best-effort — never block dashboard */
    });
  } catch {
    /* best-effort — never block dashboard */
  }

  const data = await loadParentWorkspace(supabase!, user.id);
  const freeTrialAvailable = !accountFreeTrialUsed(data.bookings);
  const { next, upcoming } = parentStudyHallLists(data.bookings);
  const later = upcoming.filter((booking) => booking.id !== next?.id);
  const last = lastCompletedStudyHall(data.bookings);
  const lastReport = last ? data.reportByBooking.get(last.id) ?? null : null;
  const nextStep = parentPostSessionOffer({
    bookings: data.bookings,
    last,
    report: lastReport,
    minutes: data.minutes,
  });
  const firstName = (user.displayName ?? "").split(" ")[0];
  const householdTz =
    data.bookings.find((booking) => booking.students?.timezone)?.students?.timezone || "America/Chicago";

  return (
    <ParentPage compose>
      <ParentHashRedirect />
      <ParentGreeting firstName={firstName} />
      <ParentGreetingSupport />

      <div className="mt-7 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20.5rem]">
        <div className="space-y-5">
          <ParentNextStudyHall next={next} />
          {later.length > 0 ? <ParentUpcomingList bookings={later} /> : null}
        </div>
        <div className="space-y-5">
          {last ? (
            <ParentRecentActivity
              booking={last}
              report={lastReport}
              recording={data.recordingByBooking.get(last.id) ?? null}
            />
          ) : null}
          <ParentHabitCard bookings={data.bookings} timeZone={householdTz} />
        </div>
      </div>

      <div className="mt-5">
        <BalanceCards minutes={data.minutes} creditCents={data.creditCents} preferFreeSession={freeTrialAvailable} compact />
      </div>

      {nextStep.kind === "free_convert" || nextStep.kind === "repeat" ? (
        <div className="mt-5">
          <ParentNextStep
            kind={nextStep.kind}
            headline={nextStep.headline}
            body={nextStep.body}
            bookLabel={nextStep.bookLabel}
            bookHref={nextStep.bookHref}
            showBuyHours={nextStep.showBuyHours}
          />
        </div>
      ) : null}

      <ParentBrandStrip />

      {freeTrialAvailable ? (
        <p className="mt-8 text-sm text-[var(--pp-muted)]">
          Your first Study Hall is on us — 60 minutes free, no credit card required.{" "}
          <Link href="/dashboard/student/book" className="font-medium text-[var(--pp-ink)] underline-offset-4 hover:underline">
            Book free session
          </Link>
          <span className="mt-1 block text-[#8a8376]">After your free session, you can book pay-as-you-go or save with prepaid hours.</span>
        </p>
      ) : null}

      {!data.parentPhone ? (
        <p className="mt-6 text-sm text-[#8a8376]">
          Add a number in{" "}
          <Link href="/dashboard/student/account" className="font-medium text-[var(--pp-muted)] underline-offset-4 hover:underline">
            Account
          </Link>
          .
        </p>
      ) : null}
    </ParentPage>
  );
}
