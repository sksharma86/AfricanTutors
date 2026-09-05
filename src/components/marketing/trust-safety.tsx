import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

const PILLARS = [
  {
    title: "Highly vetted Guides",
    body: "Every Guide is reviewed and approved before they work with families.",
  },
  {
    title: "Private, on-platform sessions",
    body: "Study Halls happen inside the platform. Sessions stay on Study Hall rather than through personal contact.",
  },
  {
    title: "Live camera presence",
    body: "Your child and their Guide remain on camera for the hour so the session stays present and accountable.",
  },
  {
    title: "Recorded for safety",
    body: "Sessions are recorded for quality and safety. Parents can review completed Study Halls for 60 days.",
  },
  {
    title: "Parent contact when needed",
    body: "A Guide can Call Parent through the platform without seeing or revealing your phone number.",
  },
  {
    title: "A short report after every Study Hall",
    body: "You receive a post-Study-Hall report covering what was planned, how the hour went, and what comes next.",
  },
] as const;

export function TrustSafety() {
  return (
    <section className="scroll-mt-24 bg-white pb-14 pt-8 sm:pb-20 sm:pt-10">
      <Container size="wide">
        <Reveal>
          <p className="mkt-eyebrow">Trust &amp; safety</p>
          <h2 className="mkt-display mt-3 max-w-[14ch] text-4xl text-ink-900 sm:text-5xl">
            Presence you can see.
          </h2>
        </Reveal>

        <ul className="mt-10 divide-y divide-ink-100 border-y border-ink-100">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 40}>
              <li className="grid gap-2 py-6 sm:grid-cols-[minmax(0,18rem)_1fr] sm:items-baseline sm:gap-10">
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-ink-900">{p.title}</p>
                <p className="max-w-xl text-[15px] leading-7 text-ink-500">{p.body}</p>
              </li>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
