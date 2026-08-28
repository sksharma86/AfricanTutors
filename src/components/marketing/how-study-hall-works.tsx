import type { ReactNode } from "react";
import Image from "next/image";

const GOLD = "#C99125";
const CREAM = "#FCFAF6";
const DIVIDER = "#E6E0D7";
const BORDER = "#E6DED1";

function ProductHouseMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M5 14.2 16 5.5l11 8.7V26a1.5 1.5 0 0 1-1.5 1.5h-19A1.5 1.5 0 0 1 5 26V14.2Z"
        stroke={GOLD}
        strokeWidth="1.8"
      />
      <path d="M12.2 27.5V18.4h7.6v9.1" stroke={GOLD} strokeWidth="1.8" />
    </svg>
  );
}

function StepCircle({ n }: { n: 1 | 2 | 3 }) {
  return (
    <span
      data-qa="hshw-step-circle"
      className="inline-flex size-[44px] shrink-0 items-center justify-center rounded-full text-[24px] font-bold text-white lg:size-[42px] lg:text-[22px]"
      style={{ backgroundColor: GOLD }}
      aria-hidden="true"
    >
      {n}
    </span>
  );
}

function GoldRightArrow() {
  return (
    <svg width="36" height="18" viewBox="0 0 36 18" fill="none" aria-hidden="true">
      <path d="M1 9h28" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
      <path d="M23 2.5 33 9l-10 6.5" stroke={GOLD} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GoldDownArrow() {
  return (
    <svg width="18" height="36" viewBox="0 0 18 36" fill="none" aria-hidden="true">
      <path d="M9 1v28" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
      <path d="M2.5 23 9 33l6.5-10" stroke={GOLD} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarClockIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <rect x="8" y="11" width="28" height="26" rx="3" stroke="#111" strokeWidth="2" />
      <path d="M8 19h28" stroke="#111" strokeWidth="2" />
      <path d="M16 8v6M28 8v6" stroke="#111" strokeWidth="2" strokeLinecap="round" />
      <circle cx="36" cy="34" r="9.5" stroke="#111" strokeWidth="2" />
      <path d="M36 29.5v5l3.5 2" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LaptopUserIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <rect x="8" y="10" width="36" height="22" rx="3" stroke="#111" strokeWidth="2" />
      <path d="M6 38h40l-4-6H10l-4 6Z" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="26" cy="18" r="4" stroke="#111" strokeWidth="2" />
      <path d="M19 28c1.4-3.2 3.8-4.6 7-4.6s5.6 1.4 7 4.6" stroke="#111" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DocumentCheckIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <path d="M16 8h14l10 10v26H16V8Z" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
      <path d="M30 8v10h10" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
      <path d="M22 28h12M22 34h8" stroke="#111" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 22.5 25 25.5 31 19.5" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VideoPlayerIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <rect x="7" y="12" width="38" height="28" rx="4" stroke="#111" strokeWidth="2" />
      <path d="M22 20.5v11l10-5.5-10-5.5Z" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" fill="none" aria-hidden="true">
      <circle cx="17" cy="15" r="5.5" stroke={GOLD} strokeWidth="2" />
      <path d="M7.5 32.5c1.4-6 5-9 9.5-9s8.1 3 9.5 9" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
      <circle cx="30.5" cy="14.5" r="4.5" stroke={GOLD} strokeWidth="2" />
      <path d="M29 23.5c4.2.3 7.2 3.2 8.5 8.5" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="40" height="42" viewBox="0 0 40 42" fill="none" aria-hidden="true">
      <path
        d="M20 3.5 6 9.2v11.4c0 8.4 5.6 15.4 14 17.9 8.4-2.5 14-9.5 14-17.9V9.2L20 3.5Z"
        stroke={GOLD}
        strokeWidth="2"
      />
      <path d="M16 22.2v-3.1a4 4 0 0 1 8 0v3.1" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
      <rect x="14.5" y="22" width="11" height="8.5" rx="1.6" stroke={GOLD} strokeWidth="2" />
    </svg>
  );
}

function StageHeading({ children }: { children: string }) {
  return (
    <h3 className="text-center text-[30px] font-bold uppercase tracking-[-0.02em] text-ink lg:text-[27px]">
      {children}
    </h3>
  );
}

function FlowItem({
  iconBg,
  icon,
  title,
  body,
  titleClassName = "",
  matchHeight = false,
}: {
  iconBg: string;
  icon: ReactNode;
  title: string;
  body: string;
  titleClassName?: string;
  matchHeight?: boolean;
}) {
  return (
    <div className={`flex items-start gap-[16px] lg:gap-[14px] ${matchHeight ? "lg:min-h-[118px]" : ""}`}>
      <span
        data-qa="hshw-icon-circle"
        className="inline-flex size-[72px] shrink-0 items-center justify-center rounded-full lg:size-[72px] [&>svg]:size-[52px] lg:[&>svg]:size-[38px]"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className={`text-[20px] font-bold leading-[1.2] text-ink lg:text-[18px] ${titleClassName}`}>{title}</p>
        <p className="mt-[8px] text-[17px] leading-[1.5] text-[#333] lg:mt-1.5 lg:text-[16px] lg:leading-[1.45]">{body}</p>
      </div>
    </div>
  );
}

function TrustFooter() {
  return (
    <div className="mx-auto mt-8 w-full max-w-[800px] lg:mt-4" data-qa="hshw-trust">
      <div className="flex items-center justify-center gap-3">
        <span className="h-px w-[120px] lg:w-[300px]" style={{ backgroundColor: GOLD }} />
        <ShieldIcon />
        <span className="h-px w-[120px] lg:w-[300px]" style={{ backgroundColor: GOLD }} />
      </div>
      <p className="mt-3 text-center text-[16px] leading-[1.45] text-[#222] lg:mt-2 lg:text-[16px] lg:whitespace-nowrap">
        <strong className="font-bold text-ink">Safe. Structured. Reliable.</strong>{" "}
        Vetted Guides, recorded sessions, and parent contact when needed.
      </p>
    </div>
  );
}

export function HowStudyHallWorks({ showHeadline = true }: { showHeadline?: boolean }) {
  return (
    <section
      id="how-it-works"
      data-qa="how-study-hall-works"
      aria-labelledby="how-study-hall-works-label"
      className="px-5 py-8 lg:px-0 lg:pb-5 lg:pt-6"
      style={{ backgroundColor: CREAM }}
    >
      <div className="mx-auto w-full max-w-[1360px] lg:w-[94%]">
        <div className="flex flex-col items-center text-center" data-qa="hshw-header">
          <div className="flex items-center justify-center gap-2.5">
            <ProductHouseMark />
            <p
              id="how-study-hall-works-label"
              className="text-[18px] font-semibold uppercase tracking-[0.04em] lg:text-[17px]"
              style={{ color: GOLD }}
            >
              How Study Hall Works
            </p>
          </div>
          {showHeadline ? (
            <h2
              data-phrase="Book. Study Hall. Done."
              className="mt-4 text-[44px] font-extrabold leading-[1.02] tracking-[-0.035em] text-ink lg:mt-3 lg:text-[56px] lg:leading-[1.02] lg:whitespace-nowrap"
            >
              Book.
              <br className="lg:hidden" /> Study Hall.
              <br className="lg:hidden" /> Done.
            </h2>
          ) : null}
          <p className="mt-3.5 max-w-[34rem] text-[18px] font-medium leading-[1.45] text-[#444] lg:mt-2.5 lg:max-w-none lg:text-[21px] lg:font-normal">
            Simple for parents. Focused for kids. Real support from a live Guide.
          </p>
        </div>

        {/* Desktop flowchart */}
        <div className="mt-8 hidden lg:mt-6 lg:grid lg:grid-cols-[23%_3%_48%_3%_23%] lg:items-start" data-qa="hshw-desktop">
          <div className="flex flex-col items-center" data-qa="hshw-book">
            <StepCircle n={1} />
            <div className="mt-2">
              <StageHeading>Book</StageHeading>
            </div>
            <div className="mt-7 w-full">
              <FlowItem
                iconBg="#FBF3E3"
                icon={<CalendarClockIcon />}
                title="Choose your time."
                body="Choose when you want your child to sit down and focus."
                matchHeight
              />
              <div className="my-4 h-px w-full" style={{ backgroundColor: DIVIDER }} />
              <FlowItem
                iconBg="#EAF4F8"
                icon={<LaptopUserIcon />}
                title="Join from your Parent Portal."
                titleClassName="max-w-[12ch]"
                body="When it’s time, open your Parent Portal and join Study Hall."
              />
            </div>
          </div>

          <div className="flex items-center justify-center self-stretch" aria-hidden="true">
            <GoldRightArrow />
          </div>

          <div
            className="relative mx-auto flex w-full flex-col items-center rounded-[20px] border px-2 pb-4 pt-3.5 xl:px-3"
            data-qa="hshw-study"
            style={{ backgroundColor: CREAM, borderColor: BORDER }}
          >
            <div className="relative flex w-full items-center justify-center">
              <span className="absolute left-1 top-0 xl:left-2">
                <StepCircle n={2} />
              </span>
              <StageHeading>Study Hall</StageHeading>
            </div>
            <div className="mt-5 flex items-center justify-center gap-4">
              <span className="h-px w-[48px]" style={{ backgroundColor: GOLD }} />
              <p className="text-[16px] font-bold uppercase tracking-[0.04em]" style={{ color: GOLD }}>
                LIVE GUIDE PRESENCE
              </p>
              <span className="h-px w-[48px]" style={{ backgroundColor: GOLD }} />
            </div>

            <div className="mt-4 grid w-full grid-cols-2 gap-x-8 xl:mt-5 xl:gap-x-12">
              <div className="relative col-span-2 grid grid-cols-2 gap-x-8 xl:gap-x-12">
                <Image
                  src="/images/marketing/studyhall-hero-desk.webp"
                  alt="A school-age child seated at a desk, focused on homework"
                  width={238}
                  height={192}
                  data-qa="hshw-child-photo"
                  className="aspect-[238/192] h-auto w-full justify-self-end rounded-[16px] object-cover xl:h-[192px] xl:w-[238px]"
                />
                <Image
                  src="/images/tutor-portrait.jpg"
                  alt="A friendly adult Guide at a computer, present and engaged"
                  width={238}
                  height={192}
                  data-qa="hshw-guide-photo"
                  className="aspect-[238/192] h-auto w-full justify-self-start rounded-[16px] object-cover object-[50%_18%] xl:h-[192px] xl:w-[238px]"
                />
                <span
                  className="pointer-events-none absolute inset-0 flex items-center justify-center text-[36px] font-medium leading-none text-ink"
                  aria-hidden="true"
                >
                  +
                </span>
              </div>
              <p
                className="mx-auto mt-2 flex h-[34px] w-[min(140px,100%)] items-center justify-center rounded-full text-[15px] font-semibold text-ink"
                style={{ backgroundColor: "#E7F2F7" }}
              >
                YOUR CHILD
              </p>
              <p
                className="mx-auto mt-2 flex h-[34px] w-[min(140px,100%)] items-center justify-center rounded-full text-[15px] font-semibold text-ink"
                style={{ backgroundColor: "#ECF5DE" }}
              >
                THEIR GUIDE
              </p>
              <p className="mx-auto mt-2 max-w-[16rem] text-center text-[16px] leading-[1.4] text-[#222]">
                Works independently on homework or studying.
              </p>
              <p className="mx-auto mt-2 max-w-[17rem] text-center text-[16px] leading-[1.4] text-[#222]">
                Stays present with encouragement and redirection to keep the session focused and moving.
              </p>
            </div>

            <div className="mt-3.5 h-px w-[88%]" style={{ backgroundColor: DIVIDER }} />
            <div className="mt-3 flex items-center justify-center gap-2.5">
              <span className="inline-flex lg:[&>svg]:size-9">
                <PeopleIcon />
              </span>
              <div className="text-left">
                <p className="text-[18px] font-bold leading-tight text-ink">Focused time. Real progress.</p>
                <p className="mt-0.5 text-[15px] leading-snug text-[#333]">
                  Your child works. The Guide keeps things on track.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center self-stretch" aria-hidden="true">
            <GoldRightArrow />
          </div>

          <div className="flex flex-col items-center" data-qa="hshw-report">
            <StepCircle n={3} />
            <div className="mt-2">
              <StageHeading>Report</StageHeading>
            </div>
            <div className="mt-7 w-full">
              <FlowItem
                iconBg="#EAF4F8"
                icon={<DocumentCheckIcon />}
                title="Session report."
                body="Get your Guide’s report after Study Hall."
                matchHeight
              />
              <div className="my-4 h-px w-full" style={{ backgroundColor: DIVIDER }} />
              <FlowItem
                iconBg="#EDF5DF"
                icon={<VideoPlayerIcon />}
                title="Recording available."
                body="View the full session securely in your Parent Portal."
              />
            </div>
          </div>
        </div>

        {/* Mobile flowchart */}
        <div className="mt-8 flex flex-col items-center lg:hidden" data-qa="hshw-mobile">
          <div className="flex w-full flex-col items-center" data-qa="hshw-mobile-book">
          <StepCircle n={1} />
          <div className="mt-2.5">
            <StageHeading>Book</StageHeading>
          </div>
          <div className="mt-6 w-full space-y-6">
            <FlowItem
              iconBg="#FBF3E3"
              icon={<CalendarClockIcon />}
              title="Choose your time."
              body="Choose when you want your child to sit down and focus."
            />
            <div className="h-px w-full" style={{ backgroundColor: DIVIDER }} />
            <FlowItem
              iconBg="#EAF4F8"
              icon={<LaptopUserIcon />}
              title="Join from your Parent Portal."
              body="When it’s time, open your Parent Portal and join Study Hall."
            />
          </div>
          </div>

          <div className="my-6" aria-hidden="true">
            <GoldDownArrow />
          </div>

          <div
            className="w-full rounded-[19px] border px-[21px] py-5"
            data-qa="hshw-mobile-study"
            style={{ backgroundColor: CREAM, borderColor: BORDER }}
          >
            <div className="flex flex-col items-center">
              <StepCircle n={2} />
              <div className="mt-2.5">
                <StageHeading>Study Hall</StageHeading>
              </div>
              <div className="mt-6 flex w-full items-center justify-center gap-3">
                <span className="h-px w-10" style={{ backgroundColor: GOLD }} />
                <p className="text-[16px] font-bold uppercase tracking-[0.04em]" style={{ color: GOLD }}>
                  LIVE GUIDE PRESENCE
                </p>
                <span className="h-px w-10" style={{ backgroundColor: GOLD }} />
              </div>
              <Image
                src="/images/marketing/studyhall-hero-desk.webp"
                alt="A school-age child seated at a desk, focused on homework"
                width={350}
                height={263}
                className="mt-5 aspect-[4/3] h-auto w-full rounded-[16px] object-cover"
              />
              <p
                className="mt-2.5 flex h-[38px] w-[152px] items-center justify-center rounded-full text-[16px] font-semibold text-ink"
                style={{ backgroundColor: "#E7F2F7" }}
              >
                YOUR CHILD
              </p>
              <p className="mt-3 max-w-[18rem] text-center text-[17px] leading-[1.4] text-[#222]">
                Works independently on homework or studying.
              </p>
              <p className="my-4 text-[42px] font-medium leading-none text-ink" aria-hidden="true">
                +
              </p>
              <Image
                src="/images/tutor-portrait.jpg"
                alt="A friendly adult Guide at a computer, present and engaged"
                width={350}
                height={263}
                className="aspect-[4/3] h-auto w-full rounded-[16px] object-cover object-[50%_18%]"
              />
              <p
                className="mt-2.5 flex h-[38px] w-[152px] items-center justify-center rounded-full text-[16px] font-semibold text-ink"
                style={{ backgroundColor: "#ECF5DE" }}
              >
                THEIR GUIDE
              </p>
              <p className="mt-3 max-w-[20rem] text-center text-[17px] leading-[1.4] text-[#222]">
                Stays present with encouragement and redirection to keep the session focused and moving.
              </p>
              <div className="mt-5 h-px w-[90%]" style={{ backgroundColor: DIVIDER }} />
              <div className="mt-5 flex flex-col items-center text-center">
                <PeopleIcon />
                <p className="mt-2 text-[19px] font-bold text-ink">Focused time. Real progress.</p>
                <p className="mt-1 text-[16px] leading-snug text-[#333]">
                  Your child works. The Guide keeps things on track.
                </p>
              </div>
            </div>
          </div>

          <div className="my-6" aria-hidden="true">
            <GoldDownArrow />
          </div>

          <div className="flex w-full flex-col items-center" data-qa="hshw-mobile-report">
          <StepCircle n={3} />
          <div className="mt-2.5">
            <StageHeading>Report</StageHeading>
          </div>
          <div className="mt-6 w-full space-y-6">
            <FlowItem
              iconBg="#EAF4F8"
              icon={<DocumentCheckIcon />}
              title="Session report."
              body="Get your Guide’s report after Study Hall."
            />
            <div className="h-px w-full" style={{ backgroundColor: DIVIDER }} />
            <FlowItem
              iconBg="#EDF5DF"
              icon={<VideoPlayerIcon />}
              title="Recording available."
              body="View the full session securely in your Parent Portal."
            />
          </div>
          </div>
        </div>

        <div className="flex justify-center lg:hidden" aria-hidden="true">
          <div className="my-6">
            <GoldDownArrow />
          </div>
        </div>

        <TrustFooter />
      </div>
    </section>
  );
}
