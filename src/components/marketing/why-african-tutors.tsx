import Image from "next/image";

import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

/**
 * Parent-relief contrast — photography + typography. No shame, no cards.
 */
export function WhyStudyHall() {
  return (
    <section id="why" className="relative overflow-hidden bg-ink-900 py-20 text-white sm:py-28">
      <Image
        src="/images/marketing/studyhall-routine-evening.webp"
        alt="A calm evening at home after homework is underway"
        fill
        sizes="100vw"
        className="object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/88 to-ink-900/55" aria-hidden />

      <Container size="wide" className="relative z-10">
        <Reveal>
          <p className="text-[13px] font-medium tracking-[0.16em] text-white/45 uppercase">The evening</p>
          <h2 className="mkt-display mt-3 max-w-[14ch] text-4xl sm:text-5xl">
            Less checking. More breathing room.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-semibold tracking-[0.08em] text-white/40 uppercase">Before</p>
            <ul className="mt-4 space-y-3 text-2xl font-semibold tracking-[-0.03em] text-white/55 sm:text-3xl">
              <li>“Did you start?”</li>
              <li>“Are you working?”</li>
              <li>“Put the phone down.”</li>
              <li>“Finish your homework.”</li>
            </ul>
          </Reveal>
          <Reveal delay={90}>
            <p className="text-sm font-semibold tracking-[0.08em] text-gold-300 uppercase">After</p>
            <ul className="mt-4 space-y-3 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
              <li>The hour is booked.</li>
              <li>The Guide is present.</li>
              <li>You’re available if needed.</li>
              <li>The evening is yours again.</li>
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
