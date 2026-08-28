import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";
import { PARENT_PORTAL_NAV } from "@/lib/parent-portal.mjs";

/**
 * Marketing representation of the current Parent Portal Home.
 * Styling follows CustomerShell / ParentSurface / BalanceCards compact.
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
            <div className="border-b border-ink-100 bg-white/90">
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <p className="text-[13px] font-semibold tracking-[-0.02em] text-ink-900">
                  Study Hall <span className="font-medium text-ink-500">(at home)</span>
                </p>
                <span className="text-sm font-medium text-ink-600">Book</span>
              </div>
              <div className="flex flex-wrap gap-1.5 px-4 pb-2.5 sm:px-6">
                {PARENT_PORTAL_NAV.map((item, i) => (
                  <span
                    key={item.href}
                    className={
                      i === 0
                        ? "shrink-0 rounded-full bg-ink-900 px-3 py-1.5 text-[13px] font-medium text-white"
                        : "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-600"
                    }
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
              <p className="font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-ink-900">
                Hi Priya
              </p>

              <div className="relative overflow-hidden rounded-[22px] bg-white px-5 py-6 shadow-[0_24px_60px_-32px_rgba(12,12,11,0.42)] ring-1 ring-ink-900/[0.06] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gold-400 sm:px-8 sm:py-8">
                <p className="text-[11px] font-semibold tracking-[0.16em] text-gold-700 uppercase">
                  Next Study Hall
                </p>
                <p className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-ink-900 sm:text-[2.15rem]">
                  Tonight · 6:30 PM – 7:30 PM
                </p>
                <div className="mt-5">
                  <p className="text-xl font-medium text-ink-900">Jordan</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Guide <span className="font-medium text-ink-800">James</span>
                  </p>
                </div>
                <div className="mt-6">
                  <span className="inline-flex min-h-12 items-center rounded-[12px] bg-ink-900 px-6 text-[15px] font-semibold tracking-[-0.015em] text-white">
                    Join Study Hall
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/75 px-4 py-3 ring-1 ring-ink-900/[0.05]">
                <p className="text-sm text-ink-700">
                  <span className="font-semibold text-ink-900">11 hours</span>
                  <span className="text-ink-500"> available</span>
                </p>
                <p className="shrink-0 text-sm font-medium text-ink-500">Buy hours &amp; save →</p>
              </div>

              <div className="rounded-2xl bg-white/80 px-4 py-4 ring-1 ring-ink-900/[0.05] sm:px-5">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">
                  Last Study Hall
                </p>
                <p className="mt-2 text-sm font-medium text-ink-900">Tue · Jordan</p>
                <p className="mt-0.5 text-sm text-ink-500">Guide James</p>
                <p className="mt-2 text-sm text-ink-600">Report ready · Recording ready</p>
                <p className="mt-3 text-sm font-medium text-gold-700">View report</p>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
