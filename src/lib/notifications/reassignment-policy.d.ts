declare module "@/lib/notifications/reassignment-policy.mjs" {
  export type ReassignmentOutcome = "successful_internal" | "session_impacted";
  export function reassignmentOutcome(reassigned: boolean): ReassignmentOutcome;
  export function reassignmentRecipients(outcome: ReassignmentOutcome): Readonly<{
    parentEmail: boolean;
    parentSms: boolean;
    newGuideAssignment: boolean;
    removedGuide: boolean;
    managerExceptionAlert: boolean;
  }>;
  export function parentSilentOnSuccessfulReassignment(reassigned: boolean): boolean;
}
