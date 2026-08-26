import Link from "next/link";

import { Container } from "@/components/ui/container";

/**
 * Parent-relief story — warm, typography-forward. No fabricated product UI.
 */
export function WhyStudyHall() {
  const points = [
    {
      title: "Someone is actually watching",
      body: "A Guide stays on video the whole hour — present, calm, and ready to redirect when attention drifts.",
    },
    {
      title: "Less nightly arguing",
      body: "The work happens in a structured Study Hall, so homework is no longer a family negotiation.",
    },
    {
      title: "You get the evening back",
      body: "Step away knowing the session is recorded, and that Call Parent can reach you if you’re needed.",
    },
  ];

  return (
    <section id="why" className="scroll-mt-24 bg-ink-900 py-16 text-white sm:py-22">
      <Container size="wide">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.14em] text-gold-300 uppercase">For parents</p>
          <h2 className="mkt-display mt-3 text-3xl sm:text-[2.6rem]">
            A calmer homework hour — from home.
          </h2>
          <p className="mt-5 text-[16px] leading-7 text-white/65">
            Study Hall (at home) is live supervision, not tutoring. Children bring their own
            homework. Guides keep the routine going so families can stop hovering.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {points.map((p) => (
            <div key={p.title} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-6">
              <h3 className="font-display text-xl text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/60">{p.body}</p>
            </div>
          ))}
        </div>
        <Link
          href="/pricing"
          className="mt-10 inline-flex text-[15px] font-semibold text-gold-300 transition-colors hover:text-gold-200"
        >
          See pricing →
        </Link>
      </Container>
    </section>
  );
}

/** @deprecated Alias for older imports / tests — use WhyStudyHall. */
export function WhyAfricanTutors() {
  return <WhyStudyHall />;
}
