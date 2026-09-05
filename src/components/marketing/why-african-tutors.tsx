import Image from "next/image";

import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

/**
 * The modern parent problem — familiar, not fearful.
 */
export function WhyStudyHall() {
  return (
    <section id="why" className="relative overflow-hidden bg-ink-900 py-16 text-white sm:py-28">
      <Image
        src="/images/marketing/studyhall-routine-evening.webp"
        alt="A quiet evening at home while a child is in Study Hall"
        fill
        sizes="100vw"
        className="object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/88 to-ink-900/55" aria-hidden />

      <Container size="wide" className="relative z-10">
        <Reveal>
          <p className="text-[13px] font-medium tracking-[0.16em] text-white/45 uppercase">The evening</p>
          <h2 className="mkt-display mt-3 max-w-[16ch] text-4xl sm:text-5xl">
            Academic work now competes with everything else.
          </h2>
          <p className="mt-5 max-w-xl text-[16px] leading-7 text-white/68">
            Phones. Social media. Games. Entertainment. The work is still there. The hour to do it
            keeps slipping.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-10 sm:mt-14 sm:gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-semibold tracking-[0.08em] text-white/40 uppercase">The familiar script</p>
            <ul className="mt-4 space-y-3 text-2xl font-semibold tracking-[-0.03em] text-white/55 sm:text-3xl">
              <li>“Did you start?”</li>
              <li>“What do you have due?”</li>
              <li>“Put the phone down.”</li>
              <li>“Are you still working?”</li>
              <li>“Did you finish?”</li>
            </ul>
          </Reveal>
          <Reveal delay={90}>
            <p className="text-sm font-semibold tracking-[0.08em] text-gold-300 uppercase">At Study Hall time</p>
            <ul className="mt-4 space-y-3 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
              <li>The child sits down.</li>
              <li>Their Guide shows up.</li>
              <li>The work begins.</li>
              <li>You’re available if needed.</li>
            </ul>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

/** @deprecated Alias for older imports / tests — use WhyStudyHall. */
export function WhyAfricanTutors() {
  return <WhyStudyHall />;
}
