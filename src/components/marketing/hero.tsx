import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";

export function Hero() {
  return (
    <section className="overflow-hidden bg-ink-900">
      <Container className="grid gap-12 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <Badge className="border-brand-400/40 bg-white/5 text-brand-200">
            Online Tutoring
          </Badge>
          <h1 className="mt-6 font-display text-4xl leading-tight font-semibold text-white sm:text-5xl">
            One-on-one tutoring, matched to how you actually learn.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-7 text-ink-200">
            African Tutors connects students with qualified tutors for focused, convenient
            online sessions &mdash; on a schedule that works for you, entirely through one
            platform.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/signup" variant="secondary" size="lg">
              Find a Tutor
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
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur">
            <p className="text-xs font-semibold tracking-wide text-brand-200 uppercase">
              Upcoming Session
            </p>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-white/5 p-4">
              <div>
                <p className="text-sm font-medium text-white">Algebra II &mdash; Session 4</p>
                <p className="mt-1 text-xs text-ink-300">Today, 4:30 PM &middot; 45 minutes</p>
              </div>
              <span className="rounded-full bg-brand-500/20 px-3 py-1 text-xs font-medium text-brand-200">
                Confirmed
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {["Chemistry Fundamentals", "Essay Writing Workshop"].map((subject) => (
                <div
                  key={subject}
                  className="flex items-center justify-between rounded-xl border border-white/5 p-4"
                >
                  <p className="text-sm text-ink-100">{subject}</p>
                  <p className="text-xs text-ink-400">Scheduled</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
