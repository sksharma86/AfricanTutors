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

        <div className="sh-home-evening__split">
          <Reveal>
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
          </Reveal>

          <Reveal delay={70}>
            <div className="sh-home-evening__panel sh-home-evening__panel--after">
              <div className="sh-home-evening__photo">
                <Image
                  src="/images/marketing/studyhall-routine-evening.webp"
                  alt="A parent with a quiet evening while a child works in the next room"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover object-[35%_30%]"
                />
              </div>
              <p className="sh-home-evening__label">With Study Hall</p>
              <ul className="sh-home-evening__list sh-home-evening__list--after">
                {AFTER.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
