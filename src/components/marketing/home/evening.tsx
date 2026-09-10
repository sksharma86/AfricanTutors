import Image from "next/image";

import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

export const HOME_EVENING_HEADLINE = "Get an hour of your evening back.";
export const HOME_EVENING_SUPPORT = "Homework time? We got this.";

const BEFORE = [
  "Did you start your homework?",
  "Put your phone away.",
  "What are you supposed to be working on?",
  "Please focus.",
  "Did you finish everything?",
] as const;

const AFTER = [
  "Homework started. ✓",
  "Phone away. ✓",
  "Tonight’s work organized. ✓",
  "Focused and working. ✓",
  "Study Hall complete. ✓",
] as const;

export function HomeEvening() {
  return (
    <section id="home-evening" className="sh-home-evening">
      <Container size="wide">
        <Reveal>
          <p className="sh-home-kicker sh-home-evening__kicker">A calmer evening</p>
          <h2 className="sh-home-display sh-home-evening__title">{HOME_EVENING_HEADLINE}</h2>
          <p className="sh-home-evening__support">{HOME_EVENING_SUPPORT}</p>
        </Reveal>

        <Reveal delay={40}>
          <div className="sh-home-evening__compare" role="group" aria-label="Before Study Hall and with Study Hall">
            <div className="sh-home-evening__panel sh-home-evening__panel--before">
              <p className="sh-home-evening__label">Before Study Hall</p>
              <ul className="sh-home-evening__list">
                {BEFORE.map((line) => (
                  <li key={line}>
                    <span className="sh-home-evening__mark sh-home-evening__mark--no" aria-hidden>
                      ×
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="sh-home-evening__panel sh-home-evening__panel--after">
              <p className="sh-home-evening__label">With Study Hall</p>
              <ul className="sh-home-evening__list">
                {AFTER.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="sh-home-evening__payoff">
            <Image
              src="/images/marketing/studyhall-routine-evening.webp"
              alt="A parent relaxing in the next room while a child works with a live Study Hall Guide"
              fill
              sizes="(max-width: 1280px) 100vw, 80rem"
              className="object-cover"
            />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
