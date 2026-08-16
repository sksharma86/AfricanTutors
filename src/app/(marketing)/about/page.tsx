import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "About",
  description: "African Tutors is an online tutoring platform connecting students with qualified tutors.",
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="A modern platform for one-on-one online tutoring."
        description="African Tutors connects students with qualified tutors for convenient, focused academic support, entirely online."
      />

      <Container className="py-16">
        <div className="max-w-2xl space-y-6 text-base leading-7 text-ink-600">
          <p>
            African Tutors was built to make it easy for students to find and work with
            qualified tutors, and for tutors to teach without the overhead of managing
            scheduling, payments, and communication across multiple tools.
          </p>
          <p>
            Every part of a tutoring relationship &mdash; from the first conversation to
            scheduling, sessions, and payment &mdash; is designed to happen on the platform.
            That keeps things simple and consistent for both students and tutors.
          </p>
          <p>
            We&apos;re in the early stages of building African Tutors and are focused on
            getting the fundamentals right before expanding to more features.
          </p>
        </div>
      </Container>

      <CtaSection
        title="Interested in African Tutors?"
        description="Create an account to get started as a student, or apply to teach as a tutor."
      />
    </>
  );
}
