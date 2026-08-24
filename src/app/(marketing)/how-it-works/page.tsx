import type { Metadata } from "next";
import Link from "next/link";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { Steps } from "@/components/marketing/steps";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "How It Works",
  description: "See how live homework supervision works on Study Hall at Home, from sign up to session.",
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="How It Works"
        title="A simple, managed path from sign up to your first Study Hall."
        description="Study Hall at Home handles matching, scheduling, and sessions in one place, so your family can build a calm homework routine with less effort."
      />

      <Steps
        title="From sign up to your first Study Hall."
        steps={[
          {
            title: "Create your account",
            description: "Create a free parent account and add your child. No credit card required — and there's nothing to prepare.",
          },
          {
            title: "Choose a convenient time",
            description: "Pick an available Study Hall time that works for your family's schedule.",
          },
          {
            title: "Meet your Guide online",
            description: "Your child joins a private, live Study Hall with a Guide who keeps them on task. Your first session is free.",
          },
          {
            title: "Build a routine",
            description: "Book more sessions whenever your family needs them, or save with prepaid hours.",
          },
        ]}
      />

      <Container className="py-4">
        <div className="rounded-2xl border border-gold-200 bg-gold-50 p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold text-ink-900">
            Fully managed by Study Hall at Home
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">
            Scheduling, sessions, and payments all happen through Study Hall at Home. Every Guide is
            recruited, reviewed, and approved by our team &mdash; you&apos;re never on your own to
            find and vet someone independently.
          </p>
        </div>
      </Container>

      <Container className="py-8">
        <p className="text-sm text-ink-400">
          Interested in becoming a Guide instead?{" "}
          <Link href="/apply-to-tutor" className="font-medium text-gold-700 hover:underline">
            Become a Guide
          </Link>
          .
        </p>
      </Container>

      <CtaSection
        title="See it for yourself"
        description="Let your child experience a real Study Hall with a Guide — your first session is free."
        primaryLabel={FREE_TRIAL_CTA}
        secondaryHref="/pricing"
        secondaryLabel="View Pricing"
      />
    </>
  );
}
