import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { InfoSplit } from "@/components/marketing/info-split";
import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "About",
  description:
    "Study Hall at Home is a managed service that gives families affordable, live homework supervision — helping kids build a dependable routine and giving parents their evenings back.",
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="Homework routines shouldn't run the whole evening."
        description="Study Hall at Home was built around a simple insight, and a better way to act on it."
      />

      <Container className="py-16">
        <div className="max-w-2xl space-y-6 text-base leading-7 text-ink-600">
          <p>
            Getting kids to sit down and finish their homework can take over the whole evening. Many
            families want dependable support and accountability, but private tutoring is expensive and
            more than most kids actually need.
          </p>
          <p>
            Study Hall at Home offers something simpler: live, supervised study time. A trained Guide
            keeps your children on task by video while they do their own schoolwork &mdash; affordable,
            online, and easy to make a routine. Every new household&apos;s{" "}
            <span className="font-semibold text-ink-900">first session is free</span>.
          </p>
          <p>
            Parents get relief from supervising homework every night. Kids get focus, accountability,
            and encouragement. Study Hall at Home manages everything in between.
          </p>
        </div>
      </Container>

      <InfoSplit
        eyebrow="How We Work"
        title="A professionally managed service."
        tone="muted"
      >
        <p>
          Study Hall at Home is not an open marketplace where families and Guides find each other
          independently. We recruit and approve every Guide, and manage scheduling and payments, so
          families always know who they&apos;re working with.
        </p>
        <p>
          This is homework supervision and accountability &mdash; not subject-by-subject tutoring.
          Guides keep kids focused and working; children bring their own assignments.
        </p>
      </InfoSplit>

      <CtaSection
        title="Interested in Study Hall at Home?"
        description="Start with a free session for your child, or apply to become a Guide."
        primaryLabel={FREE_TRIAL_CTA}
        secondaryHref="/apply-to-tutor"
        secondaryLabel="Become a Guide"
      />
    </>
  );
}
