"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type PortalStep = "plan" | "next" | "join" | "review";

export const PORTAL_STEPS: ReadonlyArray<{ id: PortalStep; title: string; copy: string }> = [
  {
    id: "plan",
    title: "Plan the week.",
    copy: "See what’s coming up and plan Study Halls for the week.",
  },
  {
    id: "next",
    title: "See what’s next.",
    copy: "Your next Study Hall, the time, and the Guide, right at the top.",
  },
  {
    id: "join",
    title: "Join when it’s time.",
    copy: "One click to join your child’s Study Hall.",
  },
  {
    id: "review",
    title: "See how it went.",
    copy: "Read the report and watch the recording after each Study Hall.",
  },
];

const STAGE_QUERY = "(min-width: 1024px)";

/**
 * Sticky product reveal. The Parent Portal stays anchored while four short
 * statements scroll past; whichever statement crosses the middle of the
 * viewport becomes the active step and CSS illuminates that region.
 * Below the desktop breakpoint the stage is static and fully lit.
 */
export function PortalReveal({ stage }: { stage: ReactNode }) {
  const stepsRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState<PortalStep | null>(null);

  useEffect(() => {
    const list = stepsRef.current;
    if (!list) return;
    const mq = window.matchMedia(STAGE_QUERY);
    let io: IntersectionObserver | null = null;

    const stop = () => {
      io?.disconnect();
      io = null;
      setActive(null);
    };

    const start = () => {
      stop();
      if (!mq.matches) return;
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const id = (entry.target as HTMLElement).dataset.step as PortalStep | undefined;
            if (id) setActive(id);
          }
        },
        { rootMargin: "-42% 0px -42% 0px", threshold: 0 },
      );
      for (const step of list.querySelectorAll<HTMLElement>("[data-step]")) io.observe(step);
    };

    start();
    mq.addEventListener("change", start);
    return () => {
      mq.removeEventListener("change", start);
      stop();
    };
  }, []);

  return (
    <div className="sh-home-portal__reveal" data-live={active ? "1" : undefined}>
      <ol ref={stepsRef} className="sh-home-portal__steps">
        {PORTAL_STEPS.map((step, i) => (
          <li
            key={step.id}
            data-step={step.id}
            data-active={active === step.id ? "1" : undefined}
            className="sh-home-portal__step"
          >
            <span className="sh-home-portal__step-index" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="sh-home-display sh-home-portal__step-title">{step.title}</p>
            <p className="sh-home-portal__step-copy">{step.copy}</p>
          </li>
        ))}
      </ol>

      <div className="sh-home-portal__stage-wrap">
        <div className="sh-home-portal__stage" data-step={active ?? undefined}>
          <div className="sh-home-portal__frame">{stage}</div>
        </div>
      </div>
    </div>
  );
}
