import { CtaSection } from "@/components/marketing/cta-section";
import { GlobalAdvantageVisual } from "@/components/marketing/global-advantage-visual";
import { Hero } from "@/components/marketing/hero";
import { InfoSplit } from "@/components/marketing/info-split";
import { MissionVisual } from "@/components/marketing/mission-visual";
import { PhotoFrame } from "@/components/marketing/photo-frame";
import { PricingTiers } from "@/components/marketing/pricing-tiers";
import { Steps } from "@/components/marketing/steps";
import { SubjectsPreview } from "@/components/marketing/subjects-preview";
import { ValueList, type ValueItem } from "@/components/marketing/value-list";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

const qualityPoints: ValueItem[] = [
  {
    title: "A real tutor, not a chatbot",
    description:
      "AI can explain a concept. A great tutor notices when a student still isn't getting it, and adjusts. Every session is live and one-on-one.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 9.5 12 5l7.5 4.5-7.5 4.5-7.5-4.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V16c0 1 2.5 2.5 5 2.5s5-1.5 5-2.5v-4.5" />
      </svg>
    ),
  },
  {
    title: "Selected and approved",
    description: "Every tutor is reviewed by our team before they teach a single session.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-5 w-5">
        <circle cx="10" cy="10" r="8.25" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 10.25 9 12.75l4.5-5.5" />
      </svg>
    ),
  },
  {
    title: "Fully managed by African Tutors",
    description: "We handle scheduling and payments, so you can focus on your student's progress.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-5 w-5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3.75c3 1.5 5.25 1.75 7.5 1.75 0 8-3 12-7.5 14.75C7.5 17.5 4.5 13.5 4.5 5.5c2.25 0 4.5-.25 7.5-1.75Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.25 12.25 11.5 14.5l3.25-4.5" />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <>
      <Hero />

      <InfoSplit
        eyebrow="Why African Tutors"
        title="A real tutor, not a chatbot."
        visual={
          <PhotoFrame
            src="/images/student-tutoring-session.jpg"
            alt="A student engaged in a live online tutoring session at home"
          />
        }
      >
        <ValueList items={qualityPoints} />
      </InfoSplit>

      <Steps
        eyebrow="How It Works"
        title="Getting started takes just a few minutes."
        steps={[
          {
            title: "Tell Us What You Need",
            description: "Share the subject and grade level your student needs help with.",
          },
          {
            title: "Choose a Time",
            description: "Pick a session time that works for your family.",
          },
          {
            title: "Meet Online",
            description: "Join a private, live one-on-one session through African Tutors.",
          },
          {
            title: "Keep Building Progress",
            description: "Book more sessions whenever your student needs support.",
          },
        ]}
      />

      <SubjectsPreview />

      <PricingTiers />

      <InfoSplit
        eyebrow="The Global Advantage"
        title="How we keep tutoring this affordable."
        tone="muted"
        visual={<GlobalAdvantageVisual />}
      >
        <p>
          Consistent, one-on-one tutoring can be surprisingly expensive in the United States.
          African Tutors builds its network from the tremendous academic talent across Africa
          instead &mdash; live, one-on-one instruction at a price most families can actually
          afford.
        </p>
      </InfoSplit>

      <InfoSplit
        eyebrow="Our Mission"
        title="Academic talent has no borders."
        reverse
        visual={<MissionVisual />}
        ctaHref="/about"
        ctaLabel="Read Our Story"
      >
        <p>
          American families get affordable, one-on-one academic support. Talented academics
          across Africa get access to meaningful, paid teaching work. African Tutors manages
          the experience in between, so both sides can focus on learning.
        </p>
      </InfoSplit>

      <CtaSection
        title="Ready to get your student started?"
        description="Create a free account and book your student's free 30-minute session with a real tutor."
        primaryLabel={FREE_TRIAL_CTA}
        secondaryHref="/pricing"
        secondaryLabel="See Pricing"
      />
    </>
  );
}
