import { CtaSection } from "@/components/marketing/cta-section";
import { FeatureGrid, type Feature } from "@/components/marketing/feature-grid";
import { Hero } from "@/components/marketing/hero";
import { PricingTiers } from "@/components/marketing/pricing-tiers";
import { Steps } from "@/components/marketing/steps";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

const features: Feature[] = [
  {
    title: "Qualified Tutors",
    description:
      "Tutors are reviewed before joining the platform, so you're matched with someone equipped to help you learn.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 9.5 12 5l7.5 4.5-7.5 4.5-7.5-4.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V16c0 1 2.5 2.5 5 2.5s5-1.5 5-2.5v-4.5" />
      </svg>
    ),
  },
  {
    title: "Flexible Scheduling",
    description:
      "Book sessions around your school, work, or family schedule &mdash; and reschedule when life happens.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v3M17.25 3v3M4 8.25h16M5.5 6h13A1.5 1.5 0 0 1 20 7.5v11A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6Z" />
      </svg>
    ),
  },
  {
    title: "Everything Online",
    description:
      "Meet, message, and manage sessions in one place &mdash; no separate apps or shared contact details required.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75A1.5 1.5 0 0 1 5.25 5.25h13.5a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H12l-3.75 3v-3H5.25a1.5 1.5 0 0 1-1.5-1.5v-7.5Z" />
      </svg>
    ),
  },
  {
    title: "Affordable Access",
    description:
      "Your first 30-minute session is free. After that it's a flat $12 for 30 minutes or $20 for 60 &mdash; clear pricing, no hidden fees.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M15.5 9.5c0-1.4-1.6-2.5-3.5-2.5s-3.5 1-3.5 2.4c0 3 7 1.4 7 4.3 0 1.5-1.6 2.6-3.5 2.6s-3.5-1-3.5-2.5" />
      </svg>
    ),
  },
  {
    title: "Every Subject",
    description:
      "From core academics to test prep, find a tutor for the subjects that matter to you.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5V6.75A2.25 2.25 0 0 1 6.75 4.5h6.75l4.5 4.5v10.5a2.25 2.25 0 0 1-2.25 2.25H6.75a2.25 2.25 0 0 1-2.25-2.25Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5V9h4.5" />
      </svg>
    ),
  },
  {
    title: "Session History",
    description:
      "Keep a record of past sessions and progress, so you can look back on how far you've come.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2.5 2.5M20.25 12a8.25 8.25 0 1 1-3.4-6.65" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 4.5V8h-3.5" />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <>
      <Hero />

      <FeatureGrid
        eyebrow="Why African Tutors"
        title="Everything you need for focused, one-on-one learning."
        description="African Tutors is built so students can find help quickly and tutors can focus on teaching &mdash; without either side needing to manage scheduling, payments, or communication off platform."
        features={features}
      />

      <Steps
        eyebrow="How It Works"
        title="From sign up to session, in a few simple steps."
        steps={[
          {
            title: "Create an account",
            description: "Sign up as a student in minutes with just an email and password.",
          },
          {
            title: "Tell us what you need",
            description: "Share the subject and schedule you're looking for.",
          },
          {
            title: "Get matched",
            description: "We connect you with a qualified tutor available for your subject.",
          },
          {
            title: "Start with a free session",
            description:
              "Your first 30-minute session is free &mdash; meet online, no extra apps or card required.",
          },
        ]}
      />

      <PricingTiers />

      <CtaSection
        title="Ready to try your first session free?"
        description="Create a free account and book your student's free 30-minute session with a real tutor."
        primaryLabel={FREE_TRIAL_CTA}
      />
    </>
  );
}
