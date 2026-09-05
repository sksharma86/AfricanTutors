export const STUDY_HALL_HOUR_USES = [
  "Homework",
  "Studying",
  "Reading",
  "Test prep",
  "Projects",
  "Research",
  "Reviewing",
  "Catching up",
  "Working ahead",
  "School organization",
] as const;

export const STUDY_HALL_METHOD = [
  { title: "Plan", line: "Know what you’re working on." },
  { title: "Focus", line: "Use the hour well." },
  { title: "Finish", line: "Leave knowing what got done." },
] as const;

export const ROUTINE_WEEK = [
  { day: "Mon", mark: "✓" },
  { day: "Tue", mark: "✓" },
  { day: "Wed", mark: "✓" },
  { day: "Thu", mark: "Today" },
  { day: "Fri", mark: "6 PM" },
  { day: "Sat", mark: "·" },
  { day: "Sun", mark: "·" },
] as const;
