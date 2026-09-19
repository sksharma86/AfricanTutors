import Image from "next/image";

import { EditorialLine } from "@/components/marketing/home/editorial";
import { Container } from "@/components/ui/container";

export const HOME_EVENING_HEADLINE = "Get an hour of your evening back.";
export const HOME_EVENING_SUPPORT = "Homework time? We got this.";

/** Fragments of the evening before Study Hall. Typeset as noise, not a list. */
export const HOME_EVENING_BEFORE = [
  "Did you start your homework?",
  "Put your phone away.",
  "What are you supposed to be working on?",
  "Are you finished?",
] as const;

/** What the same evening looks like once the Study Hall begins. */
export const HOME_EVENING_AFTER = ["Homework started.", "Phone away.", "Tonight’s work organized."] as const;

/**
 * Moment 3 — parent relief, told as two moments in one evening.
 * 6:47 PM: a charcoal room and fragments of reminders.
 * 7:00 PM: the noise is gone, the child is settled, the parent is elsewhere.
 * Then the statement lands on paper.
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
          <p className="sh-home-evening__clock sh-home-display">
            <span className="sh-home-evening__time">6:47</span>
            <span className="sh-home-evening__meridiem">PM</span>
          </p>
          <ul className="sh-home-evening__noise" aria-label="Before Study Hall">
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
          <p className="sh-home-evening__clock sh-home-display">
            <span className="sh-home-evening__time">7:00</span>
            <span className="sh-home-evening__meridiem">PM</span>
          </p>
          <ul className="sh-home-evening__calm" aria-label="With Study Hall">
            {HOME_EVENING_AFTER.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Container>
      </div>

      <div className="sh-home-evening__land">
        <Container size="wide" className="sh-home-evening__land-inner sh-rise">
          <h2 id="home-evening-title" className="sh-home-display sh-home-evening__title">
            <EditorialLine text={HOME_EVENING_HEADLINE} accent="evening" />
          </h2>
          <p className="sh-home-evening__support">{HOME_EVENING_SUPPORT}</p>
        </Container>
      </div>
    </section>
  );
}
