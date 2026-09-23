import Image from "next/image";

import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA, PAYG_PRICE_USD, formatUsd } from "@/lib/pricing";
import {
  PACKAGE_10SH_PRICE_CENTS,
  PACKAGE_10SH_STUDY_HALLS,
  STUDY_HALL_365_MONTHLY_USD,
  STUDY_HALL_365_PRODUCT_NAME,
} from "@/lib/study-hall-365/catalog.mjs";

/** Homepage 10-pack display tracks PACKAGE_10SH_PRICE_CENTS ($99). */
export const PACK_10_DISPLAY_USD = PACKAGE_10SH_PRICE_CENTS / 100;
const PACK_10_SAVINGS_USD = PAYG_PRICE_USD * PACKAGE_10SH_STUDY_HALLS - PACK_10_DISPLAY_USD;

export const HOME_ROUTINE_KICKER = "The routine";
export const HOME_ROUTINE_HEADLINE = "It becomes part of the week.";
export const HOME_ROUTINE_COPY =
  "Study Hall has a time. Your child knows when to sit down, get started, and get the work done.";
export const HOME_PRICING_TITLE = "Choose what works for your family.";
export const HOME_PAYG_NAME = "One Study Hall";
export const HOME_PACK_NAME = `${PACKAGE_10SH_STUDY_HALLS} Study Halls`;
export const HOME_365_NAME = STUDY_HALL_365_PRODUCT_NAME;
export const HOME_365_HEADLINE = "Make it a routine.";
export const HOME_365_LINES = [
  "Unlimited Study Halls, one per day, every day of the year.",
  "Use them when you want, at the times that work for your family.",
] as const;
export const HOME_TRUST_LINE =
  "Every Study Hall is live and one on one with a highly vetted Study Hall Guide. Afterward, the report and recording are waiting in your Parent Portal.";

/**
 * Moment 5 — routine + pricing. The dark reveal gives way to a lamp-lit desk
 * and the culmination of the habit story: Study Hall becomes a normal part of
 * the child's week. Two purchasing options are set as quiet editorial rows;
 * Study Hall 365 is the culmination.
 */
export function HomePricing({
  ctaHref,
  ctaLabel,
}: {
  ctaHref: string;
  ctaLabel: string;
}) {
  const payg = formatUsd(PAYG_PRICE_USD);
  const pack = formatUsd(PACK_10_DISPLAY_USD);
  const monthly = formatUsd(STUDY_HALL_365_MONTHLY_USD);

  return (
    <section id="pricing" className="sh-home-pricing" aria-labelledby="home-pricing-title">
      <div className="sh-home-routine">
        <div className="sh-home-routine__media" aria-hidden>
          <Image
            src="/images/marketing/galaxy-routine-desk.webp"
            alt=""
            fill
            sizes="100vw"
            className="sh-home-routine__photo"
          />
        </div>
        <div className="sh-home-routine__shade" aria-hidden />
        <Container size="wide" className="sh-home-routine__inner">
          <div className="sh-home-routine__block">
            <p className="sh-home-kicker sh-home-kicker--light">{HOME_ROUTINE_KICKER}</p>
            <h2 className="sh-home-display sh-home-routine__title">{HOME_ROUTINE_HEADLINE}</h2>
            <p className="sh-home-routine__copy">{HOME_ROUTINE_COPY}</p>
          </div>
        </Container>
      </div>

      <Container size="wide" className="sh-home-pricing__body">
        <div className="sh-home-pricing__head sh-rise">
          <p className="sh-home-kicker">Pricing</p>
          <h2 id="home-pricing-title" className="sh-home-display sh-home-pricing__title">
            {HOME_PRICING_TITLE}
          </h2>
        </div>

        <div className="sh-home-pricing__ladder">
          <div className="sh-home-pricing__options sh-rise">
            <article data-offer="payg" className="sh-home-option">
              <h3 className="sh-home-display sh-home-option__label">{HOME_PAYG_NAME}</h3>
              <p className="sh-home-option__price">{payg}</p>
              <div className="sh-home-option__body">
                <p className="sh-home-option__detail">One private, 60 minute Study Hall. Pay as you go.</p>
                <TrackCta href={ctaHref} cta={ctaLabel} location="pricing_payg" variant="text" className="sh-home-option__cta">
                  {ctaLabel} →
                </TrackCta>
              </div>
            </article>

            <article data-offer="alacarte" className="sh-home-option">
              <h3 className="sh-home-display sh-home-option__label">{HOME_PACK_NAME}</h3>
              <p className="sh-home-option__price">
                {pack}
                <span className="sh-home-option__unit">/ {PACKAGE_10SH_STUDY_HALLS}</span>
              </p>
              <div className="sh-home-option__body">
                <p className="sh-home-option__detail">
                  Keep Study Halls on hand. Save {formatUsd(PACK_10_SAVINGS_USD)} when you buy ten. They never expire.
                </p>
                <TrackCta href={ctaHref} cta={ctaLabel} location="pricing_10" variant="text" className="sh-home-option__cta">
                  {ctaLabel} →
                </TrackCta>
              </div>
            </article>
          </div>

          <article data-offer="study-hall-365" className="sh-home-flagship sh-rise">
            <div className="sh-home-flagship__glow" aria-hidden />
            <p className="sh-home-kicker sh-home-kicker--light">{HOME_365_NAME}</p>
            <h3 className="sh-home-display sh-home-flagship__title">{HOME_365_HEADLINE}</h3>
            <p className="sh-home-flagship__price">
              {monthly}
              <span className="sh-home-flagship__unit">/month</span>
            </p>
            <div className="sh-home-flagship__lines">
              {HOME_365_LINES.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <TrackCta
              href={ctaHref}
              cta={ctaLabel}
              location="pricing_365"
              variant="secondary"
              size="lg"
              className="sh-home-flagship__cta"
            >
              {ctaLabel}
            </TrackCta>
          </article>
        </div>

        <div className="sh-home-close sh-rise">
          <p className="sh-home-close__trust">{HOME_TRUST_LINE}</p>
          <TrackCta
            href={ctaHref}
            cta={ctaLabel}
            location="closing"
            variant="primary"
            size="lg"
            className="sh-home-close__cta"
          >
            {ctaLabel}
          </TrackCta>
          {ctaLabel === FREE_TRIAL_CTA ? <p className="sh-home-close__facts">No credit card required</p> : null}
        </div>
      </Container>
    </section>
  );
}
