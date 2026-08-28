import Image from "next/image";

import { Container } from "@/components/ui/container";

/**
 * Lifestyle context only — what is happening at home.
 * Product UI (Guide-dominant session) lives in LiveStudyHallDemo.
 */
export function TrustRow() {
  return (
    <section aria-label="How Study Hall looks" className="bg-[#f7f6f3] py-16 sm:py-24">
      <Container size="wide">
        <div className="relative overflow-hidden rounded-[22px] bg-ink-900">
          <div className="relative aspect-[4/5] sm:aspect-[16/10] lg:aspect-[16/9]">
            <Image
              src="/images/marketing/studyhall-hero-desk.webp"
              alt="A home desk set up for homework during Study Hall"
              fill
              sizes="100vw"
              className="object-cover object-[40%_40%]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/20 to-ink-900/10" aria-hidden />
          </div>
        </div>

        <ol className="mt-8 grid gap-5 sm:grid-cols-3 sm:gap-8">
          <li>
            <p className="text-lg font-semibold tracking-[-0.03em] text-ink-900">Your child works.</p>
          </li>
          <li>
            <p className="text-lg font-semibold tracking-[-0.03em] text-ink-900">Their Guide stays present.</p>
          </li>
          <li>
            <p className="text-lg font-semibold tracking-[-0.03em] text-ink-900">You get your evening back.</p>
          </li>
        </ol>
      </Container>
    </section>
  );
}
