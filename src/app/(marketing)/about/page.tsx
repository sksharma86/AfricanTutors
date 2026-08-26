import type { Metadata } from "next";

import Image from "next/image";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "About",
  description:
    "Study Hall (at home) is live homework supervision for families — helping kids build independent study habits and giving parents their evenings back.",
};

export default function AboutPage() {
  return (
    <div className="mkt-atmosphere">
      <PageHeader
        eyebrow="About"
        title="Homework shouldn’t own the night."
        description="Study Hall (at home) is for families who want accountability — without paying for tutoring they don’t need."
      />

      <Container size="wide" className="pb-16 sm:pb-20">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div className="max-w-xl space-y-5 text-[16px] leading-7 text-ink-600">
            <p>
              Getting kids to finish homework can take over the evening. Private tutoring is
              expensive — and more than most kids need for ordinary schoolwork.
            </p>
            <p>
              Study Hall (at home) is simpler: live supervised study time. A highly vetted Guide keeps
              your child on task by video while they do their own work. Every new household’s{" "}
              <span className="font-semibold text-ink-900">first session is free</span>.
            </p>
            <p>Parents get their evening back. Kids get focus and accountability.</p>
          </div>

          <div className="relative aspect-[5/4] overflow-hidden bg-ink-900 lg:aspect-auto lg:min-h-[22rem]">
            <Image
              src="/images/student-tutoring-session.jpg"
              alt="A student working independently at home during Study Hall"
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover object-[30%_35%]"
            />
          </div>
        </div>

        <div className="mt-16 grid items-end gap-12 border-t border-ink-100 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <p className="mkt-eyebrow">How we work</p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink-900">
              A managed service — not a marketplace.
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-ink-500">
              <p>
                We recruit and approve every Guide, and we handle scheduling and payments.
              </p>
              <p>
                This is homework supervision — not subject tutoring. Children bring their own
                assignments.
              </p>
              <p>
                Guides work remotely from Kenya and are carefully vetted and trained for Study Hall
                (at home).
              </p>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden bg-ink-900">
            <Image
              src="/images/tutor-portrait.jpg"
              alt="A Guide working remotely during a live Study Hall"
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover object-[50%_18%]"
            />
          </div>
        </div>
      </Container>

      <CtaSection
        title="Ready to try it?"
        description="Start with a free session, or apply to become a Guide."
        primaryLabel={FREE_TRIAL_CTA}
        secondaryHref="/guides/apply"
        secondaryLabel="Become a Guide"
      />
    </div>
  );
}
