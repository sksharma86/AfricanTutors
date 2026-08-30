import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

const ARC = [
  {
    stage: "Tonight",
    line: "Focused homework with a Guide present.",
  },
  {
    stage: "Routine",
    line: "Study Hall becomes a consistent part of the week.",
  },
  {
    stage: "Progress",
    line: "Better habits are reinforced every time they sit down to work.",
  },
] as const;

/**
 * Recurring Study Hall is the routine — not a path to graduating from the service.
 */
export function HabitBuilding() {
  return (
    <section id="habits" className="scroll-mt-24 bg-[#f7f6f3] pb-10 pt-14 sm:pb-12 sm:pt-16">
      <Container size="wide">
        <Reveal>
          <p className="mkt-eyebrow">More than homework supervision</p>
          <h2 className="mkt-display mt-3 max-w-[16ch] text-4xl text-ink-900 sm:text-5xl lg:text-[3.4rem]">
            The goal isn’t just to finish tonight’s homework.
          </h2>
          <p className="mt-5 max-w-[18ch] font-display text-[1.65rem] font-semibold tracking-[-0.04em] text-ink-900 sm:text-3xl">
            It’s to build a better student.
          </p>
          <p className="mt-6 max-w-xl text-[15px] leading-7 text-ink-500 sm:text-[16px]">
            Consistent Study Halls give homework dedicated time. Your child sits down, focuses,
            works through assignments, and finishes what they started, while their Guide stays
            present with encouragement and redirection.
          </p>
        </Reveal>

        <ol className="mt-12 sm:mt-16">
          {ARC.map((item, i) => (
            <Reveal key={item.stage} delay={i * 70}>
              <li className="relative grid gap-2 border-t border-ink-100 py-8 last:border-b sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-baseline sm:gap-10">
                <p className="font-display text-[1.85rem] font-semibold tracking-[-0.04em] text-ink-900 sm:text-[2.15rem]">
                  {item.stage}
                </p>
                <p className="max-w-md text-[16px] leading-7 text-ink-500 sm:text-[17px]">{item.line}</p>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={200}>
          <p className="mt-10 max-w-lg text-[16px] leading-7 text-ink-700 sm:text-[17px]">
            Better evenings now.
            <span className="mt-1 block text-ink-500">Better study habits over time.</span>
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
