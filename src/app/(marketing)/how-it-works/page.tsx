import type { Metadata } from "next";
import Link from "next/link";

import { CtaSection } from "@/components/marketing/cta-section";
import { HowStudyHallWorks } from "@/components/marketing/how-study-hall-works";
import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";
import { HOW_IT_WORKS_HOUSEHOLD } from "@/lib/household-pricing-copy.mjs";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "How live Study Hall works — choose a time, Plan, Focus, Finish, then a Guide report and 60-day recording.",
};

export default function HowItWorksPage() {
  return (
    <div className="mkt-atmosphere">
      <PageHeader
        eyebrow="How it works"
        title="Choose a time. Use the hour."
        description="Pick a day that works. Your child joins from home. The hour follows Plan, Focus, and Finish. You get a report, a recording, and the option to do it again."
      />

      <HowStudyHallWorks showHeadline={false} />

      <Container size="wide" className="pb-10">
        <div className="max-w-2xl border-t border-ink-100 pt-10">
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink-900">Then repeat, when it helps</h2>
          <p className="mt-3 text-[15px] leading-7 text-ink-500">
            Consistency is how an hour becomes a routine. That does not mean every family uses Study
            Hall every day, or at the same time. Book the days that fit. Skip the ones that don’t.
          </p>
          <h2 className="mt-10 text-xl font-semibold tracking-[-0.03em] text-ink-900">One Study Hall for the household</h2>
          <p className="mt-3 text-[15px] leading-7 text-ink-500">{HOW_IT_WORKS_HOUSEHOLD}</p>
          <h2 className="mt-10 text-xl font-semibold tracking-[-0.03em] text-ink-900">Fully managed</h2>
          <p className="mt-3 text-[15px] leading-7 text-ink-500">
            Scheduling, sessions, and payments run through Study Hall (at home). Every Guide is
            recruited, carefully vetted, and approved — you’re never left to find someone on your
            own.
          </p>
          <p className="mt-6 text-sm text-ink-400">
            Want to become a Guide?{" "}
            <Link href="/guides/apply" className="font-medium text-ink-700 underline-offset-4 hover:underline">
              Apply here
            </Link>
            .
          </p>
        </div>
      </Container>

      <CtaSection
        title="See it for yourself."
        description="Book a real Study Hall with a Guide — your first hour is free."
        primaryLabel={FREE_TRIAL_CTA}
        secondaryHref="/pricing"
        secondaryLabel="View pricing"
      />
    </div>
  );
}
