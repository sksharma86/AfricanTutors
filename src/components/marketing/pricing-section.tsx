import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { FAMILY_VALUE_BODY, FAMILY_VALUE_EYEBROW, FAMILY_VALUE_RATE } from "@/lib/household-pricing-copy.mjs";
import type { PublicPackage } from "@/lib/marketing";
import { PUBLIC_OFFERS, PUBLIC_OFFER_CTA_HREF, START_FREE_CTA } from "@/lib/public-offers";

export function PricingSection({
  withHeader = true,
  compact = false,
  ctaHref = PUBLIC_OFFER_CTA_HREF,
  ctaLabel = START_FREE_CTA,
}: {
  packages?: PublicPackage[];
  withHeader?: boolean;
  compact?: boolean;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const featured = PUBLIC_OFFERS.find((offer) => "featured" in offer && offer.featured);
  const supporting = PUBLIC_OFFERS.filter((offer) => !("featured" in offer && offer.featured));

  return (
    <section
      id="pricing"
      className={compact ? "scroll-mt-24 bg-white py-16 sm:py-20" : "scroll-mt-24 bg-white py-20 sm:py-28"}
    >
      <Container size="wide">
        {withHeader ? (
          <h2 className="mkt-display text-3xl text-ink-900 sm:text-[2.6rem]">Then choose what fits.</h2>
        ) : null}

        <div className={`${withHeader ? "mt-10" : "mt-2"} space-y-8`}>
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink-100 pb-8">
            <div>
              <p className="text-[13px] font-medium tracking-[0.04em] text-gold-700 uppercase">Try it</p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-ink-900">
                First Study Hall free
              </p>
              <p className="mt-2 text-[15px] text-ink-500">60 minutes. No credit card. Up to three siblings.</p>
            </div>
            <TrackCta href={ctaHref} cta={ctaLabel} location="pricing" variant="primary" size="lg">
              {ctaLabel}
            </TrackCta>
          </div>

          {featured ? (
            <div data-offer={featured.id} className="bg-ink-900 px-6 py-8 text-white sm:px-10 sm:py-10">
              <p className="text-[13px] font-medium tracking-[0.08em] text-gold-300 uppercase">
                {featured.name}
              </p>
              <p className="mt-3 font-display text-5xl font-semibold tracking-[-0.04em]">
                {featured.price}
                {"unit" in featured ? (
                  <span className="ml-1 text-[1.1rem] font-medium text-white/50">{featured.unit}</span>
                ) : null}
              </p>
              <p className="mt-3 max-w-md text-[16px] leading-7 text-white/70">{featured.detail}</p>
            </div>
          ) : null}

          <div className="grid gap-8 sm:grid-cols-2">
            {supporting.map((offer) => (
              <div key={offer.id} data-offer={offer.id}>
                <p className="text-[13px] font-medium text-ink-400">{offer.name}</p>
                <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-ink-900">
                  {offer.price}
                </p>
                <p className="mt-2 text-[15px] text-ink-500">{offer.detail}</p>
              </div>
            ))}
          </div>

          <p className="max-w-xl text-[14px] leading-6 text-ink-400">
            {FAMILY_VALUE_EYEBROW} {FAMILY_VALUE_BODY} {FAMILY_VALUE_RATE}
          </p>
          <p className="max-w-xl text-[14px] leading-6 text-ink-400">
            The first hour is available now. À la carte Study Halls never expire. Study Hall 365
            ($149/month) and the 10-Study-Hall option are coming next — there is no checkout for them yet.
          </p>
        </div>
      </Container>
    </section>
  );
}
