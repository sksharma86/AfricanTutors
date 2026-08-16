import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA, NO_CARD_REQUIRED, SESSION_OPTIONS, formatUsd } from "@/lib/pricing";

export function Hero() {
  const thirty = SESSION_OPTIONS.find((option) => option.minutes === 30);
  const sixty = SESSION_OPTIONS.find((option) => option.minutes === 60);

  return (
    <section className="overflow-hidden bg-ink-900">
      <Container className="grid gap-12 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <Badge className="border-brand-400/40 bg-brand-500/15 text-brand-200">
            First 30 minutes free
          </Badge>
          <h1 className="mt-6 font-display text-4xl leading-tight font-semibold text-white sm:text-5xl">
            Great tutoring shouldn&apos;t cost a fortune.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-7 text-ink-200">
            Live, one-on-one sessions with a real, qualified tutor. Your student&apos;s first
            30-minute session is completely free &mdash; then it&apos;s just{" "}
            {formatUsd(thirty?.priceUsd ?? 12)} for 30 minutes or {formatUsd(sixty?.priceUsd ?? 20)}{" "}
            for 60.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/signup" variant="secondary" size="lg">
              {FREE_TRIAL_CTA}
            </LinkButton>
            <LinkButton
              href="/how-it-works"
              variant="outline"
              size="lg"
              className="border-white/20 text-white hover:border-white/40 hover:bg-white/5"
            >
              How It Works
            </LinkButton>
          </div>
          <p className="mt-4 text-sm text-ink-300">
            {NO_CARD_REQUIRED} A real tutoring session, not a sales call.
          </p>
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur">
            <p className="text-xs font-semibold tracking-wide text-brand-200 uppercase">
              Your first session
            </p>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-white/5 p-4">
              <div>
                <p className="text-sm font-medium text-white">Intro Session &mdash; one-on-one</p>
                <p className="mt-1 text-xs text-ink-300">30 minutes &middot; with a real tutor</p>
              </div>
              <span className="rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold text-brand-200">
                Free
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/5 p-4">
                <p className="text-sm text-ink-100">30-minute session</p>
                <p className="text-xs font-medium text-ink-300">
                  {formatUsd(thirty?.priceUsd ?? 12)}
                </p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/5 p-4">
                <p className="text-sm text-ink-100">60-minute session</p>
                <p className="text-xs font-medium text-ink-300">
                  {formatUsd(sixty?.priceUsd ?? 20)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
