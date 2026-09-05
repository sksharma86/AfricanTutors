import Image from "next/image";

import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

export function ParentRelief() {
  return (
    <section id="parent-hour" className="relative overflow-hidden bg-ink-900 py-16 text-white sm:py-24">
      <Image
        src="/images/marketing/studyhall-routine-evening.webp"
        alt="A parent with a quieter hour while Study Hall is underway"
        fill
        sizes="100vw"
        className="object-cover opacity-28"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/90 to-ink-900/70" aria-hidden />

      <Container size="wide" className="relative z-10">
        <Reveal>
          <p className="text-[13px] font-medium tracking-[0.16em] text-gold-300 uppercase">
            Their hour. Your hour.
          </p>
          <h2 className="mkt-display mt-3 max-w-[16ch] text-4xl sm:text-5xl lg:text-[3.35rem]">
            Their hour to focus.
            <span className="mt-2 block text-white/62">Your hour to breathe.</span>
          </h2>
          <p className="mt-6 max-w-xl text-[16px] leading-7 text-white/72">
            And while they build better habits, you get an hour back.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <p className="text-sm font-semibold tracking-[0.08em] text-white/40 uppercase">For one hour</p>
            <ul className="mt-4 space-y-3 text-[1.35rem] font-semibold tracking-[-0.03em] text-white/80 sm:text-2xl">
              <li>You don’t have to be the bad guy.</li>
              <li>You don’t have to tell them to put the phone down.</li>
              <li>You don’t have to keep asking whether they’ve started.</li>
              <li>You don’t have to check whether they’re still working.</li>
            </ul>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-sm font-semibold tracking-[0.08em] text-gold-300 uppercase">The Guide is there for that</p>
            <p className="mt-4 max-w-md text-[16px] leading-7 text-white/74">
              Live human presence, accountability, progress checking, encouragement, and
              redirection. You remain the parent. We keep Study Hall on track.
            </p>
            <p className="mt-6 font-display text-[1.45rem] font-semibold tracking-[-0.03em] text-white sm:text-[1.65rem]">
              You be the parent.
              <span className="mt-1 block text-white/62">We’ll keep Study Hall on track.</span>
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
