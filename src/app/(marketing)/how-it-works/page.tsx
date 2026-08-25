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
    "See how live Study Hall works on Study Hall at Home — from signup to your first session with a highly vetted Guide.",
};

export default function HowItWorksPage() {
  return (
    <div className="mkt-atmosphere">
      <PageHeader
        eyebrow="How it works"
        title="A simple path from signup to Study Hall."
        description="Study Hall at Home handles matching, scheduling, and the live session — so your family can build a calm homework routine with less effort."
      />

      <Steps
        title="Three steps to your first session."
        steps={[
          {
            n: "01",
            title: "Create your account",
            description:
              "Create a free parent account and add your child. No credit card required — and there’s nothing to prepare.",
          },
          {
            n: "02",
            title: "Choose a convenient time",
            description: "Pick an available Study Hall time that works for your family’s schedule.",
          },
          {
            n: "03",
            title: "Meet your Guide online",
            description:
              "Your child joins a private, live Study Hall. A highly vetted Guide keeps them on task. Your first session is free.",
          },
        ]}
      />

      <Container size="wide" className="pb-8">
        <div className="max-w-2xl border-t border-ink-100 pt-12">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-ink-900">
            Fully managed by Study Hall at Home
          </h2>
          <p className="mt-4 text-base leading-7 text-ink-500">
            Scheduling, sessions, and payments all happen through Study Hall at Home. Every Guide is
            recruited, carefully vetted, and approved by our team — you’re never on your own to find
            and vet someone independently.
          </p>
          <p className="mt-8 text-sm text-ink-400">
            Interested in becoming a Guide instead?{" "}
            <Link href="/apply-to-tutor" className="font-medium text-ink-700 underline-offset-4 hover:underline">
              Become a Guide
            </Link>
            .
          </p>
        </div>
      </Container>

      <CtaSection
        title="See it for yourself"
        description="Let your child experience a real Study Hall with a Guide — your first session is free."
        primaryLabel={FREE_TRIAL_CTA}
        secondaryHref="/pricing"
        secondaryLabel="View pricing"
      />
    </div>
  );
}
