import Image from "next/image";

import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

export const HOME_EXPLAINER_HEADLINE = "A dedicated hour for getting things done.";
export const HOME_EXPLAINER_SUPPORT =
  "Your child works one on one with a live Study Hall Guide who keeps them focused, organized, and on task, whether they have work to finish or want to get ahead.";
export const HOME_USES = ["Homework", "Studying", "Test prep", "Reviewing", "Reading", "Organizing"] as const;

export function HomeExplainer() {
  return (
    <section id="home-explainer" className="sh-home-explainer">
      <Container size="wide">
        <div className="sh-home-explainer__grid">
          <Reveal>
            <p className="sh-home-kicker">More than homework</p>
            <h2 className="sh-home-display sh-home-explainer__title">{HOME_EXPLAINER_HEADLINE}</h2>
            <p className="sh-home-explainer__lede">{HOME_EXPLAINER_SUPPORT}</p>
            <p className="sh-home-explainer__uses">{HOME_USES.join("  ·  ")}</p>
          </Reveal>

          <Reveal delay={70}>
            <div className="sh-home-explainer__visual">
              <Image
                src="/images/marketing/studyhall-hero-desk.webp"
                alt="A student working at a home desk during a Study Hall"
                fill
                sizes="(max-width: 1024px) 100vw, 46vw"
                className="object-cover object-[60%_20%]"
              />
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
