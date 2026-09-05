import type { Metadata } from "next";
import Image from "next/image";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { Container } from "@/components/ui/container";
import { PUBLIC_OFFER_CTA_HREF, START_FREE_CTA } from "@/lib/public-offers";

export const metadata: Metadata = {
  title: "About",
  description: "Study Hall (at home) creates a dependable academic hour with human accountability.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mkt-atmosphere">
      <PageHeader
        title="Information is abundant. Focus still has to be practiced."
        description="Study Hall creates a dependable academic hour with a real human Guide — so children practice showing up, and parents spend less of the evening monitoring the work."
      />

      <Container size="wide" className="pb-16 sm:pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div className="max-w-xl space-y-5 text-[16px] leading-7 text-ink-600">
            <p>
              Study Hall (at home) is an independent company. We are not a tutoring marketplace and we are not African Tutors.
            </p>
            <p>
              The work on screen is the child’s. The Guide’s job is presence: a reason to sit down, a
              check on progress, and a calm redirect when attention drifts.
            </p>
          </div>
          <div className="relative aspect-[5/4] overflow-hidden bg-ink-900">
            <Image
              src="/images/student-tutoring-session.jpg"
              alt="A student working independently at home during Study Hall"
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover object-[30%_35%]"
            />
          </div>
        </div>

        <div className="mt-16 grid items-end gap-12 border-t border-ink-100 pt-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="mkt-display text-2xl text-ink-900">Guides</h2>
            <p className="mt-4 text-[16px] leading-7 text-ink-500">
              Every Guide is recruited, identity-checked, background-checked, and approved before
              leading a Study Hall. They work remotely from Kenya. Sessions stay on this platform.
              Parents can review the recording for 60 days.
            </p>
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
        description="Start with a free hour, or apply to become a Guide."
        primaryHref={PUBLIC_OFFER_CTA_HREF}
        primaryLabel={START_FREE_CTA}
        secondaryHref="/guides/apply"
        secondaryLabel="Become a Guide"
        showFinePrint={false}
      />
    </div>
  );
}
