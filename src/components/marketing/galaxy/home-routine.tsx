import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

const DAYS = [
  { day: "Mon", mark: "✓" },
  { day: "Tue", mark: "✓" },
  { day: "Wed", mark: "✓" },
  { day: "Thu", mark: "✓" },
  { day: "Fri", mark: "" },
] as const;

const WEEKS = ["Week 1", "Week 4", "Week 12"] as const;
const HABITS = ["Consistency", "Focus", "Organization", "Follow-through"] as const;

export function HomeRoutine() {
  return (
    <section id="routine" className="border-t border-[var(--g1-line)] py-20 sm:py-28">
      <Container size="wide">
        <Reveal>
          <h2 className="g1-display max-w-[16ch] text-[2.5rem] text-[var(--g1-ink)] sm:text-[3.5rem] lg:text-[4rem]">
            Homework is easier when the routine is already decided.
          </h2>
          <p className="g1-lede mt-6">Study Hall becomes part of the school week.</p>
        </Reveal>

        <Reveal delay={70}>
          <ol className="mt-14 flex max-w-2xl items-end justify-between gap-2">
            {DAYS.map((item) => (
              <li key={item.day} className="min-w-0 flex-1 text-center">
                <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--g1-subtle)] uppercase">{item.day}</p>
                <p className="g1-display mt-3 text-[1.8rem] text-[var(--g1-ink)] sm:text-[2.4rem]">
                  {item.mark || "·"}
                </p>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={100}>
          <ol className="mt-16 flex max-w-xl items-baseline gap-8 sm:gap-14">
            {WEEKS.map((week) => (
              <li key={week} className="g1-display text-[1.35rem] text-[var(--g1-ink)] sm:text-[1.7rem]">
                {week}
              </li>
            ))}
          </ol>
          <p className="mt-10 max-w-xl text-[15px] leading-7 text-[var(--g1-muted)]">{HABITS.join("  ·  ")}</p>
        </Reveal>
      </Container>
    </section>
  );
}
