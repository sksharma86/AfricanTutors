/**
 * Guide operating method — Plan → Focus → Finish and the nothing-to-do ladder.
 * Presentation only. Does not tutor, grade, or change booking/pay state.
 */

export const PLAN_WINDOW_MIN = 10;
export const FINISH_WINDOW_MIN = 10;

export const GUIDE_METHOD_PHASES = Object.freeze([
  {
    id: "plan",
    title: "Plan",
    when: "At the start",
    prompts: ["What are you working on today?", "What should we start with?", "What would you like to finish?"],
    note: "Help the child set a simple session plan. Do not lecture or take over the work.",
  },
  {
    id: "focus",
    title: "Focus",
    when: "During Study Hall",
    prompts: [
      "Stay on task",
      "Redirect distractions gently",
      "Encourage effort",
      "Move to the next task when appropriate",
    ],
    note: "Supervise and keep accountability. Do not tutor, teach lessons, or give homework answers.",
  },
  {
    id: "finish",
    title: "Finish",
    when: "Near the end",
    prompts: ["What was completed?", "What remains?", "What should happen next?"],
    note: "Then complete the required Guide report. Do not invent a second report.",
  },
]);

export const NOTHING_TO_DO_LADDER = Object.freeze([
  {
    step: 1,
    title: "Check first",
    items: ["School portal", "Homework planner", "Backpack / folders", "Unfinished classwork", "Upcoming assignments"],
  },
  {
    step: 2,
    title: "If nothing is due right now",
    items: [
      "Review notes",
      "Organize school materials",
      "Prepare for a quiz or test",
      "Read assigned material",
      "Work on a long-term assignment or project",
    ],
  },
  {
    step: 3,
    title: "If there is genuinely nothing academic",
    items: ["Use a quiet, productive study activity that fits Study Hall", "Stay present for the booked time"],
  },
]);

/**
 * Which operating phase to highlight. Display-only; server time is unused here.
 * @param {string | null | undefined} startISO
 * @param {string | null | undefined} endISO
 * @param {number} [nowMs]
 * @returns {"plan"|"focus"|"finish"|"idle"}
 */
export function guideMethodPhase(startISO, endISO, nowMs = Date.now()) {
  if (!startISO) return "idle";
  const start = Date.parse(startISO);
  if (!Number.isFinite(start)) return "idle";
  const end = endISO ? Date.parse(endISO) : start + 60 * 60000;
  if (!Number.isFinite(end) || nowMs < start) return "plan";
  if (nowMs >= end) return "finish";
  const into = nowMs - start;
  const remaining = end - nowMs;
  if (into <= PLAN_WINDOW_MIN * 60000) return "plan";
  if (remaining <= FINISH_WINDOW_MIN * 60000) return "finish";
  return "focus";
}

export function guideMethodCopy() {
  return {
    role: "Your role is presence, encouragement, redirection, and accountability — not tutoring or homework answers.",
    stay: "Stay for the booked Study Hall. No homework is not a reason to end early.",
    join: "Ready to join 5 minutes before start.",
    callParent: "If a parent is needed, use Call Parent. Their number stays private.",
  };
}
