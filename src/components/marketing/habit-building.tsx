import { Reveal } from "@/components/marketing/reveal";
import { WeekRhythm } from "@/components/marketing/week-rhythm";
import { Container } from "@/components/ui/container";

/**
 * Recurring Study Hall is the routine — not a path to graduating from the service.
 */
export function HabitBuilding() {
  return (
    <section id="habits" className="scroll-mt-24 bg-[#f7f6f3] py-16 sm:py-24">
      <Container size="wide">
        <div className="grid items-end gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <Reveal>
            <p className="mkt-eyebrow">Build the routine</p>
            <h2 className="mkt-display mt-3 max-w-[14ch] text-4xl text-ink-900 sm:text-5xl lg:text-[3.3rem]">
              One night becomes a routine.
            </h2>
            <p className="mt-3 font-display text-[1.65rem] font-semibold tracking-[-0.04em] text-ink-900 sm:text-3xl">
              A routine becomes a habit.
            </p>
            <p className="mt-6 max-w-md text-[16px] leading-7 text-ink-500">
              The days can change. The time can change. The work can change. The habit is showing up.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <WeekRhythm />
            <p className="mt-4 text-[13px] leading-6 text-ink-400">
              A sample week — completed, today, and scheduled. Not a live calendar.
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
