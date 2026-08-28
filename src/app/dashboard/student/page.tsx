import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BalanceCards } from "@/components/dashboard/balance-cards";
import { ParentHashRedirect } from "@/components/dashboard/parent-hash-redirect";
import { ParentNextStep } from "@/components/dashboard/parent-next-step";
import { ParentNextStudyHall } from "@/components/dashboard/parent-next-study-hall";
import { ParentPage } from "@/components/dashboard/parent-page";
import { ParentRecentActivity } from "@/components/dashboard/parent-recent-activity";
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
    await notifyWelcome(user.id, user.displayName ?? user.email ?? null);
  } catch {
    /* best-effort — never block dashboard */
  }

  const data = await loadParentWorkspace(supabase!, user.id);
  const freeTrialAvailable = !accountFreeTrialUsed(data.bookings);
  const { next } = parentStudyHallLists(data.bookings);
  const last = lastCompletedStudyHall(data.bookings);
  const lastReport = last ? data.reportByBooking.get(last.id) ?? null : null;
  const nextStep = parentPostSessionOffer({
    bookings: data.bookings,
    last,
    report: lastReport,
    minutes: data.minutes,
  });
  const firstName = (user.displayName ?? "").split(" ")[0];

  return (
    <ParentPage>
      <ParentHashRedirect />
      <h1 className="font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-ink-900 sm:text-[2rem]">
        {firstName ? `Hi ${firstName}` : "Welcome"}
      </h1>

      <div className="mt-3.5">
        <ParentNextStudyHall next={next} />
      </div>

      <div className="mt-3.5">
        <BalanceCards minutes={data.minutes} creditCents={data.creditCents} preferFreeSession={freeTrialAvailable} compact />
      </div>

      {last ? (
        <div className="mt-5">
          <ParentRecentActivity
            booking={last}
            report={lastReport}
            recording={data.recordingByBooking.get(last.id) ?? null}
          />
        </div>
      ) : null}

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

      {freeTrialAvailable ? (
        <p className="mt-8 text-sm text-ink-500">
          Your first Study Hall is on us — 60 minutes free, no credit card required.{" "}
          <Link href="/dashboard/student/book" className="font-medium text-ink-800 underline-offset-4 hover:underline">
            Book free session
          </Link>
          <span className="mt-1 block text-ink-400">After your free session, you can book pay-as-you-go or save with prepaid hours.</span>
        </p>
      ) : null}

      {!data.parentPhone ? (
        <p className="mt-6 text-sm text-ink-400">
          Add a number in{" "}
          <Link href="/dashboard/student/account" className="font-medium text-ink-600 underline-offset-4 hover:underline">
            Account
          </Link>
          .
        </p>
      ) : null}
    </ParentPage>
  );
}
