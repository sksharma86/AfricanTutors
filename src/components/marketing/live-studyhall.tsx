"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { Container } from "@/components/ui/container";

/**
 * Marketing demonstration of the live Study Hall experience.
 * Guide is the dominant remote participant; the child appears as a small self-view.
 * Real session chrome, no invented Daily controls, no Guide SOP copy.
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
      className="relative overflow-hidden bg-ink-900 py-16 text-white sm:py-24"
    >
      <Container size="wide">
        <div className="max-w-xl">
          <h2 className="mkt-display text-4xl sm:text-5xl lg:text-[3.4rem]">This is a Study Hall.</h2>
          <p className="mt-4 text-[16px] leading-7 text-white/62">
            Present. Encouraging. Keeping things moving.
          </p>
        </div>

        <div className="sh-stage sh-stage-1 mt-10 overflow-hidden rounded-[20px] border border-white/10 bg-[#12141a]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-gold-300 uppercase">
              Study Hall (at home) · Live
            </p>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/55">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Recording
            </span>
          </div>

          <div className="sh-stage sh-stage-2 relative aspect-[4/5] p-3 sm:aspect-[16/10] sm:p-4">
            <div className="relative h-full overflow-hidden rounded-xl bg-black">
              <Image
                src="/images/tutor-portrait.jpg"
                alt="Guide present on video during Study Hall"
                fill
                sizes="100vw"
                className="object-cover object-[50%_18%]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                <p className="text-sm font-medium">James</p>
                <p className="text-xs text-white/55">Your Guide</p>
              </div>
            </div>

            <div className="absolute right-6 bottom-6 w-[34%] max-w-[9.5rem] overflow-hidden rounded-xl border border-white/20 bg-black shadow-[0_16px_36px_-18px_rgba(0,0,0,0.75)] sm:right-8 sm:bottom-8 sm:max-w-[11rem]">
              <div className="relative aspect-[4/5]">
                <Image
                  src="/images/marketing/studyhall-focus-close.webp"
                  alt="Child working independently"
                  fill
                  sizes="140px"
                  className="object-cover object-[40%_30%]"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 py-2">
                  <p className="text-[11px] font-medium">Jordan</p>
                  <p className="text-[10px] text-white/55">Working independently</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
