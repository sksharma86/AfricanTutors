import Image from "next/image";
import { Fragment } from "react";

import { Container } from "@/components/ui/container";

export const HOME_EXPLAINER_HEADLINE = "A dedicated hour for getting things done.";
export const HOME_EXPLAINER_SUPPORT =
  "Your child works one on one with a live Study Hall Guide who keeps them focused, organized, and on task, whether they have work to finish or want to get ahead.";
export const HOME_USES = ["Homework", "Studying", "Test prep", "Reviewing", "Reading", "Organizing"] as const;
export const HOME_EXPLAINER_CAPTION = "One student. One Guide. One hour.";

/**
 * Moment 2 — the dedicated hour. An editorial spread: one large photograph,
 * one large statement, and negative space. Uses are a typeset line, not cards.
 */
export function HomeExplainer() {
  return (
    <section id="home-hour" className="sh-home-hour" aria-labelledby="home-hour-title">
      <Container size="wide">
        <div className="sh-home-hour__spread">
          <div className="sh-home-hour__copy sh-rise">
            <p className="sh-home-kicker">The Study Hall</p>
            <h2 id="home-hour-title" className="sh-home-display sh-home-hour__title">
              {HOME_EXPLAINER_HEADLINE}
            </h2>
            <p className="sh-home-hour__lede">{HOME_EXPLAINER_SUPPORT}</p>
            <p className="sh-home-hour__uses">
              {HOME_USES.map((use, i) => (
                <Fragment key={use}>
                  {i > 0 ? <span aria-hidden>·</span> : null}
                  <span>{use}</span>
                </Fragment>
              ))}
            </p>
          </div>

          <figure className="sh-home-hour__figure sh-rise">
            <div className="sh-home-hour__frame">
              <Image
                src="/images/marketing/galaxy-hour-intimate.webp"
                alt="A student writing in a notebook at a home desk while a live Study Hall Guide is present on the laptop"
                fill
                sizes="(max-width: 1023px) 100vw, 54vw"
                className="sh-home-hour__photo"
              />
            </div>
            <figcaption className="sh-home-hour__caption">{HOME_EXPLAINER_CAPTION}</figcaption>
          </figure>
        </div>
      </Container>
    </section>
  );
}
