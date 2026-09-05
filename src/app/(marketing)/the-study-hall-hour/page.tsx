import type { Metadata } from "next";
import Image from "next/image";

import { CtaSection } from "@/components/marketing/cta-section";
import { PageHeader } from "@/components/marketing/page-header";
import { StudyHallMethod } from "@/components/marketing/study-hall-method";
import { Container } from "@/components/ui/container";
import { FREE_TRIAL_CTA } from "@/lib/pricing";
import {
  NOTHING_DUE_USES,
  STUDENT_LEVELS,
  STUDY_HALL_HOUR_USES,
} from "@/lib/study-hall-hour";

export const metadata: Metadata = {
  title: "The Study Hall Hour",
  description:
    "One dedicated hour for your child's academic life — homework, studying, reading, test preparation, and more — with a real human Guide present.",
  alternates: { canonical: "/the-study-hall-hour" },
};

export default function TheStudyHallHourPage() {
  return (
    <div className="mkt-atmosphere">
      <PageHeader
        eyebrow="The Study Hall Hour"
        title="One dedicated hour for your child’s academic life."
        description="A Study Hall is an hour your child sets aside to focus on whatever will move them forward. The work can change. The habit is showing up."
      />

      <section className="bg-[#fcfaf6] py-14 sm:py-20">
        <Container size="wide">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <h2 className="mkt-display max-w-[16ch] text-3xl text-ink-900 sm:text-4xl">
                What can the hour be used for?
              </h2>
              <p className="mt-4 max-w-xl text-[16px] leading-7 text-ink-500">
                Some days there will be homework to finish. Some days there’s a test to prepare for.
                Some days it’s reading, reviewing, organizing, catching up, or getting ahead.
              </p>
              <p className="mt-4 text-[16px] font-medium text-ink-800">What matters is that they show up.</p>
            </div>
            <div className="relative aspect-[5/4] overflow-hidden rounded-[22px] bg-ink-900">
              <Image
                src="/images/marketing/studyhall-hero-desk.webp"
                alt="A child at a home desk with books and a laptop during the Study Hall Hour"
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
              />
            </div>
          </div>
          <ul className="mt-10 flex flex-wrap gap-2 sm:gap-2.5">
            {STUDY_HALL_HOUR_USES.map((use) => (
              <li
                key={use}
                className="rounded-full border border-ink-200 bg-white px-3.5 py-2 text-[13px] font-medium text-ink-800 sm:px-4 sm:text-[14px]"
              >
                {use}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <StudyHallMethod />

      <section className="bg-ink-900 py-16 text-white sm:py-24">
        <Container size="wide">
          <p className="text-[13px] font-medium tracking-[0.16em] text-gold-300 uppercase">
            What if nothing is due?
          </p>
          <h2 className="mkt-display mt-3 max-w-[16ch] text-4xl sm:text-5xl">
            What if there’s nothing due tomorrow?
          </h2>
          <p className="mt-5 max-w-xl font-display text-[1.75rem] font-semibold tracking-[-0.03em] text-white">
            Perfect.
          </p>
          <ul className="mt-8 max-w-lg space-y-3 text-[1.25rem] font-semibold tracking-[-0.02em] text-white/78">
            {NOTHING_DUE_USES.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-10 max-w-xl text-[16px] leading-7 text-white/70">
            There may not be homework every day. There is always an opportunity to build the habit.
            When nothing else is waiting, reading is enough.
          </p>
          <p className="mt-6 max-w-xl font-display text-[1.45rem] font-semibold tracking-[-0.03em] text-white">
            Study Hall doesn’t require an emergency.
            <span className="mt-2 block text-white/58">Don’t wait for the problem. Build the habit.</span>
          </p>
        </Container>
      </section>

      <section className="bg-white py-16 sm:py-24">
        <Container size="wide">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="mkt-eyebrow">The Guide’s role</p>
              <h2 className="mkt-display mt-3 max-w-[14ch] text-3xl text-ink-900 sm:text-4xl">
                A real human Guide, present for the hour.
              </h2>
              <p className="mt-5 text-[16px] leading-7 text-ink-500">
                The Guide helps the student decide what needs to get done, stay with the work, and
                look back at what they accomplished. They keep the hour on track.
              </p>
              <p className="mt-5 text-[16px] font-medium leading-7 text-ink-800">
                The Guide isn’t there to do the work for them. The Guide is there to help make sure
                the work gets done.
              </p>
            </div>
            <div>
              <p className="mkt-eyebrow">What the Guide does not do</p>
              <ul className="mt-5 space-y-3 text-[16px] leading-7 text-ink-600">
                <li>Tutor or teach lessons</li>
                <li>Provide answers</li>
                <li>Complete the work</li>
                <li>Replace a parent</li>
              </ul>
              <p className="mt-6 text-[15px] leading-7 text-ink-500">
                You remain the parent. The Guide reduces the need for constant nightly policing —
                the checking, the hovering, the phone reminders.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-[#f7f6f3] py-16 sm:py-24">
        <Container size="wide">
          <h2 className="mkt-display max-w-[16ch] text-3xl text-ink-900 sm:text-4xl">
            Why consistency matters
          </h2>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-ink-500">
            Academic success isn’t built in one heroic night before a test. It is built through the
            repeated habit of sitting down, focusing, studying, reading, preparing, and completing
            the work.
          </p>
          <p className="mt-6 max-w-xl font-display text-[1.55rem] font-semibold tracking-[-0.03em] text-ink-900">
            Better habits. Better academic outcomes. A better future.
          </p>
          <p className="mt-4 max-w-xl text-[16px] leading-7 text-ink-500">
            One dedicated hour. A real human Guide. A consistent academic routine.
          </p>
          <p className="mt-10 max-w-xl text-[16px] leading-7 text-ink-700">
            Their hour to focus. Your hour to breathe.
          </p>
        </Container>
      </section>

      <section className="bg-white py-16 sm:py-24">
        <Container size="wide">
          <p className="mkt-eyebrow">For every kind of student</p>
          <h2 className="mkt-display mt-3 max-w-[16ch] text-3xl text-ink-900 sm:text-4xl">
            Study Hall isn’t just for struggling students.
          </h2>
          <ul className="mt-10 divide-y divide-ink-100 border-y border-ink-100">
            {STUDENT_LEVELS.map((item) => (
              <li key={item.title} className="grid gap-1 py-5 sm:grid-cols-[minmax(0,18rem)_1fr] sm:items-baseline">
                <p className="text-[15px] font-semibold text-ink-900">{item.title}</p>
                <p className="text-[16px] text-ink-600">{item.line}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-xl text-[16px] font-medium leading-7 text-ink-800">
            There’s always something productive to do with the Study Hall Hour.
          </p>
        </Container>
      </section>

      <CtaSection
        title="Try your first Study Hall free."
        description="One dedicated hour. A real human Guide. No credit card required."
        primaryLabel={FREE_TRIAL_CTA}
        secondaryHref="/how-it-works"
        secondaryLabel="See how it works"
      />
    </div>
  );
}
