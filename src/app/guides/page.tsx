import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";
import { GUIDE_HOST } from "@/lib/guide-host.mjs";

export const metadata: Metadata = {
  title: "Become a Study Hall Guide",
  description:
    "Join Study Hall (at home) as a Guide. A flexible hour of structure and accountability — not tutoring — with real check-ins and quiet time for your own work.",
  alternates: { canonical: `https://${GUIDE_HOST}/` },
  openGraph: {
    title: "Become a Study Hall Guide",
    description:
      "A flexible hour of structure and accountability — not tutoring — with a team that trains you first.",
    url: `https://${GUIDE_HOST}/`,
  },
};

const POINTS = [
  {
    title: "A schedule you set",
    body: "Open the hours that fit your week. Families book into the time you have made available.",
  },
  {
    title: "A calm hour, not a lesson",
    body: "The child does their own homework. You hold the structure: a start, a check-in, a finish. You are not tutoring.",
  },
  {
    title: "Quiet work between check-ins",
    body: "Stay present on the hour. Between real check-ins there is room for your own reading, study, or quiet work.",
  },
  {
    title: "A team, and students who show up",
    body: "Train with Study Hall, then work from home. The hour is meaningful because a young person is building a habit with you there.",
  },
] as const;

export default function GuideRecruitmentPage() {
  return (
    <div className="guide-join">
      <header className="guide-join__bar">
        <Container size="wide" className="flex h-16 items-center justify-between gap-4">
          <BrandLockup href="/" variant="product" />
          <div className="flex items-center gap-2">
            <LinkButton href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
              Log in
            </LinkButton>
            <LinkButton href="/apply-to-tutor" variant="secondary" size="sm">
              Become a Guide
            </LinkButton>
          </div>
        </Container>
      </header>

      <section className="guide-join__hero" aria-labelledby="guide-join-title">
        <div className="guide-join__media" aria-hidden>
          <Image
            src="/images/marketing/galaxy-routine-desk.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="guide-join__photo"
          />
        </div>
        <div className="guide-join__shade" aria-hidden />
        <Container size="wide" className="guide-join__hero-inner">
          <p className="guide-join__kicker">Study Hall Guides</p>
          <h1 id="guide-join-title" className="guide-join__title">
            Be the calm in the hour.
          </h1>
          <p className="guide-join__lead">
            A Guide keeps a child company while they do their own work. Flexible hours, a quiet
            room, and a team that trains you before you ever go live.
          </p>
          <div className="guide-join__actions">
            <LinkButton href="/apply-to-tutor" variant="secondary" size="lg">
              Become a Guide
            </LinkButton>
            <LinkButton href="/login" variant="outline" size="lg" className="guide-join__login">
              Already a Guide? Log in
            </LinkButton>
          </div>
        </Container>
      </section>

      <section className="guide-join__points" aria-label="The role">
        <Container size="wide">
          <ul className="guide-join__grid">
            {POINTS.map((point) => (
              <li key={point.title}>
                <h2>{point.title}</h2>
                <p>{point.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="guide-join__close">
        <Container size="wide" className="guide-join__close-inner">
          <h2>Come do the hour with us.</h2>
          <p>Apply in a few minutes. If you already work with families, your portal is one login away.</p>
          <div className="guide-join__actions">
            <LinkButton href="/apply-to-tutor" variant="secondary" size="lg">
              Become a Guide
            </LinkButton>
            <LinkButton href="/login" variant="outline" size="lg">
              Already a Guide? Log in
            </LinkButton>
          </div>
        </Container>
      </section>

      <footer className="guide-join__foot">
        <Container size="wide" className="flex flex-col gap-3 py-8 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Study Hall (at home) · Guides</p>
          <p className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/terms" className="hover:text-ink-900">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-ink-900">
              Privacy
            </Link>
            <a href="https://studyhallathome.com" className="hover:text-ink-900">
              For families
            </a>
          </p>
        </Container>
      </footer>
    </div>
  );
}
