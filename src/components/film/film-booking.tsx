"use client";

import { useEffect, useState } from "react";

import { ParentPage } from "@/components/dashboard/parent-page";
import { ParentSurface } from "@/components/dashboard/parent-surface";
import { Button } from "@/components/ui/button";

const CHILD = { id: "fixture-jordan", name: "Jordan", grade: "Grade 8" };
const DAYS = ["Wed 4", "Thu 5", "Fri 6", "Sat 7", "Sun 8"];
const TIMES = ["4:00 PM", "5:00 PM", "6:30 PM", "7:30 PM"];

/**
 * Display-only booking storyboard for film capture.
 * Does not call booking, checkout, or slot APIs.
 */
export function FilmBooking() {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [day, setDay] = useState("Fri 6");
  const [time, setTime] = useState("6:30 PM");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <ParentPage>
      <p className="text-sm text-[var(--pp-muted)]">← Home</p>
      <h1 className="mt-2 font-display text-[1.65rem] font-semibold tracking-[-0.03em] text-[var(--pp-ink)]">
        Book a Study Hall session
      </h1>
      <p className="mt-1 text-sm text-[var(--pp-muted)]">
        Choose your child, length, and time. We’ll match an approved Guide.
      </p>
      <ol className="mt-5 flex gap-4 text-[12px] font-medium text-[var(--pp-muted)]">
        {["Who", "Session", "Date & time", "Confirm"].map((label, i) => (
          <li key={label} className={i <= Math.min(step, 3) ? "text-[var(--pp-ink)]" : undefined}>
            <span
              className={`mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                i <= Math.min(step, 3) ? "bg-[var(--pp-ink)] text-white" : "bg-[#e8e2d6]"
              }`}
            >
              {i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <ParentSurface className="mt-6">
        {step === 0 ? (
          <div data-film="book-who">
            <p className="font-medium text-[var(--pp-ink)]">Who is joining Study Hall?</p>
            <p className="mt-1 text-sm text-[var(--pp-muted)]">Select up to 3 children.</p>
            <label className="mt-4 flex items-center gap-3 rounded-xl border border-[#c9a227]/40 bg-[#f3e6c4] px-4 py-3">
              <input type="checkbox" checked readOnly className="accent-[#c9a227]" />
              <span>
                <span className="block font-medium text-[var(--pp-ink)]">{CHILD.name}</span>
                <span className="text-sm text-[var(--pp-muted)]">{CHILD.grade}</span>
              </span>
            </label>
            <Button className="mt-6" data-film-next={ready ? "who" : undefined} onClick={() => setStep(1)}>
              Continue
            </Button>
          </div>
        ) : null}

        {step === 1 ? (
          <div data-film="book-duration">
            <p className="font-medium text-[var(--pp-ink)]">How long?</p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl border border-[#c9a227]/40 bg-[#f3e6c4] px-4 py-3 text-left"
            >
              <span className="block font-semibold text-[var(--pp-ink)]">60 minutes</span>
              <span className="text-sm text-[var(--pp-muted)]">Covered by prepaid hours</span>
            </button>
            <Button className="mt-6" data-film-next="duration" onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        ) : null}

        {step === 2 ? (
          <div data-film="book-when">
            <p className="font-medium text-[var(--pp-ink)]">When?</p>
            <div className="mt-4 flex gap-2">
              {DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  className={`min-h-11 rounded-full px-3.5 text-sm ${
                    day === d ? "bg-[var(--pp-ink)] text-white" : "bg-white text-[var(--pp-ink)]"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  className={`min-h-11 rounded-xl border px-3 text-sm ${
                    time === t
                      ? "border-[#c9a227] bg-[#f3e6c4] font-semibold"
                      : "border-[#e8e2d6] bg-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Button className="mt-6" data-film-next="when" onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        ) : null}

        {step === 3 ? (
          <div data-film="book-confirm">
            <p className="font-medium text-[var(--pp-ink)]">Confirm this Study Hall</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--pp-muted)]">Child</dt>
                <dd>{CHILD.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--pp-muted)]">When</dt>
                <dd>
                  {day} · {time}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--pp-muted)]">Duration</dt>
                <dd>60 minutes</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--pp-muted)]">Payment</dt>
                <dd>Prepaid hours · 11 hours left after</dd>
              </div>
            </dl>
            <Button className="mt-6" data-film-next="confirm" onClick={() => setStep(4)}>
              Confirm Study Hall
            </Button>
          </div>
        ) : null}

        {step === 4 ? (
          <div data-film="book-done">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#c9a227] uppercase">Confirmed</p>
            <p className="mt-3 font-display text-2xl font-semibold text-[var(--pp-ink)]">
              Jordan’s Study Hall is booked.
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--pp-muted)]">
              Friday · 6:30 PM–7:30 PM · 1 hour · covered by prepaid hours.
            </p>
          </div>
        ) : null}
      </ParentSurface>
    </ParentPage>
  );
}
