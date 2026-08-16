import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { InfoSplit } from "@/components/marketing/info-split";
import { MissionVisual } from "@/components/marketing/mission-visual";
import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "About",
  description:
    "African Tutors is a managed online tutoring company connecting American families with carefully selected African academics for live, one-on-one tutoring.",
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="Academic talent has no borders."
        description="African Tutors was built around a simple insight, and a better way to act on it."
      />

      <Container className="py-16">
        <div className="max-w-2xl space-y-6 text-base leading-7 text-ink-600">
          <p>
            There is tremendous academic talent throughout Africa. At the same time, many
            American families want consistent, personalized tutoring but run into high prices
            for traditional one-on-one instruction.
          </p>
          <p>
            African Tutors bridges those two realities: we built a company around recruiting,
            approving, and managing a network of skilled African academics, and connecting
            them with American students who need one-on-one support &mdash; live, online, and
            genuinely affordable. Every new student&apos;s{" "}
            <span className="font-semibold text-ink-900">first 30-minute session is free</span>.
          </p>
          <p>
            Families get affordable, personal academic support from a real tutor. Talented
            academics get meaningful, paid teaching work. African Tutors manages everything in
            between, so both sides can focus on learning.
          </p>
        </div>
      </Container>

      <InfoSplit
        eyebrow="How We Work"
        title="A professionally managed tutoring company."
        tone="muted"
        visual={<MissionVisual />}
      >
        <p>
          African Tutors is not an open marketplace where students and tutors find each other
          independently. We recruit and approve every tutor, and manage scheduling and
          payments, so families always know who they&apos;re working with.
        </p>
        <p>
          That structure lets us stand behind the quality of every session, and lets tutors
          focus on teaching.
        </p>
      </InfoSplit>

      <CtaSection
        title="Interested in African Tutors?"
        description="Start with a free 30-minute session for your student, or apply to join our tutor network."
        primaryLabel={FREE_TRIAL_CTA}
        secondaryHref="/apply-to-tutor"
        secondaryLabel="Apply to Tutor"
      />
    </>
  );
}
