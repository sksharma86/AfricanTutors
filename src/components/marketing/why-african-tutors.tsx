import Image from "next/image";

import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

export function WhyStudyHall() {
  return (
    <section id="parent-hour" className="relative overflow-hidden bg-ink-900 py-20 text-white sm:py-28">
      <Image
        src="/images/marketing/studyhall-routine-evening.webp"
        alt="A quieter evening at home while Study Hall is underway"
        fill
        sizes="100vw"
        className="object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-900/88 via-ink-900/70 to-ink-900/40" aria-hidden />

      <Container size="wide" className="relative z-10">
        <Reveal>
          <h2 className="mkt-display max-w-[14ch] text-4xl sm:text-5xl lg:text-[3.4rem]">
            Their hour to focus.
            <span className="mt-2 block text-white/58">Your hour to breathe.</span>
          </h2>
          <p className="mt-6 max-w-xl text-[17px] leading-8 text-white/78">
            For that hour you don’t have to ask if they started, tell them to put the phone down,
            or check whether they’re still working.
          </p>
          <p className="mt-8 max-w-md font-display text-[1.55rem] font-semibold tracking-[-0.03em] text-white">
            You be the parent.
            <span className="mt-1 block text-white/58">We’ll keep Study Hall on track.</span>
          </p>
        </Reveal>
      </Container>
    </section>
  );
}

/** @deprecated Alias for older imports / tests — use WhyStudyHall. */
export function WhyAfricanTutors() {
  return <WhyStudyHall />;
}
