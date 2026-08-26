import Image from "next/image";

import { Reveal } from "@/components/marketing/reveal";
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
    <section className="scroll-mt-24 bg-white py-20 sm:py-28">
      <Container size="wide">
        <div className="grid items-end gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <Reveal>
            <div className="relative aspect-[4/5] overflow-hidden rounded-[20px] bg-ink-900 sm:aspect-[5/4] lg:aspect-[4/5]">
              <Image
                src="/images/tutor-portrait.jpg"
                alt="A vetted Guide working remotely during a live Study Hall"
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover object-[50%_15%]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-6 py-5 text-white">
                <p className="text-sm font-medium">Recording available for 60 days</p>
                <p className="mt-1 text-sm text-white/65">Parents can review the session. Not stored forever.</p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <p className="mkt-eyebrow">Trust &amp; safety</p>
            <h2 className="mkt-display mt-3 text-4xl text-ink-900 sm:text-5xl">
              Supervision you can see.
            </h2>
            <p className="mt-4 text-[16px] leading-7 text-ink-500">
              Vetted Guides. Recorded sessions. Written reports. And Call Parent when your child
              needs you — without sharing your phone number.
            </p>
            <ul className="mt-8 divide-y divide-ink-100 border-y border-ink-100">
              {CONTROLS.map((c) => (
                <li key={c} className="py-3.5 text-[15px] leading-7 text-ink-700">
                  {c}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
