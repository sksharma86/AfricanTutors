/**
 * Customer-facing Study Hall Hour language and method copy.
 * Marketing only — does not change booking, Guide workflow, or reports.
 */

export const STUDY_HALL_HOUR_USES = [
  "Homework",
  "Studying",
  "Reading",
  "Test preparation",
  "Projects",
  "Research",
  "Reviewing",
  "Catching up",
  "Working ahead",
  "School organization",
] as const;

export const STUDY_HALL_METHOD = [
  {
    id: "plan",
    title: "Plan",
    lead: "The student and Guide set a simple goal for the hour.",
    prompts: [
      "What are we working on today?",
      "What do you want to accomplish?",
      "Anything coming up that we should make time for?",
    ],
  },
  {
    id: "focus",
    title: "Focus",
    lead: "The child works independently. The Guide stays present.",
    prompts: [
      "Keeps the student accountable",
      "Checks progress",
      "Encourages continued work",
      "Redirects distraction",
      "Helps attention return to the task",
    ],
  },
  {
    id: "finish",
    title: "Finish",
    lead: "They look back at the hour, then the Guide writes the parent report.",
    prompts: [
      "What did we get done?",
      "Anything still unfinished?",
      "Anything you should work on next time?",
    ],
  },
] as const;

export type WeekDayState = "done" | "today" | "scheduled" | "open";

export interface WeekDay {
  label: string;
  short: string;
  state: WeekDayState;
  caption: string;
}

/** Tasteful weekly rhythm for marketing — not a live scheduler. */
export const ROUTINE_WEEK: readonly WeekDay[] = [
  { label: "Monday", short: "Mon", state: "done", caption: "Done" },
  { label: "Tuesday", short: "Tue", state: "done", caption: "Done" },
  { label: "Wednesday", short: "Wed", state: "done", caption: "Done" },
  { label: "Thursday", short: "Thu", state: "today", caption: "Today" },
  { label: "Friday", short: "Fri", state: "scheduled", caption: "Scheduled" },
  { label: "Saturday", short: "Sat", state: "open", caption: "" },
  { label: "Sunday", short: "Sun", state: "open", caption: "" },
];

export const NOTHING_DUE_USES = [
  "Read.",
  "Review something that was difficult this week.",
  "Prepare for an upcoming test.",
  "Work ahead on a project.",
  "Organize assignments.",
  "Catch up on something that has been neglected.",
] as const;

export const STUDENT_LEVELS = [
  { title: "Behind on assignments?", line: "Catch up." },
  { title: "Everything finished?", line: "Work ahead." },
  { title: "Test next week?", line: "Prepare." },
  { title: "Nothing due?", line: "Read." },
  { title: "Big project coming?", line: "Start now." },
  { title: "Already doing well?", line: "Build the habits that help keep it that way." },
] as const;
