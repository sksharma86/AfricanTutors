"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { Container } from "@/components/ui/container";

/**
 * Marketing demonstration of the REAL session room:
 * dark chrome, Guide/child tiles, T−5 join rule, recording notice.
 * No invented Daily controls.
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
      className="relative overflow-hidden bg-ink-900 py-20 text-white sm:py-28"
    >
      <Container size="wide">
        <div className="max-w-xl">
          <p className="text-[13px] font-medium tracking-[0.16em] text-white/45 uppercase">The live hour</p>
          <h2 className="mkt-display mt-3 text-4xl sm:text-5xl lg:text-[3.4rem]">
            This is a Study Hall.
          </h2>
          <p className="mt-4 max-w-[32rem] text-[16px] leading-7 text-white/65">
            Your child works from home. Their Guide stays on video — present, calm, and ready to
            redirect. Homework stays theirs. Supervision stays live.
          </p>
        </div>

        <div className="sh-stage sh-stage-1 mt-12 overflow-hidden rounded-[20px] border border-white/10 bg-[#12141a]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-gold-300 uppercase">
                Study Hall (at home) · Live session
              </p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.03em]">Study Hall</p>
              <p className="text-sm text-white/50">Guide: James · Tonight · 60 minutes</p>
            </div>
            <div className="sh-stage sh-stage-3 flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 font-medium text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Recording
              </span>
              <span className="font-mono tabular-nums text-white/45">42:18</span>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-[1.4fr_0.8fr] sm:p-5">
            <div className="sh-stage sh-stage-2 relative aspect-[16/10] overflow-hidden rounded-xl bg-black">
              <Image
                src="/images/student-tutoring-session.jpg"
                alt="Child working at home during Study Hall"
                fill
                sizes="(max-width: 768px) 100vw, 60vw"
                className="object-cover object-[30%_30%]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 py-3">
                <p className="text-sm font-medium">Jordan · Working</p>
                <p className="text-xs text-white/55">Homework in front of them · camera on</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="sh-stage sh-stage-2 relative min-h-[11rem] flex-1 overflow-hidden rounded-xl bg-black sm:min-h-0">
                <Image
                  src="/images/tutor-portrait.jpg"
                  alt="Guide present on video from their remote workspace"
                  fill
                  sizes="(max-width: 768px) 100vw, 30vw"
                  className="object-cover object-[50%_20%]"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2.5">
                  <p className="text-sm font-medium">James · Guide</p>
                  <p className="text-xs text-white/55">Supervising — not tutoring</p>
                </div>
              </div>
              <div className="sh-stage sh-stage-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-white/70">
                Stay present. Encourage focus. Redirect gently. Do not teach lessons or give
                homework answers.
              </div>
            </div>
          </div>

          <div className="sh-stage sh-stage-3 flex flex-col gap-3 border-t border-white/10 px-5 py-4 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>This Study Hall session is recorded for quality assurance, safety, and dispute resolution.</p>
            <p className="font-medium text-white/85">Ready to join 5 minutes before start</p>
          </div>
        </div>
      </Container>
    </section>
  );
}
