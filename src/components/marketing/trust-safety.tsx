import { Container } from "@/components/ui/container";

const CONTROLS = [
  "Guides are carefully vetted and approved before they work with families",
  "Sessions stay on-platform — not through personal contacts",
  "Sessions are recorded for quality and safety; parents can review recordings for 60 days",
  "Call Parent reaches your phone if your child needs you — Guides never see your number",
  "Parents get a short session report after every Study Hall",
  "Report any session; our team reviews it",
  "Payments are handled securely",
] as const;

export function TrustSafety() {
  return (
    <section className="scroll-mt-24 border-y border-ink-100 bg-white py-16 sm:py-20">
      <Container size="wide">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-16">
          <div className="max-w-md">
            <p className="mkt-eyebrow">Trust &amp; safety</p>
            <h2 className="mkt-display mt-3 text-3xl text-ink-900 sm:text-[2.5rem]">
              Supervision you can see.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-ink-500">
              Vetted Guides. Recorded sessions. Written reports. And Call Parent when your child
              needs you — without sharing your phone number.
            </p>
          </div>
          <ul className="divide-y divide-ink-100 border-y border-ink-100">
            {CONTROLS.map((c) => (
              <li key={c} className="py-3.5 text-[15px] leading-7 text-ink-700">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
