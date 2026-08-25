import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "About",
  description:
    "Study Hall at Home is a managed service that gives families live homework supervision — helping kids build a dependable routine and giving parents their evenings back.",
};

export default function AboutPage() {
  return (
    <div className="mkt-atmosphere">
      <PageHeader
        eyebrow="About"
        title="Homework shouldn’t own the whole evening."
        description="Study Hall at Home was built around a simple insight — and a calmer way to act on it."
      />

      <Container size="wide" className="pb-20">
        <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-24">
          <div className="max-w-xl space-y-6 text-base leading-8 text-ink-600">
            <p>
              Getting kids to sit down and finish homework can take over the night. Many families want
              dependable support and accountability, but private tutoring is expensive — and more than
              most kids actually need for ordinary schoolwork.
            </p>
            <p>
              Study Hall at Home offers something simpler: live, supervised study time. A highly vetted
              Guide keeps your child on task by video while they do their own schoolwork — affordable,
              online, and easy to make a routine. Every new household’s{" "}
              <span className="font-semibold text-ink-900">first session is free</span>.
            </p>
            <p>
              Parents get relief from supervising homework every night. Kids get focus, accountability,
              and encouragement. Study Hall at Home manages everything in between.
            </p>
          </div>

          <div className="border-t border-ink-100 pt-10 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12">
            <p className="mkt-eyebrow">How we work</p>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-ink-900">
              A professionally managed service.
            </h2>
            <div className="mt-5 space-y-5 text-[15px] leading-7 text-ink-500">
              <p>
                Study Hall at Home is not an open marketplace. We recruit and approve every Guide, and
                manage scheduling and payments, so families always know who they’re working with.
              </p>
              <p>
                This is homework supervision and accountability — not subject-by-subject tutoring.
                Guides keep kids focused and working; children bring their own assignments.
              </p>
              <p>
                Guides work remotely from Kenya and are carefully vetted and trained specifically for
                Study Hall at Home. Their role is presence, encouragement, redirection, and
                accountability.
              </p>
            </div>
          </div>
        </div>
      </Container>

      <CtaSection
        title="Interested in Study Hall at Home?"
        description="Start with a free session for your child, or apply to become a Guide."
        primaryLabel={FREE_TRIAL_CTA}
        secondaryHref="/apply-to-tutor"
        secondaryLabel="Become a Guide"
      />
    </div>
  );
}
