import Image from "next/image";

import { Container } from "@/components/ui/container";

export const HOME_EVENING_HEADLINE = "Get an hour of your evening back.";
export const HOME_EVENING_SUPPORT = "Homework time? We got this.";

export const HOME_EVENING_BEFORE_LABEL = "Before Study Hall";
export const HOME_EVENING_BEFORE_NOTE = "Most weeknights, before it became the routine.";
/** Fragments of the evenings before the family used Study Hall. Typeset as noise, not a list. */
export const HOME_EVENING_BEFORE = [
  "Did you start your homework?",
  "Put your phone away.",
  "What are you supposed to be working on?",
  "Please focus.",
  "Did you finish everything?",
] as const;

export const HOME_EVENING_AFTER_LABEL = "With Study Hall";
export const HOME_EVENING_AFTER_NOTE = "Once the hour has a place in the week.";
/** What homework time looks like once Study Hall is the routine. */
export const HOME_EVENING_AFTER = [
  "Homework started.",
  "Phone away.",
  "Tonight’s work organized.",
  "Focused and working.",
  "Study Hall complete.",
] as const;

/**
 * Moment 3 — parent relief, told as a before / after across time.
 * Before Study Hall: a charcoal room and fragments of the reminders that
 * used to run every homework evening. With Study Hall: the noise is gone,
 * the child is settled with the Guide, the parent is elsewhere in the home.
 * Then the statement lands on paper as a cinematic bridge into the product.
 */
export function HomeEvening() {
  return (
    <section id="home-evening" className="sh-home-evening" aria-labelledby="home-evening-title">
      <div className="sh-home-evening__before">
        <div className="sh-home-evening__before-media" aria-hidden>
          <Image
            src="/images/marketing/galaxy-evening-647.webp"
            alt=""
            fill
            sizes="100vw"
            className="sh-home-evening__before-photo"
          />
        </div>
        <Container size="wide" className="sh-home-evening__before-inner">
          <div className="sh-home-evening__state">
            <p className="sh-home-evening__state-title sh-home-display">{HOME_EVENING_BEFORE_LABEL}</p>
            <p className="sh-home-evening__state-note">{HOME_EVENING_BEFORE_NOTE}</p>
          </div>
          <ul className="sh-home-evening__noise" aria-label={HOME_EVENING_BEFORE_LABEL}>
            {HOME_EVENING_BEFORE.map((line) => (
              <li key={line} className="sh-home-evening__fragment">
                {line}
              </li>
            ))}
          </ul>
        </Container>
      </div>

      <div className="sh-home-evening__after">
        <Image
          src="/images/marketing/studyhall-routine-evening.webp"
          alt="A parent with a cup of coffee in the living room while her child works at a desk in the next room with a live Study Hall Guide on the laptop"
          fill
          sizes="100vw"
          className="sh-home-evening__after-photo"
        />
        <div className="sh-home-evening__after-shade" aria-hidden />
        <Container size="wide" className="sh-home-evening__after-inner">
          <div className="sh-home-evening__state">
            <p className="sh-home-evening__state-title sh-home-display">{HOME_EVENING_AFTER_LABEL}</p>
            <p className="sh-home-evening__state-note">{HOME_EVENING_AFTER_NOTE}</p>
          </div>
          <ul className="sh-home-evening__calm" aria-label={HOME_EVENING_AFTER_LABEL}>
            {HOME_EVENING_AFTER.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Container>
      </div>

      <div className="sh-home-evening__land">
        <div className="sh-home-evening__land-media" aria-hidden>
          <Image
            src="/images/marketing/studyhall-routine-evening.webp"
            alt=""
            fill
            sizes="100vw"
            className="sh-home-evening__land-photo"
          />
        </div>
        <div className="sh-home-evening__land-shade" aria-hidden />
        <Container size="wide" className="sh-home-evening__land-inner sh-rise">
          <p className="sh-home-evening__land-rule" aria-hidden />
          <h2 id="home-evening-title" className="sh-home-display sh-home-evening__title">
            {HOME_EVENING_HEADLINE}
          </h2>
          <p className="sh-home-evening__support">{HOME_EVENING_SUPPORT}</p>
        </Container>
      </div>
    </section>
  );
}
