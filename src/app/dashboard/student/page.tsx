import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BalanceCards } from "@/components/dashboard/balance-cards";
import { ParentHashRedirect } from "@/components/dashboard/parent-hash-redirect";
import { ParentNextStudyHall } from "@/components/dashboard/parent-next-study-hall";
import { ParentPage } from "@/components/dashboard/parent-page";
import { ParentRecentActivity } from "@/components/dashboard/parent-recent-activity";
import { LinkButton } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { accountFreeTrialUsed } from "@/lib/free-trial.mjs";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
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
  const firstName = (user.displayName ?? "").split(" ")[0];

  return (
    <ParentPage>
      <ParentHashRedirect />
      <p className="text-sm text-ink-500">Your Study Hall account</p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">
        {firstName ? `Hi ${firstName}` : "Welcome"}
      </h1>

      <div className="mt-8">
        <ParentNextStudyHall next={next} bookings={data.bookings} />
      </div>

      <div className="mt-8 border-t border-ink-100 pt-6">
        <BalanceCards minutes={data.minutes} creditCents={data.creditCents} preferFreeSession={freeTrialAvailable} compact />
      </div>

      <div className="mt-8 border-t border-ink-100 pt-6">
        <ParentRecentActivity
          booking={last}
          report={last ? data.reportByBooking.get(last.id) ?? null : null}
          recording={last ? data.recordingByBooking.get(last.id) ?? null : null}
        />
      </div>

      {freeTrialAvailable ? (
        <section className="mt-8 border-t border-ink-100 pt-6">
          <p className="text-sm font-semibold text-ink-900">Your first Study Hall is on us</p>
          <p className="mt-1 text-sm text-ink-500">60 minutes free · No credit card required</p>
          <div className="mt-3">
            <LinkButton href="/dashboard/student/book" variant="primary" size="sm">
              Book free session
            </LinkButton>
          </div>
          <p className="mt-4 text-sm text-ink-500">After your free session, you can book pay-as-you-go or save with prepaid hours.</p>
        </section>
      ) : null}

      {!data.parentPhone ? (
        <p className="mt-8 text-sm text-ink-500">
          Add a phone number in{" "}
          <Link href="/dashboard/student/account" className="font-medium text-ink-800 underline-offset-4 hover:underline">
            Account
          </Link>{" "}
          so Study Hall (at home) can reach you if a Guide uses Call Parent during a session.
        </p>
      ) : null}
    </ParentPage>
  );
}
