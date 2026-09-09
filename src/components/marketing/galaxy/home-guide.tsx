import Image from "next/image";

import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

const DUTIES = [
  "Encourage",
  "Redirect",
  "Maintain accountability",
  "Keep the child focused",
  "Help organize what needs to be done",
  "Keep the session moving",
] as const;

export function HomeGuide() {
  return (
    <section id="guide" className="bg-[var(--g1-bg-warm)] py-20 sm:py-28">
      <Container size="wide">
        <div className="grid items-center gap-12 lg:grid-cols-[0.86fr_1.14fr] lg:gap-20">
          <Reveal>
            <div className="relative aspect-[4/5] overflow-hidden bg-[var(--g1-dark)] sm:max-w-md">
              <Image
                src="/images/tutor-portrait.jpg"
                alt="A Study Hall Guide, present with a child during a session"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover object-[50%_18%]"
              />
            </div>
          </Reveal>

          <Reveal delay={60}>
            <h2 className="g1-display max-w-[12ch] text-[2.6rem] text-[var(--g1-ink)] sm:text-[3.6rem] lg:text-[4.2rem]">
              Their Study Hall.
              <span className="mt-2 block">Their Guide.</span>
            </h2>
            <p className="mt-6 max-w-xl text-[17px] leading-8 text-[var(--g1-muted)]">
              Every Study Hall is one-to-one. Your child is not placed into a shared classroom or group session.
            </p>
            <p className="mt-4 max-w-xl text-[17px] leading-8 text-[var(--g1-muted)]">
              Their Guide stays with them during the Study Hall and helps keep the session structured and moving.
            </p>
            <ul className="mt-8 space-y-2 text-[16px] leading-7 text-[var(--g1-ink)]">
              {DUTIES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-8 text-[15px] text-[var(--g1-subtle)]">Highly vetted Guides.</p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
