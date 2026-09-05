import { BrandLockup } from "@/components/brand/brand-lockup";
import { PARENT_NAV_ICONS, ParentIconPlay, ParentIconReports } from "@/components/dashboard/parent-icons";
import { Reveal } from "@/components/marketing/reveal";
import { WeekRhythm } from "@/components/marketing/week-rhythm";
import { Container } from "@/components/ui/container";
import { PARENT_PORTAL_NAV } from "@/lib/parent-portal.mjs";

/**
 * Marketing composition of a future routine-centered Parent Portal.
 * Static only — not a product screenshot and not interactive.
 */
export function ProductShowcase() {
  return (
    <section id="parent-account" className="scroll-mt-24 bg-[#eef0f3] pb-8 pt-12 sm:pb-10 sm:pt-14">
      <Container size="wide">
        <Reveal>
          <p className="mkt-eyebrow">Your Study Hall week</p>
          <h2 className="mkt-display mt-3 max-w-[14ch] text-4xl text-ink-900 sm:text-5xl lg:text-[3.4rem]">
            See the week at a glance.
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-ink-500 sm:text-[16px]">
            Tonight’s Study Hall. Completed days. What’s next. Reports and recordings when the hour is over.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mx-auto mt-8 w-full max-w-full sm:mt-10 lg:max-w-[88%]">
            <p className="mb-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
              A look at the week — marketing preview
            </p>
            <div
              aria-hidden
              className="overflow-hidden rounded-[22px] border border-[#D8D0C4] bg-[#f6f1e8] shadow-[0_18px_40px_-22px_rgba(12,12,11,0.32)] ring-1 ring-ink-900/[0.04]"
            >
              <ParentPortalPreview />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function ParentPortalPreview() {
  return (
    <div className="parent-app flex min-h-0 bg-[var(--pp-canvas)] text-[var(--pp-ink)]">
      <aside className="hidden w-[13.75rem] shrink-0 flex-col border-r border-[#1c1915]/[0.06] bg-[#f3eee4] px-3 py-4 lg:flex">
        <BrandLockup href="/" variant="product" size={22} className="pointer-events-none px-1.5" textClassName="text-[12.5px]" />
        <nav className="mt-6 flex flex-col gap-0.5" aria-hidden>
          {PARENT_PORTAL_NAV.map((item, i) => {
            const Icon = PARENT_NAV_ICONS[item.label as keyof typeof PARENT_NAV_ICONS];
            const active = i === 0;
            return (
              <span
                key={item.href}
                className={
                  active
                    ? "inline-flex min-h-10 items-center gap-2.5 rounded-[12px] bg-[#f3e6c4] px-2.5 text-[13px] font-medium text-[#5c4310] shadow-[inset_0_0_0_1px_rgba(201,162,39,0.28)]"
                    : "inline-flex min-h-10 items-center gap-2.5 rounded-[12px] px-2.5 text-[13px] font-medium text-[#3d3932]"
                }
              >
                {Icon ? <Icon className={active ? "text-[#c9a227]" : "text-[#7a7368]"} /> : null}
                {item.label}
              </span>
            );
          })}
        </nav>
        <div className="mt-auto pt-6">
          <span className="inline-flex min-h-10 w-full items-center justify-center rounded-[12px] bg-[#c9a227] px-3 text-[12.5px] font-semibold text-[#1c1915]">
            Book a Study Hall
          </span>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="border-b border-[#1c1915]/[0.06] bg-[#f6f1e8]/92 lg:hidden">
          <div className="flex h-12 items-center justify-between gap-3 px-3.5">
            <BrandLockup href="/" variant="product" size={20} className="pointer-events-none" textClassName="text-[12.5px]" />
            <span className="inline-flex min-h-9 items-center rounded-[12px] bg-[#c9a227] px-3 text-[13px] font-semibold text-[#1c1915]">
              Book
            </span>
          </div>
          <div className="flex flex-nowrap gap-1.5 overflow-x-auto px-3.5 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PARENT_PORTAL_NAV.map((item, i) => (
              <span
                key={item.href}
                className={
                  i === 0
                    ? "shrink-0 rounded-full bg-[#f3e6c4] px-3 py-1.5 text-[12.5px] font-medium text-[#5c4310] shadow-[inset_0_0_0_1px_rgba(201,162,39,0.28)]"
                    : "shrink-0 rounded-full bg-white/60 px-3 py-1.5 text-[12.5px] font-medium text-[#3d3932]"
                }
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="px-3.5 py-3.5 sm:px-5 sm:py-4">
          <p className="text-[13px] font-medium text-[var(--pp-muted)]">Good evening,</p>
          <p className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--pp-ink)]">
            Priya
          </p>

          <div className="mt-3">
            <NextHero />
          </div>

          <div className="mt-3 rounded-[16px] bg-[var(--pp-card)] px-3 py-3 ring-1 ring-[#1c1915]/[0.05]">
            <p className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">
              This week
            </p>
            <WeekRhythm compact />
          </div>

          <div className="mt-3 hidden gap-2.5 sm:grid sm:grid-cols-2">
            <RecentCard />
            <UpcomingCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function NextHero() {
  return (
    <div className="pp-hero relative overflow-hidden rounded-[18px] bg-[#161c18] px-4 py-4 text-[#F6F1E8] shadow-[var(--pp-shadow-2)] before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-[3px] before:bg-gold-400 sm:rounded-[22px] sm:px-5 sm:py-5">
      <div className="pp-hero-atmosphere" />
      <div className="relative">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-gold-300 uppercase">Tonight’s Study Hall</p>
        <p className="mt-2 font-display text-[2.05rem] font-semibold leading-[0.96] tracking-[-0.045em] text-white sm:text-[2.45rem]">
          6:30 PM
        </p>
        <p className="mt-1.5 text-[13px] text-white/68">Thursday · 60 minutes</p>
        <div className="mt-3 border-t border-white/12 pt-3">
          <p className="text-[1.05rem] font-medium tracking-[-0.02em] text-white">Jordan</p>
          <p className="mt-0.5 text-[13px] text-white/60">
            with Guide <span className="font-medium text-white/86">James</span>
          </p>
        </div>
        <div className="mt-4">
          <span className="inline-flex min-h-11 items-center rounded-[12px] bg-[#c9a227] px-5 text-[14px] font-semibold text-[#1c1915]">
            Join Study Hall →
          </span>
        </div>
      </div>
    </div>
  );
}

function RecentCard() {
  return (
    <div className="rounded-[16px] bg-[var(--pp-card)] px-3.5 py-3 ring-1 ring-[#1c1915]/[0.05]">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Completed</p>
      <p className="mt-2 text-[12.5px] text-[var(--pp-muted)]">Tue · 6:30 PM</p>
      <p className="mt-0.5 text-[13.5px] font-medium text-[var(--pp-ink)]">Jordan</p>
      <p className="text-[12.5px] text-[var(--pp-muted)]">with Guide Sarah</p>
      <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-[var(--pp-positive)]">
        <ParentIconReports className="h-3.5 w-3.5" />
        Report ready
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-[var(--pp-positive)]">
        <ParentIconPlay className="h-3.5 w-3.5" />
        Recording ready
      </p>
      <p className="mt-2.5 text-[12.5px] font-medium text-[var(--pp-ink)]">Read report</p>
    </div>
  );
}

function UpcomingCard() {
  return (
    <div className="rounded-[16px] bg-[var(--pp-card)] px-3.5 py-3 ring-1 ring-[#1c1915]/[0.05]">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Upcoming</p>
      <p className="mt-2 text-[12.5px] text-[var(--pp-muted)]">Fri · 6:30 PM</p>
      <p className="mt-0.5 text-[13.5px] font-medium text-[var(--pp-ink)]">Jordan</p>
      <p className="text-[12.5px] text-[var(--pp-muted)]">with Guide James</p>
      <p className="mt-2 text-[13.5px] font-medium text-[var(--pp-ink)]">Scheduled.</p>
      <p className="mt-0.5 text-[12px] leading-5 text-[var(--pp-muted)]">
        One more hour this week. Same routine, whatever the work is.
      </p>
    </div>
  );
}
