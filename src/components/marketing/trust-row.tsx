import Image from "next/image";

import { Container } from "@/components/ui/container";

/**
 * One visual explanation of Study Hall — child at work, Guide present, evening back.
 * A single composition, not stacked stock photos.
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

            <div className="absolute top-4 right-4 w-[38%] max-w-[11rem] overflow-hidden rounded-xl border border-white/15 bg-[#12141a] shadow-[0_18px_40px_-20px_rgba(0,0,0,0.7)] sm:top-6 sm:right-6 sm:max-w-[13rem]">
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-[10px] font-medium tracking-[0.08em] text-white/45 uppercase">Guide</p>
                <span className="inline-flex items-center gap-1 text-[10px] text-white/55">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  Live
                </span>
              </div>
              <div className="relative aspect-[4/3] bg-[#1a1c22]">
                <div
                  className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(201,136,22,0.28),transparent_58%)]"
                  aria-hidden
                />
                <p className="absolute inset-x-0 bottom-0 px-3 pb-2.5 text-[12px] font-medium text-white/90">
                  Present on video
                </p>
              </div>
            </div>
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
