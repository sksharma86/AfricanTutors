import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

const POINTS = [
  { word: "One child", line: "No group classroom." },
  { word: "One Guide", line: "Dedicated to your child for the session." },
  { word: "One hour", line: "Focused homework time." },
] as const;

export function HomeOneToOne() {
  return (
    <section id="one-to-one" className="border-t border-[var(--g1-line)] py-20 sm:py-28">
      <Container size="wide">
        <Reveal>
          <h2 className="g1-display max-w-[12ch] text-[2.6rem] text-[var(--g1-ink)] sm:text-[3.6rem] lg:text-[4.2rem]">
            A personal Study Hall, right at home.
          </h2>
          <div className="mt-8 max-w-2xl space-y-4 text-[17px] leading-8 text-[var(--g1-muted)] sm:text-[18px]">
            <p>Some nights children already know what they need to work on.</p>
            <p>They don’t necessarily need another lesson. They need someone present to keep the session structured and moving.</p>
            <p className="font-medium text-[var(--g1-ink)]">Every Study Hall is private and one-to-one.</p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <ul className="mt-16 grid gap-10 sm:grid-cols-3 sm:gap-0">
            {POINTS.map((item, i) => (
              <li
                key={item.word}
                className={i === 0 ? "sm:pr-10" : "sm:border-l sm:border-[var(--g1-line)] sm:px-10"}
              >
                <p className="g1-display text-[2rem] text-[var(--g1-ink)] sm:text-[2.35rem]">{item.word}</p>
                <p className="mt-3 text-[15px] leading-7 text-[var(--g1-muted)]">{item.line}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}
