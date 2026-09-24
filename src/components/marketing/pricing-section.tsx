import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { FAMILY_VALUE_BODY, FAMILY_VALUE_EYEBROW, FAMILY_VALUE_RATE } from "@/lib/household-pricing-copy.mjs";
import type { PublicPackage } from "@/lib/marketing";
import { PUBLIC_OFFERS, PUBLIC_OFFER_CTA_HREF, START_FREE_CTA } from "@/lib/public-offers";

type PaidOfferId = (typeof PUBLIC_OFFERS)[number]["id"];

/**
 * Paid offers point at the same portal paths purchases already use.
 * Signed-out visitors are sent through login and land on the same page.
 */
const PAID_OFFER_PATHS: Record<PaidOfferId, string> = {
  payg: "/dashboard/student/book",
  alacarte: "/dashboard/student/packages#prepaid",
  "study-hall-365": "/dashboard/student/packages#study-hall-365",
};

const PAID_OFFER_CTAS: Record<PaidOfferId, string> = {
  payg: "Buy one Study Hall",
  alacarte: "Buy 10 Study Halls",
  "study-hall-365": "Get started",
};

const PAID_OFFER_NOTES: Record<PaidOfferId, string> = {
  payg: "Book one hour whenever you need it.",
  alacarte: "Save $21. Use them on your schedule.",
  "study-hall-365": "Cancel anytime. Unused days do not roll over.",
};

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
  return (
    <section
      id="pricing"
      className={compact ? "scroll-mt-24 bg-white py-12 sm:py-16" : "scroll-mt-24 bg-white py-14 sm:py-20"}
    >
      <Container size="wide">
        {withHeader ? (
          <h2 className="mkt-display mb-8 text-3xl text-ink-900 sm:text-[2.6rem]">Then choose what fits.</h2>
        ) : null}

        <ol className="grid gap-4 sm:grid-cols-3" aria-label="Offers, from free to Study Hall 365">
          <li
            data-offer="free"
            className="flex flex-col gap-6 rounded-2xl border border-gold-200 bg-gold-50/60 p-6 sm:col-span-3 sm:flex-row sm:items-center sm:justify-between sm:p-8"
          >
            <div>
              <p className="text-[13px] font-medium tracking-[0.04em] text-gold-700 uppercase">1 · Try it</p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-ink-900">
                First Study Hall free
              </p>
              <p className="mt-2 text-[15px] leading-6 text-ink-500">
                60 minutes. No credit card. Up to three siblings can join.
              </p>
            </div>
            <TrackCta
              href={ctaHref}
              cta={ctaLabel}
              location="pricing"
              variant="primary"
              size="lg"
              className="w-full sm:w-auto sm:shrink-0"
            >
              {ctaLabel}
            </TrackCta>
          </li>

          {PUBLIC_OFFERS.map((offer, index) => (
            <li
              key={offer.id}
              data-offer={offer.id}
              className="flex flex-col rounded-2xl border border-ink-100 bg-white p-6 sm:p-7"
            >
              <p className="text-[13px] font-medium tracking-[0.04em] text-ink-500 uppercase">
                {index + 2} · {offer.name}
              </p>
              <p className="mt-3 font-display text-4xl font-semibold tracking-[-0.035em] text-ink-900">
                {offer.price}
                {"unit" in offer ? (
                  <span className="ml-1 text-[1rem] font-medium tracking-normal text-ink-400">{offer.unit}</span>
                ) : null}
              </p>
              <p className="mt-2 text-[15px] font-medium text-ink-800">{offer.detail}</p>
              <p className="mt-1 text-[14px] leading-6 text-ink-500">{PAID_OFFER_NOTES[offer.id]}</p>
              <TrackCta
                href={PAID_OFFER_PATHS[offer.id]}
                cta={PAID_OFFER_CTAS[offer.id]}
                location={`pricing_${offer.id}`}
                variant="outline"
                size="md"
                className="mt-6 w-full"
              >
                {PAID_OFFER_CTAS[offer.id]}
              </TrackCta>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-6 border-t border-ink-100 pt-6 text-[14px] leading-6 text-ink-500 sm:grid-cols-2 sm:gap-10">
          <div>
            <p className="font-medium text-ink-800">{FAMILY_VALUE_EYEBROW}</p>
            <p className="mt-1">{FAMILY_VALUE_BODY}</p>
          </div>
          <div>
            <p>
              The first hour is free, with no credit card. One Study Hall is $12. Ten Study Halls are $99 and
              never expire. Study Hall 365 is $149/month for one hour every calendar day.
            </p>
            <p className="mt-1">{FAMILY_VALUE_RATE}</p>
          </div>
        </div>
      </Container>
    </section>
  );
}
