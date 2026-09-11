import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { PAYG_PRICE_USD, formatUsd } from "@/lib/pricing";
import {
  PACKAGE_10SH_PRICE_CENTS,
  PACKAGE_10SH_STUDY_HALLS,
  STUDY_HALL_365_MONTHLY_USD,
} from "@/lib/study-hall-365/catalog.mjs";

/** Homepage 10-pack display tracks PACKAGE_10SH_PRICE_CENTS ($99). */
export const PACK_10_DISPLAY_USD = PACKAGE_10SH_PRICE_CENTS / 100;
const PACK_10_SAVINGS_USD = PAYG_PRICE_USD * PACKAGE_10SH_STUDY_HALLS - PACK_10_DISPLAY_USD;

export function HomePricing({
  ctaHref,
  ctaLabel,
}: {
  ctaHref: string;
  ctaLabel: string;
}) {
  const payg = formatUsd(PAYG_PRICE_USD);
  const pack = formatUsd(PACK_10_DISPLAY_USD);
  const unlimited = formatUsd(STUDY_HALL_365_MONTHLY_USD);

  return (
    <section id="pricing" className="sh-home-pricing">
      <Container size="wide">
        <p className="sh-home-kicker sh-home-pricing__kicker">Simple, transparent pricing</p>
        <h2 className="sh-home-display sh-home-pricing__title">Choose what works for your family.</h2>

        <div className="sh-home-pricing__grid">
          <article data-offer="payg" className="sh-home-offer">
            <div className="sh-home-offer__price-head">
              <p className="sh-home-offer__badge" aria-hidden>
                &nbsp;
              </p>
              <p className="sh-home-offer__price">{payg}</p>
            </div>
            <p className="sh-home-offer__name">One Study Hall</p>
            <p className="sh-home-offer__detail">One private, 60 minute Study Hall.</p>
            <p className="sh-home-offer__detail">Pay as you go.</p>
            <TrackCta href={ctaHref} cta={ctaLabel} location="pricing_payg" variant="outline" className="sh-home-offer__cta">
              Get started
            </TrackCta>
          </article>

          <article data-offer="alacarte" className="sh-home-offer">
            <div className="sh-home-offer__price-head">
              <p className="sh-home-offer__badge" aria-hidden>
                &nbsp;
              </p>
              <p className="sh-home-offer__price">{pack}</p>
            </div>
            <p className="sh-home-offer__name">10 Study Halls</p>
            <p className="sh-home-offer__detail">
              Save {formatUsd(PACK_10_SAVINGS_USD)} when you buy ten.
            </p>
            <p className="sh-home-offer__detail">Use them whenever you want. They never expire.</p>
            <TrackCta href={ctaHref} cta={ctaLabel} location="pricing_10" variant="outline" className="sh-home-offer__cta">
              Get started
            </TrackCta>
          </article>

          <article data-offer="study-hall-365" className="sh-home-offer sh-home-offer--flagship">
            <div className="sh-home-offer__price-head">
              <p className="sh-home-offer__badge">Best value</p>
              <p className="sh-home-offer__price">
                {unlimited}
                <span className="sh-home-offer__unit">/month</span>
              </p>
            </div>
            <p className="sh-home-offer__name">Study Hall Unlimited</p>
            <p className="sh-home-offer__detail">Unlimited Study Halls, one per day, every day of the year.</p>
            <p className="sh-home-offer__detail">
              Use them when you want, at the times that work for your family.
            </p>
            <TrackCta
              href={ctaHref}
              cta={ctaLabel}
              location="pricing_unlimited"
              variant="secondary"
              className="sh-home-offer__cta sh-home-offer__cta--flagship"
            >
              Choose Unlimited
            </TrackCta>
          </article>
        </div>
      </Container>
    </section>
  );
}
