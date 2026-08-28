"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { Container } from "@/components/ui/container";

/**
 * The screen the child experiences: Guide is the dominant video,
 * the child's camera is a small self-view. No fake conferencing chrome.
 */
export function LiveStudyHallDemo() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      el.dataset.live = "1";
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.dataset.live = "1";
          io.disconnect();
        }
      },
      { threshold: 0.28 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id="live-study-hall"
      className="relative overflow-hidden bg-[#12141a] py-16 text-white sm:py-24"
    >
      <Container size="wide">
        <div className="max-w-xl">
          <h2 className="mkt-display text-4xl sm:text-5xl lg:text-[3.4rem]">This is a Study Hall.</h2>
          <p className="mt-4 text-[16px] leading-7 text-white/62">
            Present. Encouraging. Keeping things moving.
          </p>
        </div>

        <div className="sh-stage sh-stage-1 mt-10 overflow-hidden rounded-[22px] bg-[#0b0d10] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
          <div className="flex items-center justify-between px-5 py-3.5">
            <p className="text-[13px] font-semibold tracking-[-0.02em] text-white">
              Study Hall <span className="font-medium text-white/50">(at home)</span>
            </p>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/55">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Live
            </span>
          </div>

          <div className="sh-stage sh-stage-2 relative mx-3 mb-3 aspect-[4/5] overflow-hidden rounded-[16px] bg-black sm:mx-4 sm:mb-4 sm:aspect-[16/10]">
            <Image
              src="/images/tutor-portrait.jpg"
              alt="James, their Guide, present on video"
              fill
              sizes="100vw"
              className="object-cover object-[50%_18%]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 py-3 sm:px-5">
              <p className="text-sm font-medium">James</p>
              <p className="text-xs text-white/55">Your Guide</p>
            </div>

            <div className="absolute right-3 bottom-3 w-[28%] max-w-[7.5rem] overflow-hidden rounded-[12px] ring-1 ring-white/25 sm:right-4 sm:bottom-4 sm:max-w-[9rem]">
              <div className="relative aspect-[4/5]">
                <Image
                  src="/images/marketing/studyhall-focus-close.webp"
                  alt="Jordan’s camera — working independently"
                  fill
                  sizes="120px"
                  className="object-cover object-[40%_30%]"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 py-1.5">
                  <p className="text-[11px] font-medium">Jordan</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 pb-4">
            <p className="text-[13px] font-medium text-white/70">Jordan’s Study Hall</p>
          </div>
        </div>
      </Container>
    </section>
  );
}
