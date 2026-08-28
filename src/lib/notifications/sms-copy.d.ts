export function parentSessionReminderSms(ctx: {
  studentName?: string | null;
  studentNames?: string[] | null;
  whenISO?: string | null;
  tz?: string | null;
}): string;

export function parentCancellationSms(ctx: {
  studentName?: string | null;
  studentNames?: string[] | null;
  whenISO?: string | null;
  tz?: string | null;
}): string;

export function parentReassignmentSms(ctx: {
  studentName?: string | null;
  studentNames?: string[] | null;
  whenISO?: string | null;
  tz?: string | null;
}): string;
