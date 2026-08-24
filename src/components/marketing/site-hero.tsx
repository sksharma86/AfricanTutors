import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { TrackCta } from "@/components/marketing/track-cta";
import { NO_CARD_REQUIRED, SESSION_OPTIONS, formatUsd } from "@/lib/pricing";

export function SiteHero({
  primaryHref,
  primaryLabel,
  hourlyLowUsd,
  hourlyHighUsd,
}: {
  primaryHref: string;
  primaryLabel: string;
  hourlyLowUsd: number;
  hourlyHighUsd: number;
}) {
  const thirty = SESSION_OPTIONS.find((o) => o.minutes === 30);
  const sixty = SESSION_OPTIONS.find((o) => o.minutes === 60);
  void hourlyHighUsd;

  return (
    <section className="overflow-hidden bg-ink-900">
      <Container className="grid gap-12 py-20 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-28">
        <div>
          <Badge className="border-gold-400/40 bg-gold-500/15 text-gold-200">
            First session free · no credit card
          </Badge>
          <h1 className="mt-6 font-display text-4xl leading-[1.08] font-semibold text-white sm:text-5xl">
            Homework, handled.
            <span className="block text-gold-300">Without the nightly battle.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-7 text-ink-200">
            A trained Guide keeps your children on task by video while they do their own schoolwork —
            supervision, accountability, and evening relief for parents.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <TrackCta href={primaryHref} cta={primaryLabel} location="hero" variant="secondary" size="lg">
              {primaryLabel}
            </TrackCta>
            <LinkButton
              href="/how-it-works"
              variant="outline"
              size="lg"
              className="border-white/20 text-white hover:border-white/40 hover:bg-white/5"
            >
              See how it works
            </LinkButton>
          </div>
          <p className="mt-4 text-sm text-ink-300">{NO_CARD_REQUIRED} A real Study Hall session, not a sales call.</p>
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl backdrop-blur">
            <p className="text-xs font-semibold tracking-wide text-gold-200 uppercase">Your first Study Hall</p>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-white/5 p-4">
              <div>
                <p className="text-sm font-medium text-white">Intro Study Hall — with a Guide</p>
                <p className="mt-1 text-xs text-ink-300">Live, supervised · get started free</p>
              </div>
              <span className="rounded-full bg-gold-500/20 px-3 py-1 text-xs font-semibold text-gold-200">Free</span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/5 p-4">
                <p className="text-sm text-ink-100">30-minute session</p>
                <p className="text-sm font-medium text-ink-200">{formatUsd(thirty?.priceUsd ?? 12)}</p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/5 p-4">
                <p className="text-sm text-ink-100">60-minute session</p>
                <p className="text-sm font-medium text-ink-200">{formatUsd(sixty?.priceUsd ?? 20)}</p>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-ink-300">
              Save with prepaid hours — from {formatUsd(hourlyLowUsd)}/hour.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
