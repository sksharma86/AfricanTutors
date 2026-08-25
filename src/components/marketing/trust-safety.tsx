import { Container } from "@/components/ui/container";

const CONTROLS = [
  "Guides are carefully vetted and approved before they work with families",
  "Sessions happen on-platform — not through personal contact channels",
  "Sessions are recorded for quality and safety",
  "Parents can review reports and recordings after Study Hall",
  "You can report an issue with any session; our team reviews it",
  "Payments are handled securely",
  "Guide and family contact details aren’t unnecessarily shared",
] as const;

/**
 * Trust & safety — typographic list, no bordered mini-cards.
 */
export function TrustSafety() {
  return (
    <section className="scroll-mt-24 bg-ink-900 py-24 text-white sm:py-28">
      <Container size="wide">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-gold-300 uppercase">Trust &amp; safety</p>
            <h2 className="mkt-display mt-4 text-4xl sm:text-5xl">Built with real safeguards.</h2>
            <p className="mt-5 max-w-md text-base leading-7 text-white/70">
              Study Hall at Home manages the whole experience — so quality and safety are part of how
              the platform works, not an afterthought.
            </p>
          </div>
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {CONTROLS.map((c) => (
              <li key={c} className="flex gap-4 py-4 text-[15px] leading-7 text-white/85">
                <span className="mt-2.5 h-1 w-1 flex-none rounded-full bg-gold-400" aria-hidden />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
