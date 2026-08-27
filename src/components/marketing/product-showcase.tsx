import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

/**
 * Marketing representation of the current Parent Portal:
 * Home / Study Halls / Reports & Recordings / Hours / Account,
 * next Study Hall, join, prepaid hours, report, recording.
 */
export function ProductShowcase() {
  return (
    <section id="parent-account" className="scroll-mt-24 bg-[#eef0f3] py-16 sm:py-24">
      <Container size="wide">
        <Reveal>
          <p className="mkt-eyebrow">The parent portal</p>
          <h2 className="mkt-display mt-3 max-w-[14ch] text-4xl text-ink-900 sm:text-5xl lg:text-[3.4rem]">
            Your evening, in one place.
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-ink-500 sm:text-[16px]">
            See what’s next. Book. Join. Manage hours. Read the report. Watch the recording.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-10 overflow-hidden rounded-[22px] bg-[#f4f5f7] shadow-[0_30px_80px_-40px_rgba(11,13,16,0.42)] ring-1 ring-ink-900/[0.06]">
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-white/90 px-4 py-3 sm:px-6">
              <p className="text-[13px] font-semibold tracking-[-0.02em] text-ink-900">Study Hall (at home)</p>
              <div className="hidden items-center gap-1 md:flex" aria-hidden>
                {["Home", "Study Halls", "Reports", "Hours", "Account"].map((label, i) => (
                  <span
                    key={label}
                    className={
                      i === 0
                        ? "rounded-full bg-ink-900 px-3 py-1 text-[12px] font-medium text-white"
                        : "px-3 py-1 text-[12px] font-medium text-ink-500"
                    }
                  >
                    {label}
                  </span>
                ))}
              </div>
              <span className="text-[12px] font-medium text-ink-500">Book</span>
            </div>

            <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-7">
              <p className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-ink-900">Hi Priya</p>

              <div className="relative overflow-hidden rounded-[22px] bg-white px-5 py-6 shadow-[0_24px_60px_-32px_rgba(12,12,11,0.42)] ring-1 ring-ink-900/[0.06] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gold-400">
                <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-700 uppercase">
                  Next Study Hall
                </p>
                <p className="mt-3 font-display text-[1.75rem] font-semibold tracking-[-0.03em] text-ink-900 sm:text-3xl">
                  Tonight · 6:30 PM – 7:30 PM
                </p>
                <p className="mt-4 text-lg font-medium text-ink-900">Jordan</p>
                <p className="mt-1 text-sm text-ink-500">
                  Guide <span className="font-medium text-ink-800">James</span>
                </p>
                <div className="mt-6">
                  <span className="inline-flex rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white">
                    Join Study Hall
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/80 px-4 py-4 ring-1 ring-ink-900/[0.05]">
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">
                    Prepaid Hours
                  </p>
                  <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-ink-900">
                    11h 30m
                  </p>
                  <p className="mt-2 text-sm font-medium text-ink-800">Buy hours</p>
                </div>
                <div className="rounded-2xl bg-white/80 px-4 py-4 ring-1 ring-ink-900/[0.05]">
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">
                    Last Study Hall
                  </p>
                  <p className="mt-2 text-sm font-medium text-ink-900">Tue · Jordan</p>
                  <p className="mt-1 text-sm text-ink-500">Report ready · Recording ready</p>
                  <p className="mt-3 text-sm font-medium text-gold-700">View report</p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
