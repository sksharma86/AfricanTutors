import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CtaSection } from "@/components/marketing/cta-section";
import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";
import { PUBLIC_OFFER_CTA_HREF, START_FREE_CTA } from "@/lib/public-offers";
import { STUDY_HALL_HOUR_USES, STUDY_HALL_METHOD } from "@/lib/study-hall-hour";

export const metadata: Metadata = {
  title: "The Study Hall Hour",
  description: "One dedicated hour for your child's academic life — homework, studying, reading, or working ahead.",
  alternates: { canonical: "/the-study-hall-hour" },
};

const GUIDE_DOES = [
  "Stay present for the full hour",
  "Help set a simple goal",
  "Check progress and encourage",
  "Redirect when attention drifts",
  "Send a short parent report",
];

const GUIDE_DOES_NOT = ["Tutor or teach a lesson", "Give answers or complete the work", "Replace the parent"];

export default function TheStudyHallHourPage() {
  return (
    <div className="mkt-atmosphere">
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <Image
          src="/images/marketing/studyhall-focus-close.webp"
          alt="A student concentrating during a dedicated academic hour"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_28%] opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-900/70 via-ink-900/35 to-transparent" aria-hidden />
        <Container size="wide" className="relative z-10 py-20 sm:py-28">
          <h1 className="mkt-display max-w-[16ch] text-4xl sm:text-5xl lg:text-[3.6rem]">
            One dedicated hour for your child’s academic life.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-8 text-white/82">
            They sit down. A Guide stays present. The work — whatever it is that day — gets an honest hour.
          </p>
        </Container>
      </section>

      <section className="bg-[#fcfaf6] py-20 sm:py-28">
        <Container size="wide">
          <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <Reveal>
              <div className="relative aspect-[4/5] overflow-hidden bg-ink-900 sm:aspect-[5/4] lg:aspect-[4/5]">
                <Image
                  src="/images/marketing/studyhall-hero-desk.webp"
                  alt="A school-age child at a desk with books and a laptop"
                  fill
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-cover"
                />
              </div>
            </Reveal>
            <Reveal delay={70}>
              <h2 className="mkt-display max-w-[14ch] text-3xl text-ink-900 sm:text-4xl">
                The work changes. Showing up does not.
              </h2>
              <p className="mt-5 max-w-xl text-[16px] leading-7 text-ink-500">
                Homework is welcome. So is a chapter, a test, a project, or a quiet night with nothing due.
                Grades 3–12.
              </p>
              <p className="mt-8 max-w-2xl font-display text-[1.45rem] font-semibold leading-snug tracking-[-0.03em] text-ink-800 sm:text-[1.65rem]">
                {STUDY_HALL_HOUR_USES.join("  ·  ")}
              </p>
            </Reveal>
          </div>
        </Container>
      </section>

      <section className="bg-white py-20 sm:py-28">
        <Container size="wide">
          <Reveal>
            <h2 className="mkt-display text-3xl text-ink-900 sm:text-4xl">Plan. Focus. Finish.</h2>
            <p className="mt-4 max-w-lg text-[16px] leading-7 text-ink-500">
              Know what you’re working on. Use the hour well. Leave knowing what got done.
            </p>
          </Reveal>
          <ol className="mt-14 grid gap-10 sm:grid-cols-3">
            {STUDY_HALL_METHOD.map((step, index) => (
              <Reveal key={step.title} delay={index * 60}>
                <li>
                  <p className="font-display text-[2.6rem] font-semibold tracking-[-0.05em] text-ink-300">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-ink-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[16px] leading-7 text-ink-500">{step.line}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </Container>
      </section>

      <section className="bg-ink-900 py-20 text-white sm:py-24">
        <Container size="wide">
          <h2 className="mkt-display max-w-[14ch] text-3xl sm:text-4xl">No homework tonight? Good.</h2>
          <p className="mt-5 max-w-xl text-[17px] leading-8 text-white/72">
            Read. Review. Prepare. Catch up. Work ahead. Organize. The hour does not wait for a crisis.
          </p>
        </Container>
      </section>

      <section className="bg-white py-20 sm:py-28">
        <Container size="wide">
          <div className="grid gap-14 lg:grid-cols-2">
            <div>
              <h2 className="mkt-display text-3xl text-ink-900">What the Guide does</h2>
              <ul className="mt-6 space-y-3 text-[16px] leading-7 text-ink-600">
                {GUIDE_DOES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mkt-display text-3xl text-ink-900">What the Guide does not do</h2>
              <ul className="mt-6 space-y-3 text-[16px] leading-7 text-ink-600">
                {GUIDE_DOES_NOT.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-[#fcfaf6] py-20 sm:py-28">
        <Container size="wide">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="mkt-display max-w-[16ch] text-3xl text-ink-900 sm:text-4xl">
                For students who are behind — and students who are not.
              </h2>
              <p className="mt-5 max-w-xl text-[16px] leading-7 text-ink-500">
                Behind? Catch up. Test coming? Prepare. Everything finished? Work ahead. Already doing
                well? Keep the hour that protects that.
              </p>
              <p className="mt-5 max-w-xl text-[16px] leading-7 text-ink-500">
                For that hour, you don’t have to start them or hover over the work.
              </p>
              <p className="mt-8">
                <Link
                  href={PUBLIC_OFFER_CTA_HREF}
                  className="text-[15px] font-semibold text-ink-900 underline-offset-4 hover:underline"
                >
                  {START_FREE_CTA}
                </Link>
              </p>
            </div>
            <div className="relative aspect-[5/4] overflow-hidden bg-ink-900">
              <Image
                src="/images/tutor-portrait.jpg"
                alt="A Guide present on video during Study Hall"
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover object-[50%_18%]"
              />
            </div>
          </div>
        </Container>
      </section>

      <CtaSection
        title="Start with one free hour."
        description="No credit card required."
        primaryHref={PUBLIC_OFFER_CTA_HREF}
        primaryLabel={START_FREE_CTA}
        showFinePrint={false}
      />
    </div>
  );
}
