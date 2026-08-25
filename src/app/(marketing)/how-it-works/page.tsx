import type { Metadata } from "next";
import Link from "next/link";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { Steps } from "@/components/marketing/steps";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "How live Study Hall works — from signup to your first session with a highly vetted Guide.",
};

export default function HowItWorksPage() {
  return (
    <div className="mkt-atmosphere">
      <PageHeader
        eyebrow="How it works"
        title="From signup to Study Hall in minutes."
        description="We handle matching, scheduling, and the live session — so your family can build a calmer homework routine."
      />

      <Steps
        title="Three steps to your first session."
        steps={[
          {
            n: "1",
            title: "Create your account",
            description: "Add your child in a minute. No credit card for the free session.",
          },
          {
            n: "2",
            title: "Choose a time",
            description: "Pick a Study Hall that fits your evening. We match a highly vetted Guide.",
          },
          {
            n: "3",
            title: "Your child joins",
            description:
              "They open a private live session from home. The Guide keeps them on task. First hour free.",
          },
        ]}
      />

      <Container size="wide" className="pb-10">
        <div className="max-w-2xl border-t border-ink-100 pt-10">
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink-900">Fully managed</h2>
          <p className="mt-3 text-[15px] leading-7 text-ink-500">
            Scheduling, sessions, and payments run through Study Hall at Home. Every Guide is
            recruited, carefully vetted, and approved — you’re never left to find someone on your
            own.
          </p>
          <p className="mt-6 text-sm text-ink-400">
            Want to become a Guide?{" "}
            <Link href="/apply-to-tutor" className="font-medium text-ink-700 underline-offset-4 hover:underline">
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
