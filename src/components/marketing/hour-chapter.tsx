import Image from "next/image";
import Link from "next/link";

import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";
import { STUDY_HALL_HOUR_USES } from "@/lib/study-hall-hour";

export function HourChapter() {
  return (
    <section id="the-study-hall-hour" className="bg-[#fcfaf6] py-20 sm:py-28">
      <Container size="wide">
        <div className="grid items-end gap-12 lg:grid-cols-[1fr_0.9fr] lg:gap-20">
          <Reveal>
            <h2 className="mkt-display max-w-[14ch] text-4xl text-ink-900 sm:text-5xl lg:text-[3.5rem]">
              The Study Hall Hour
            </h2>
            <p className="mt-5 max-w-md text-[18px] leading-8 text-ink-600">
              One dedicated hour for your child’s academic life.
            </p>
            <p className="mt-6 max-w-md text-[16px] leading-7 text-ink-500">
              Some days it’s homework. Some days it’s studying, reading, or a test. Some days
              nothing is due — so they read, review, or get ahead.
            </p>
            <p className="mt-5 max-w-md text-[16px] font-medium leading-7 text-ink-800">
              What matters is that they show up and use the hour.
            </p>
            <p className="mt-8 max-w-md font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-ink-900">
              Don’t wait for the problem.
              <span className="mt-1 block text-ink-500">Build the habit.</span>
            </p>
            <p className="mt-8">
              <Link
                href="/the-study-hall-hour"
                className="text-[15px] font-semibold text-ink-900 underline-offset-4 hover:underline"
              >
                How the hour works
              </Link>
            </p>
          </Reveal>

          <Reveal delay={70}>
            <div className="relative aspect-[4/5] overflow-hidden bg-ink-900 sm:aspect-[5/4] lg:aspect-[4/5]">
              <Image
                src="/images/marketing/studyhall-hero-desk.webp"
                alt="A school-age child at a desk with books and a laptop"
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
              />
            </div>
          </Reveal>
        </div>

        <Reveal delay={90}>
          <p className="mt-16 max-w-3xl font-display text-[1.45rem] font-semibold leading-snug tracking-[-0.03em] text-ink-800 sm:text-[1.7rem] sm:leading-snug">
            {STUDY_HALL_HOUR_USES.join("  ·  ")}
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
