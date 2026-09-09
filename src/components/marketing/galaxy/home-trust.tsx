import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

const POINTS = [
  "Highly vetted Guides",
  "Recorded Study Halls",
  "Parent access to recordings for 60 days",
  "Parents remain nearby and available",
  "Clear communication boundaries",
] as const;

export function HomeTrust() {
  return (
    <section id="trust" className="bg-[var(--g1-dark)] py-20 text-white sm:py-28">
      <Container size="wide">
        <Reveal>
          <h2 className="g1-display max-w-[14ch] text-[2.6rem] sm:text-[3.6rem] lg:text-[4.2rem]">
            Built for your home.
            <span className="mt-2 block text-white/55">Designed around your child.</span>
          </h2>
        </Reveal>
        <Reveal delay={70}>
          <ul className="mt-14 max-w-lg space-y-4 text-[17px] leading-8 text-white/72">
            {POINTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}
