export type StudyHall365Status =
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | "canceled"
  | "ended";

export const STUDY_HALL_365_STATUSES: StudyHall365Status[];
export const STUDY_HALL_365_ENTITLED_STATUSES: readonly ["active"];

export function isSubscriptionEntitled(
  status: string | null | undefined,
  opts?: {
    cancelAtPeriodEnd?: boolean;
    periodEnd?: Date | string | number | null;
    endedAt?: Date | string | number | null;
    now?: Date | string | number;
  },
): boolean;

export function evaluateStudyHall365Day(input: {
  status?: string | null;
  cancelAtPeriodEnd?: boolean;
  periodStart?: Date | string | number | null;
  periodEnd?: Date | string | number | null;
  endedAt?: Date | string | number | null;
  consumed?: boolean;
  timeZone?: string;
  localDate?: string;
  now?: Date | string | number;
  bookingStart?: Date | string | number | null;
}): {
  entitled: boolean;
  source: "study_hall_365" | "none";
  date: string;
  timeZone: string;
  reason: string;
  consumed: boolean;
};

export function chooseBookingSource(input: {
  studyHall365?: ReturnType<typeof evaluateStudyHall365Day> | null;
  prepaidMinutes?: number;
  freeTrialEligible?: boolean;
}): { source: "study_hall_365" | "free_trial" | "prepaid" | "payg"; entitled: boolean; reason: string };
