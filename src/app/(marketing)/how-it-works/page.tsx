import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { Steps } from "@/components/marketing/steps";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "How It Works",
  description: "See how students and tutors connect and complete sessions on African Tutors.",
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="How It Works"
        title="A simple path from sign up to your first session."
        description="African Tutors handles matching, scheduling, and sessions in one place, so you can spend less time coordinating and more time learning."
      />

      <Steps
        title="For Students"
        steps={[
          {
            title: "Create an account",
            description: "Sign up with your email and set up a student profile.",
          },
          {
            title: "Share what you need",
            description: "Tell us the subject, level, and times that work for you.",
          },
          {
            title: "Get matched with a tutor",
            description: "We connect you with a qualified tutor for your subject.",
          },
          {
            title: "Meet online",
            description:
              "Join your session directly through African Tutors. Your first 30 minutes are free.",
          },
        ]}
      />

      <Steps
        title="For Tutors"
        steps={[
          {
            title: "Apply to teach",
            description: "Submit an application with your subjects and background.",
          },
          {
            title: "Get approved",
            description: "Our team reviews applications before granting tutor access.",
          },
          {
            title: "Set your availability",
            description: "Share the times you're available to teach.",
          },
          {
            title: "Teach and get paid",
            description: "Run sessions and track your earnings, all on the platform.",
          },
        ]}
      />

      <Container className="py-4">
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold text-ink-900">
            Everything stays on African Tutors
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">
            Messaging, scheduling, sessions, and payments all happen inside the platform.
            Students and tutors don&apos;t need to exchange personal contact information to work
            together.
          </p>
        </div>
      </Container>

      <CtaSection
        title="See it for yourself"
        description="Don't take our word for it &mdash; let your student experience a real tutor with a free 30-minute session."
        primaryLabel={FREE_TRIAL_CTA}
        secondaryHref="/pricing"
        secondaryLabel="View Pricing"
      />
    </>
  );
}
