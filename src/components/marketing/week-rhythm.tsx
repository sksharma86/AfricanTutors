import { ROUTINE_WEEK, type WeekDayState } from "@/lib/study-hall-hour";

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M3.2 8.2 6.4 11.3 12.8 4.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function cellClass(state: WeekDayState, tone: "light" | "dark") {
  if (tone === "dark") {
    if (state === "done") return "border-white/16 bg-white/8 text-white";
    if (state === "today") return "border-gold-300 bg-gold-400 text-ink-900";
    if (state === "scheduled") return "border-gold-300/70 bg-transparent text-gold-200";
    return "border-white/10 bg-transparent text-white/35";
  }
  if (state === "done") return "border-ink-200 bg-white text-ink-800";
  if (state === "today") return "border-ink-900 bg-ink-900 text-white";
  if (state === "scheduled") return "border-gold-500/50 bg-[#fcf3e3] text-ink-800";
  return "border-ink-100 bg-transparent text-ink-300";
}

export function WeekRhythm({
  tone = "light",
  compact = false,
}: {
  tone?: "light" | "dark";
  compact?: boolean;
}) {
  return (
    <ol
      data-qa="week-rhythm"
      className={`grid grid-cols-7 ${compact ? "gap-1 sm:gap-1.5" : "gap-1.5 sm:gap-2"}`}
    >
      {ROUTINE_WEEK.map((day) => (
        <li key={day.short}>
          <div
            className={`flex flex-col items-center justify-center rounded-[12px] border text-center ${
              compact ? "min-h-[4.5rem] px-0.5 py-2 sm:min-h-[5.25rem] sm:px-1" : "min-h-[5.25rem] px-1 py-2.5 sm:min-h-[6.25rem] sm:py-3"
            } ${cellClass(day.state, tone)}`}
          >
            <p
              className={`font-semibold tracking-[0.08em] uppercase ${
                compact ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-[11px]"
              }`}
            >
              {day.short}
            </p>
            <p className={`mt-1.5 font-medium ${compact ? "text-[11px] sm:text-[12px]" : "text-[12px] sm:text-[13px]"}`}>
              {day.state === "done" ? (
                <span className="inline-flex items-center justify-center" aria-label="Completed">
                  <CheckMark />
                </span>
              ) : day.state === "today" ? (
                "Today"
              ) : day.state === "scheduled" ? (
                "Set"
              ) : (
                <span aria-hidden>·</span>
              )}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
