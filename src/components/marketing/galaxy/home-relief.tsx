import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

const LINES = ["No more hovering.", "No more nightly negotiations.", "No more wondering whether it got done."] as const;

export function HomeRelief() {
  return (
    <section id="relief" className="py-24 sm:py-36">
      <Container size="wide">
        <Reveal>
          <p className="g1-kicker">For the parent</p>
        </Reveal>
        <div className="mt-10 space-y-16 sm:space-y-24">
          {LINES.map((line, i) => (
            <Reveal key={line} delay={i * 50}>
              <p className="g1-display max-w-[14ch] text-[2.6rem] text-[var(--g1-ink)] sm:text-[4rem] lg:text-[4.6rem]">
                {line}
              </p>
            </Reveal>
          ))}
        </div>
        <Reveal delay={80}>
          <p className="mt-16 max-w-md text-[17px] leading-8 text-[var(--g1-muted)]">The parent gets their evening back.</p>
        </Reveal>
      </Container>
    </section>
  );
}
