import type { Metadata } from "next";

import { StudyHallLogo } from "@/components/brand/study-hall-logo";
import { StudyHallMark } from "@/components/brand/study-hall-mark";
import { CustomerShell } from "@/components/dashboard/customer-shell";
import { GuideShell } from "@/components/dashboard/guide-shell";
import { ManagementShell } from "@/components/dashboard/management-shell";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Logo visual review",
  robots: { index: false, follow: false },
};

const SIZES = [16, 24, 32, 40, 48] as const;

/**
 * Isolated logo review. Not linked from public navigation.
 * Lives outside the marketing layout so portal chrome is not covered by the public header.
 */
export default function BrandVisualReviewPage() {
  return (
    <section className="bg-[#f4f5f7] py-12 sm:py-16">
      <Container size="wide">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-400 uppercase">
          Visual review
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-ink-900">
          Study Hall (at home) logo
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-ink-500">
          Production mark and lockup. Not a customer destination.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <figure
            data-qa="logo-light"
            className="rounded-[20px] border border-ink-100 bg-white p-8"
          >
            <figcaption className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">
              A · Full logo · light
            </figcaption>
            <div className="mt-6">
              <StudyHallLogo size={40} variant="light" />
            </div>
          </figure>

          <figure
            data-qa="logo-dark"
            className="rounded-[20px] border border-white/10 bg-[#0c0c0b] p-8"
          >
            <figcaption className="text-[11px] font-semibold tracking-[0.14em] text-white/45 uppercase">
              B · Full logo · dark
            </figcaption>
            <div className="mt-6">
              <StudyHallLogo size={40} variant="dark" />
            </div>
          </figure>

          <figure
            data-qa="mark-light"
            className="rounded-[20px] border border-ink-100 bg-white p-8"
          >
            <figcaption className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">
              C · Mark · light
            </figcaption>
            <div className="mt-6">
              <StudyHallMark size={72} variant="light" title="Study Hall (at home)" />
            </div>
          </figure>

          <figure
            data-qa="mark-dark"
            className="rounded-[20px] border border-white/10 bg-[#0c0c0b] p-8"
          >
            <figcaption className="text-[11px] font-semibold tracking-[0.14em] text-white/45 uppercase">
              D · Mark · dark
            </figcaption>
            <div className="mt-6">
              <StudyHallMark size={72} variant="dark" title="Study Hall (at home)" />
            </div>
          </figure>
        </div>

        <figure
          data-qa="mark-sizes"
          className="mt-6 rounded-[20px] border border-ink-100 bg-white p-8"
        >
          <figcaption className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">
            E · Mark sizes · 16 / 24 / 32 / 40 / 48
          </figcaption>
          <div className="mt-6 flex flex-wrap items-end gap-8">
            {SIZES.map((size) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <StudyHallMark size={size} variant="light" />
                <span className="text-[11px] text-ink-400">{size}px</span>
              </div>
            ))}
          </div>
        </figure>

        <figure className="mt-6 rounded-[20px] border border-ink-100 bg-white p-8">
          <figcaption className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">
            Monochrome
          </figcaption>
          <div className="mt-6 flex items-center gap-8 text-ink-800">
            <StudyHallMark size={48} variant="mono" />
            <StudyHallLogo size={32} variant="mono" />
          </div>
        </figure>
      </Container>

      <div className="mx-auto mt-12 max-w-[1360px] space-y-10 px-5 lg:px-8">
        <section data-qa="parent-chrome">
          <p className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">
            G / L · Parent portal chrome
          </p>
          <div className="max-h-[32rem] overflow-hidden rounded-[20px] border border-ink-100">
            <CustomerShell>
              <div className="px-6 py-10 text-sm text-ink-500">Chrome review only. Not customer data.</div>
            </CustomerShell>
          </div>
        </section>
        <section data-qa="guide-chrome">
          <p className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">
            H · Guide portal chrome
          </p>
          <div className="max-h-[32rem] overflow-hidden rounded-[20px] border border-ink-100">
            <GuideShell>
              <div className="px-6 py-10 text-sm text-ink-500">Chrome review only. Not Guide data.</div>
            </GuideShell>
          </div>
        </section>
        <section data-qa="mgmt-chrome">
          <p className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">
            I · Management portal chrome
          </p>
          <div className="max-h-[32rem] overflow-hidden rounded-[20px] border border-ink-100">
            <ManagementShell>
              <div className="px-6 py-10 text-sm text-ink-500">Chrome review only. Not operations data.</div>
            </ManagementShell>
          </div>
        </section>
      </div>
    </section>
  );
}
