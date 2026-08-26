import type { Metadata } from "next";
import Link from "next/link";

import { CtaSection } from "@/components/marketing/cta-section";
import { LiveStudyHallDemo } from "@/components/marketing/live-studyhall";
import { PageHeader } from "@/components/marketing/page-header";
import { Steps } from "@/components/marketing/steps";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "How live Study Hall works — from booking to report, including Call Parent and 60-day recordings.",
};

export default function HowItWorksPage() {
  return (
    <div className="mkt-atmosphere">
      <PageHeader
        eyebrow="How it works"
        title="Book. Study Hall. Done."
        description="We handle matching, scheduling, and the live session. Guides supervise and encourage — they do not tutor. You get reports, recordings, and Call Parent when your child needs you."
      />

      <Steps withHeader={false} />
      <LiveStudyHallDemo />

      <Container size="wide" className="pb-10">
        <div className="max-w-2xl border-t border-ink-100 pt-10">
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink-900">Fully managed</h2>
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
