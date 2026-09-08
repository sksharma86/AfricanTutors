declare module "@/lib/guide-operating-method.mjs" {
  export const PLAN_WINDOW_MIN: number;
  export const FINISH_WINDOW_MIN: number;
  export const GUIDE_METHOD_PHASES: readonly {
    id: "plan" | "focus" | "finish";
    title: string;
    when: string;
    prompts: readonly string[];
    note: string;
  }[];
  export const NOTHING_TO_DO_LADDER: readonly {
    step: number;
    title: string;
    items: readonly string[];
  }[];
  export function guideMethodPhase(
    startISO: string | null | undefined,
    endISO: string | null | undefined,
    nowMs?: number,
  ): "plan" | "focus" | "finish" | "idle";
  export function guideMethodCopy(): { role: string; stay: string; join: string; callParent: string };
}
