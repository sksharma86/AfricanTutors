import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/ui/container";

/**
 * Habit / routine story — full-bleed visual moment with restrained copy.
 * Replaces the old icon-card “Why African Tutors” grid.
 */
export function WhyStudyHall() {
  return (
    <section id="why" className="scroll-mt-24">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/images/marketing/studyhall-routine-evening.webp"
            alt="A calm evening at home while a child works through Study Hall"
            fill
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-ink-900/55" aria-hidden />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-ink-900/35 to-ink-900/25" aria-hidden />
        </div>

        <Container size="wide" className="flex min-h-[28rem] items-end py-20 sm:min-h-[32rem] sm:py-24 md:min-h-[36rem]">
          <div className="max-w-xl text-white">
            <p className="text-xs font-semibold tracking-[0.16em] text-gold-300 uppercase">The routine</p>
            <h2 className="mkt-display mt-4 text-4xl sm:text-5xl md:text-[3.25rem]">
              A homework habit that holds — without the nightly battle.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-white/80">
              Consistency is the product. Session after session, your child practices sitting down,
              staying with the work, and finishing — while a Guide provides presence, focus, and calm
              redirection.
            </p>
            <Link
              href="/pricing"
              className="mt-8 inline-flex items-center text-[15px] font-medium text-gold-200 transition-colors hover:text-gold-100"
            >
              See pricing for a steady routine
              <span aria-hidden className="ml-1.5">
                →
              </span>
            </Link>
          </div>
        </Container>
      </div>
    </section>
  );
}

/** @deprecated Alias for older imports / tests — use WhyStudyHall. */
export function WhyAfricanTutors() {
  return <WhyStudyHall />;
}
