import { CtaSection } from "@/components/marketing/cta-section";
import { FeatureGrid, type Feature } from "@/components/marketing/feature-grid";
import { GlobalAdvantageVisual } from "@/components/marketing/global-advantage-visual";
import { Hero } from "@/components/marketing/hero";
import { InfoSplit } from "@/components/marketing/info-split";
import { MissionVisual } from "@/components/marketing/mission-visual";
import { PriceHighlight } from "@/components/marketing/price-highlight";
import { Steps } from "@/components/marketing/steps";
import { SubjectsGrid } from "@/components/marketing/subjects-grid";

const whyAfricanTutors: Feature[] = [
  {
    title: "Real Human Tutors",
    description:
      "Every session is live and one-on-one with a real tutor \u2014 not a chatbot. Patient explanations and real accountability, every time.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 9.5 12 5l7.5 4.5-7.5 4.5-7.5-4.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V16c0 1 2.5 2.5 5 2.5s5-1.5 5-2.5v-4.5" />
      </svg>
    ),
  },
  {
    title: "Genuinely Affordable",
    description:
      "Consistent one-on-one tutoring can get expensive fast. Our global academic network lets us offer real tutoring for just $19.50 an hour.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M15.5 9.5c0-1.4-1.6-2.5-3.5-2.5s-3.5 1-3.5 2.4c0 3 7 1.4 7 4.3 0 1.5-1.6 2.6-3.5 2.6s-3.5-1-3.5-2.5" />
      </svg>
    ),
  },
  {
    title: "Fully Managed",
    description:
      "African Tutors selects, approves, and manages every tutor, and handles scheduling and payments from start to finish.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
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

const whyParentsChooseUs: Feature[] = [
  {
    title: "One-on-One Attention",
    description: "Every session is just your student and their tutor \u2014 no group classes, no distractions.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
        <circle cx="12" cy="8" r="3.25" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 19.5c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
      </svg>
    ),
  },
  {
    title: "Qualified, Approved Tutors",
    description: "Every tutor is reviewed and approved by our team before they teach a single session.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 9.5 12 5l7.5 4.5-7.5 4.5-7.5-4.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V16c0 1 2.5 2.5 5 2.5s5-1.5 5-2.5v-4.5" />
      </svg>
    ),
  },
  {
    title: "Just $19.50 an Hour",
    description: "Transparent, affordable pricing with no hidden fees and no long-term contract.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M15.5 9.5c0-1.4-1.6-2.5-3.5-2.5s-3.5 1-3.5 2.4c0 3 7 1.4 7 4.3 0 1.5-1.6 2.6-3.5 2.6s-3.5-1-3.5-2.5" />
      </svg>
    ),
  },
  {
    title: "Flexible Online Scheduling",
    description: "Book sessions that fit your family's schedule, and reschedule when life happens.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v3M17.25 3v3M4 8.25h16M5.5 6h13A1.5 1.5 0 0 1 20 7.5v11A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6Z" />
      </svg>
    ),
  },
  {
    title: "Professionally Managed",
    description: "African Tutors handles scheduling, payments, and support so you don't have to.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75A1.5 1.5 0 0 1 5.25 5.25h13.5a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H12l-3.75 3v-3H5.25a1.5 1.5 0 0 1-1.5-1.5v-7.5Z" />
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
        title="A smarter way to get real academic help."
        description="African Tutors is a professionally managed tutoring service, built around live, one-on-one instruction from carefully selected tutors."
        features={whyAfricanTutors}
      />

      <Steps
        eyebrow="How It Works"
        title="Getting started takes just a few minutes."
        steps={[
          {
            title: "Tell Us What You Need",
            description: "Share the subject and grade level your student needs help with.",
          },
          {
            title: "Choose a Convenient Time",
            description: "Pick a session time that works for your family's schedule.",
          },
          {
            title: "Meet Online",
            description: "Join a private, live one-on-one session through African Tutors.",
          },
          {
            title: "Keep Building Progress",
            description: "Book additional sessions whenever your student needs more support.",
          },
        ]}
      />

      <FeatureGrid
        eyebrow="Why Parents Choose Us"
        title="Personalized support parents can trust."
        features={whyParentsChooseUs}
      />

      <InfoSplit
        eyebrow="The Global Advantage"
        title="How we keep tutoring this affordable."
        tone="muted"
        visual={<GlobalAdvantageVisual />}
      >
        <p>
          Consistent, high-quality one-on-one tutoring can be surprisingly expensive in the
          United States. At the same time, there is tremendous academic talent throughout
          Africa &mdash; qualified educators ready to teach.
        </p>
        <p>
          African Tutors connects the two. By building a tutoring network with carefully
          selected African academics, we&apos;re able to offer live, one-on-one instruction at
          a price most American families can actually afford &mdash; without cutting corners
          on quality.
        </p>
      </InfoSplit>

      <SubjectsGrid
        eyebrow="Subjects"
        title="Support across the subjects that matter most."
        description="Popular subjects families request. Tell us what your student needs and we'll match a qualified tutor."
      />

      <PriceHighlight />

      <InfoSplit
        eyebrow="Our Mission"
        title="Opportunity, both ways."
        reverse
        visual={<MissionVisual />}
        ctaHref="/about"
        ctaLabel="Read Our Story"
      >
        <p>
          American families get consistent, affordable, one-on-one academic support &mdash;
          without the price tag traditional tutoring often carries.
        </p>
        <p>
          At the same time, talented academics across Africa gain access to meaningful, paid
          teaching opportunities. African Tutors manages the entire experience, so both sides
          can focus on what matters: learning.
        </p>
      </InfoSplit>

      <CtaSection
        title="Ready to get your student started?"
        description="Create a free account and book your student's first session with African Tutors."
        secondaryHref="/pricing"
        secondaryLabel="See Pricing"
      />
    </>
  );
}
