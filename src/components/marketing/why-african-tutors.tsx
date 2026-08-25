import Link from "next/link";

import { Container } from "@/components/ui/container";

/**
 * Habit / relief story — typography-forward, dark product moment.
 * Replaces lifestyle-photo-heavy “why” grid.
 */
export function WhyStudyHall() {
  return (
    <section id="why" className="scroll-mt-24 bg-ink-900 py-16 text-white sm:py-20">
      <Container size="wide">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-end lg:gap-16">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-gold-300">The routine</p>
            <h2 className="mkt-display mt-3 text-3xl sm:text-[2.5rem]">
              A homework habit — without the nightly battle.
            </h2>
            <p className="mt-5 text-[16px] leading-7 text-white/65">
              Session after session, your child practices sitting down, staying with the work, and
              finishing — with a Guide for presence, focus, and calm redirection.
            </p>
            <Link
              href="/pricing"
              className="mt-8 inline-flex text-[15px] font-semibold text-gold-300 transition-colors hover:text-gold-200"
            >
              See plans →
            </Link>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 sm:p-7">
            <p className="text-xs font-medium text-white/40">Study Hall streak</p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">5 days in a row</p>
            <p className="mt-3 text-sm leading-6 text-white/55">
              Maya’s building the habit — and you’re not negotiating homework every night.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

/** @deprecated Alias for older imports / tests — use WhyStudyHall. */
export function WhyAfricanTutors() {
  return <WhyStudyHall />;
}
