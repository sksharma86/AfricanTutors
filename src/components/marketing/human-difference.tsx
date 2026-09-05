import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

export function HumanDifference() {
  return (
    <section id="human-difference" className="scroll-mt-24 bg-white py-16 sm:py-24">
      <Container size="wide">
        <Reveal>
          <p className="mkt-eyebrow">The human difference</p>
          <h2 className="mkt-display mt-3 max-w-[18ch] text-4xl text-ink-900 sm:text-5xl">
            Answers are easy to find. Sitting down to work is harder.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <p className="max-w-md text-[16px] leading-7 text-ink-500">
              AI can help a student find an answer. Technology can help with information. A child
              still has to sit down and do the work.
            </p>
          </Reveal>
          <Reveal delay={70}>
            <p className="max-w-md font-display text-[1.55rem] font-semibold tracking-[-0.03em] text-ink-900 sm:text-[1.75rem]">
              Study Hall helps make sure there’s still a student sitting there doing the work.
            </p>
            <p className="mt-4 max-w-md text-[15px] leading-7 text-ink-500">
              A real human being expecting them to show up is what turns an hour into a routine.
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
