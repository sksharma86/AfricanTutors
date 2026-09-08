declare module "@/lib/notifications/study-hall-365-lifecycle.mjs" {
  export type StudyHall365Snapshot = {
    status?: string | null;
    cancel_at_period_end?: boolean | null;
    current_period_start?: string | null;
    current_period_end?: string | null;
    canceled_at?: string | null;
    ended_at?: string | null;
  };

  export function isoKeyPart(value: unknown): string | null;
  export function studyHall365StartedKey(subscriptionId: string): string;
  export function studyHall365RenewedKey(subscriptionId: string, periodEnd: unknown): string | null;
  export function studyHall365CancelScheduledKey(subscriptionId: string, canceledAt: unknown): string | null;
  export function studyHall365ResumedKey(subscriptionId: string, previousCanceledAt: unknown): string | null;
  export function studyHall365EndedKey(subscriptionId: string): string;
  export function wasEstablishedMembership(snapshot: StudyHall365Snapshot | null | undefined): boolean;
  export function snapshotEntitled(
    snapshot: StudyHall365Snapshot | null | undefined,
    now?: Date | string | number,
  ): boolean;
  export function classifyStudyHall365Transitions(input?: {
    applyStatus?: string | null;
    stripeSubscriptionId?: string | null;
    previous?: StudyHall365Snapshot | null;
    current?: StudyHall365Snapshot | null;
    now?: Date | string | number;
  }): { type: string; key: string }[];
  export function parseUpsertLifecycleSnapshot(upsert: unknown): {
    applyStatus: string;
    previous: StudyHall365Snapshot | null;
    current: StudyHall365Snapshot | null;
    accountId: string | null;
  } | null;
}
