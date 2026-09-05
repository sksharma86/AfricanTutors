import Image from "next/image";
import Link from "next/link";

import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";
import { STUDY_HALL_HOUR_USES } from "@/lib/study-hall-hour";

export function StudyHallHourSection() {
  return (
    <section id="the-study-hall-hour" className="scroll-mt-24 bg-[#fcfaf6] py-16 sm:py-24">
      <Container size="wide">
        <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <Reveal>
            <p className="mkt-eyebrow">The Study Hall Hour</p>
            <h2 className="mkt-display mt-3 max-w-[16ch] text-4xl text-ink-900 sm:text-5xl lg:text-[3.4rem]">
              One dedicated hour for your child’s academic life.
            </h2>
            <p className="mt-5 max-w-xl text-[16px] leading-7 text-ink-500">
              A Study Hall is an hour set aside to focus on whatever will move them forward.
              Some days that is homework. Some days it is reading, review, a test, or getting
              organized.
            </p>
            <p className="mt-4 max-w-xl text-[16px] font-medium leading-7 text-ink-800">
              What matters is that they show up.
            </p>
            <p className="mt-8">
              <Link
                href="/the-study-hall-hour"
                className="text-[15px] font-semibold text-ink-900 underline-offset-4 hover:underline"
              >
                Read about the Study Hall Hour
              </Link>
            </p>
          </Reveal>

          <Reveal delay={80}>
            <div className="relative aspect-[5/4] overflow-hidden rounded-[22px] bg-ink-900">
              <Image
                src="/images/marketing/studyhall-hero-desk.webp"
                alt="A school-age child seated at a desk with books and a laptop"
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
              />
            </div>
          </Reveal>
        </div>

        <Reveal delay={100}>
          <ul className="mt-12 flex flex-wrap gap-2 sm:mt-14 sm:gap-2.5">
            {STUDY_HALL_HOUR_USES.map((use) => (
              <li
                key={use}
                className="rounded-full border border-ink-200 bg-white px-3.5 py-2 text-[13px] font-medium tracking-[-0.01em] text-ink-800 sm:px-4 sm:text-[14px]"
              >
                {use}
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}
