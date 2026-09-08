import { GUIDE_METHOD_PHASES, NOTHING_TO_DO_LADDER, guideMethodCopy, guideMethodPhase } from "@/lib/guide-operating-method.mjs";
import { GuideSurface } from "@/components/dashboard/guide-surface";

export function GuideOperatingMethod({
  scheduledStart,
  scheduledEnd,
  nowMs,
  tone = "home",
  ladderOpen = false,
}: {
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  nowMs?: number;
  tone?: "home" | "session";
  ladderOpen?: boolean;
}) {
  const phase = guideMethodPhase(scheduledStart, scheduledEnd, nowMs ?? Date.now());
  const copy = guideMethodCopy();
  const ink = tone === "session" ? "text-white" : "text-[var(--gp-ink)]";
  const muted = tone === "session" ? "text-ink-300" : "text-[var(--gp-muted)]";
  const activeBg = tone === "session" ? "rounded-xl bg-white/6 px-2.5 py-2" : "rounded-xl bg-[rgba(201,162,39,0.08)] px-2.5 py-2";

  const body = (
    <>
      <p className={`text-[10px] font-semibold tracking-[0.14em] uppercase ${muted}`}>During Study Hall</p>
      <p className={`mt-2 text-[12.5px] leading-5 ${muted}`}>{copy.role}</p>
      <p className={`mt-1 text-[12.5px] leading-5 ${muted}`}>{copy.join}</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {GUIDE_METHOD_PHASES.map((step) => {
          const active = phase === step.id;
          return (
            <li key={step.id} data-phase={step.id} data-active={active ? "true" : "false"} className={active ? activeBg : ""}>
              <p className={`text-[13px] font-medium ${ink}`}>
                {step.title}
                <span className={`ml-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase ${muted}`}>{step.when}</span>
              </p>
              <ul className={`mt-1 space-y-0.5 text-[12.5px] leading-5 ${muted}`}>
                {step.prompts.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className={`mt-1.5 text-[12px] leading-5 ${muted}`}>{step.note}</p>
            </li>
          );
        })}
      </ul>
      <details className="mt-3" open={ladderOpen || undefined}>
        <summary className={`cursor-pointer text-[12.5px] font-medium ${ink}`}>If they say there is no homework</summary>
        <p className={`mt-1.5 text-[12.5px] leading-5 ${muted}`}>{copy.stay}</p>
        <ol className="mt-2 space-y-2">
          {NOTHING_TO_DO_LADDER.map((rung) => (
            <li key={rung.step}>
              <p className={`text-[12.5px] font-medium ${ink}`}>
                Step {rung.step}. {rung.title}
              </p>
              <ul className={`mt-0.5 list-disc pl-4 text-[12.5px] leading-5 ${muted}`}>
                {rung.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </details>
      <p className={`mt-3 text-[12.5px] leading-5 ${muted}`}>{copy.callParent}</p>
    </>
  );

  if (tone === "session") {
    return <div className="rounded-lg border border-forest-700/50 bg-forest-950/40 p-3">{body}</div>;
  }
  return <GuideSurface className="px-4 py-3.5">{body}</GuideSurface>;
}
