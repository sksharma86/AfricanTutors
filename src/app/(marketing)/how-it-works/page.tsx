import type { Metadata } from "next";
import Link from "next/link";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { Steps } from "@/components/marketing/steps";
import { Container } from "@/components/ui/container";
import { HOURLY_RATE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "How It Works",
  description: "See how live one-on-one tutoring works on African Tutors, from sign up to session.",
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="How It Works"
        title="A simple, managed path from sign up to your first session."
        description="African Tutors handles matching, scheduling, and sessions in one place, so you can spend less time coordinating and more time learning."
      />

      <Steps
        title="From sign up to your first session."
        steps={[
          {
            title: "Tell Us What You Need",
            description: "Create a free account and share the subject and grade level your student needs help with.",
          },
          {
            title: "Choose a Convenient Time",
            description: "Pick an available tutoring session time that works for your family's schedule.",
          },
          {
            title: "Meet Online",
            description: "Join a private, live one-on-one session with your tutor through African Tutors.",
          },
          {
            title: "Keep Building Progress",
            description: "Book additional sessions whenever your student needs more support.",
          },
        ]}
      />

      <Container className="py-4">
        <div className="rounded-2xl border border-gold-200 bg-gold-50 p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold text-ink-900">
            Fully managed by African Tutors
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">
            Messaging, scheduling, sessions, and payments all happen through African Tutors.
            Every tutor is recruited, reviewed, and approved by our team &mdash; you&apos;re
            never on your own to find and vet a tutor independently.
          </p>
        </div>
      </Container>

      <Container className="py-8">
        <p className="text-sm text-ink-400">
          Interested in teaching with African Tutors instead?{" "}
          <Link href="/apply-to-tutor" className="font-medium text-gold-700 hover:underline">
            Apply to tutor
          </Link>
          .
        </p>
      </Container>

      <CtaSection
        title="See it for yourself"
        description={`Create a free account and book your student's first session for ${HOURLY_RATE} an hour.`}
        secondaryHref="/pricing"
        secondaryLabel="View Pricing"
      />
    </>
  );
}
