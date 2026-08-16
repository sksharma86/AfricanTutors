import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { HOURLY_RATE } from "@/lib/constants";

export function Hero() {
  return (
    <section className="overflow-hidden bg-ink-900">
      <Container className="grid gap-12 py-16 md:grid-cols-2 md:items-center md:py-24">
        <div>
          <Badge className="border-gold-400/40 bg-white/5 text-gold-200">
            Live 1-on-1 Online Tutoring
          </Badge>
          <h1 className="mt-6 font-display text-4xl leading-tight font-semibold text-white sm:text-5xl">
            Great tutoring shouldn&apos;t cost a fortune.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-7 text-ink-200">
            African Tutors connects your student with a carefully selected, qualified tutor for
            focused, one-on-one online sessions &mdash; for just{" "}
            <span className="font-semibold text-gold-300">{HOURLY_RATE} an hour</span>.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/signup" variant="secondary" size="lg">
              Get Started
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
          <p className="mt-6 text-sm text-ink-300">
            Every tutor is reviewed and approved by African Tutors before working with students.
          </p>
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur">
            <p className="text-xs font-semibold tracking-wide text-gold-200 uppercase">
              Live One-on-One Tutoring
            </p>
            <div className="mt-4 flex items-end gap-2">
              <span className="font-display text-5xl font-semibold text-white">
                {HOURLY_RATE}
              </span>
              <span className="pb-1.5 text-base font-medium text-ink-300">/ hour</span>
            </div>
            <div className="mt-6 space-y-3">
              {[
                "A real, qualified tutor \u2014 not a chatbot",
                "One-on-one attention, every session",
                "Book online, no long-term contract",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-xl border border-white/5 p-3.5">
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    className="mt-0.5 h-5 w-5 flex-none text-gold-400"
                  >
                    <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="M6.5 10.25 9 12.75l4.5-5.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="text-sm text-ink-100">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
