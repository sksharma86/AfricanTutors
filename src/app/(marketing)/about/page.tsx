import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "About",
  description:
    "Study Hall at Home is live homework supervision for families — helping kids build independent study habits and giving parents their evenings back.",
};

export default function AboutPage() {
  return (
    <div className="mkt-atmosphere">
      <PageHeader
        eyebrow="About"
        title="Homework shouldn’t own the night."
        description="We built Study Hall at Home for families who want accountability — without paying for tutoring they don’t need."
      />

      <Container size="wide" className="pb-20">
        <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <div className="max-w-xl space-y-5 text-[17px] leading-8 text-ink-600">
            <p>
              Getting kids to finish homework can take over the evening. Many families want dependable
              support — but private tutoring is expensive, and more than most kids need for ordinary
              schoolwork.
            </p>
            <p>
              Study Hall at Home is simpler: live supervised study time. A highly vetted Guide keeps
              your child on task by video while they do their own work. Affordable. Online. Easy to
              make a routine. Every new household’s{" "}
              <span className="font-semibold text-ink-900">first session is free</span>.
            </p>
            <p>
              Parents get relief. Kids get focus and accountability. We manage everything in between.
            </p>
          </div>

          <div className="border-t border-ink-100 pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12">
            <p className="mkt-eyebrow">How we work</p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink-900">
              A managed service — not a marketplace.
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-ink-500">
              <p>
                We recruit and approve every Guide, and we handle scheduling and payments. Families
                always know who they’re working with.
              </p>
              <p>
                This is homework supervision and accountability — not subject tutoring. Children bring
                their own assignments.
              </p>
              <p>
                Guides work remotely from Kenya and are carefully vetted and trained for Study Hall at
                Home.
              </p>
            </div>
          </div>
        </div>
      </Container>

      <CtaSection
        title="Ready to try it?"
        description="Start with a free session, or apply to become a Guide."
        primaryLabel={FREE_TRIAL_CTA}
        secondaryHref="/apply-to-tutor"
        secondaryLabel="Become a Guide"
      />
    </div>
  );
}
