import { Reveal } from "@/components/marketing/reveal";
import { TrackCta } from "@/components/marketing/track-cta";
import { Container } from "@/components/ui/container";
import { PAYG_PRICE_USD, formatUsd } from "@/lib/pricing";
import {
  PACKAGE_10SH_PRICE_CENTS,
  PACKAGE_10SH_STUDY_HALLS,
  STUDY_HALL_365_MONTHLY_USD,
} from "@/lib/study-hall-365/catalog.mjs";

/** Desired future 10-pack price is $99. Authoritative backend remains $100 until a separate economics change. */
export const PACK_10_DISPLAY_USD = PACKAGE_10SH_PRICE_CENTS / 100;

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
    <section id="pricing" className="scroll-mt-24 border-t border-[var(--g1-line)] py-20 sm:py-28">
      <Container size="wide">
        <Reveal>
          <p className="g1-kicker">Pricing</p>
          <h2 className="g1-display mt-4 max-w-[14ch] text-[2.4rem] text-[var(--g1-ink)] sm:text-[3.2rem]">
            Start with one hour.
            <span className="mt-2 block">Then choose a rhythm.</span>
          </h2>
        </Reveal>

        <div className="mt-16 space-y-12">
          <Reveal>
            <div data-offer="payg" className="max-w-md">
              <p className="text-[13px] font-medium tracking-[0.08em] text-[var(--g1-subtle)] uppercase">
                Pay as you go
              </p>
              <p className="g1-display mt-2 text-[2.2rem] text-[var(--g1-ink)]">{payg}</p>
              <p className="mt-2 text-[15px] leading-7 text-[var(--g1-muted)]">
                One 60-minute Study Hall. Maximum flexibility.
              </p>
            </div>
          </Reveal>

          <Reveal delay={40}>
            <div data-offer="alacarte" className="max-w-lg border-t border-[var(--g1-line)] pt-12">
              <p className="text-[13px] font-medium tracking-[0.08em] text-[var(--g1-subtle)] uppercase">
                10 Study Halls
              </p>
              <p className="g1-display mt-2 text-[3rem] text-[var(--g1-ink)] sm:text-[3.4rem]">{pack}</p>
              <p className="mt-3 text-[16px] leading-7 text-[var(--g1-muted)]">
                {PACKAGE_10SH_STUDY_HALLS} one-hour Study Halls. Never expires.
              </p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div
              data-offer="study-hall-365"
              className="border-t border-[var(--g1-line)] pt-14 sm:pt-16"
            >
              <p className="text-[13px] font-medium tracking-[0.12em] text-[var(--g1-subtle)] uppercase">
                Make it a routine
              </p>
              <p className="g1-display mt-4 text-[1.8rem] text-[var(--g1-ink)] sm:text-[2.2rem]">Study Hall 365</p>
              <p className="g1-display mt-4 text-[4.5rem] leading-none text-[var(--g1-ink)] sm:text-[6.5rem]">
                {monthly}
                <span className="ml-2 text-[1.15rem] font-medium tracking-[-0.02em] text-[var(--g1-subtle)]">
                  /month
                </span>
              </p>
              <p className="mt-5 max-w-lg text-[17px] leading-8 text-[var(--g1-muted)]">
                One 60-minute Study Hall per household calendar day.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={60}>
          <div className="mt-14">
            <TrackCta href={ctaHref} cta={ctaLabel} location="pricing" variant="primary" size="lg">
              {ctaLabel}
            </TrackCta>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
