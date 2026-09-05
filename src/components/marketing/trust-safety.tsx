import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

const PILLARS = [
  "Highly vetted Guides",
  "Live camera presence",
  "Sessions stay on the platform",
  "Recorded — parents can review for 60 days",
  "A short report after every Study Hall",
  "Call Parent without revealing your number",
] as const;

export function TrustSafety() {
  return (
    <section id="trust" className="bg-[#fcfaf6] py-20 sm:py-28">
      <Container size="wide">
        <Reveal>
          <h2 className="mkt-display max-w-[14ch] text-4xl text-ink-900 sm:text-5xl">
            Human presence. Visible safeguards.
          </h2>
          <p className="mt-5 max-w-xl text-[16px] leading-7 text-ink-500">
            AI can help a student find an answer. Study Hall helps make sure there’s still a
            student sitting there doing the work.
          </p>
        </Reveal>

        <ul className="mt-12 max-w-xl space-y-3 text-[16px] leading-7 text-ink-700">
          {PILLARS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
