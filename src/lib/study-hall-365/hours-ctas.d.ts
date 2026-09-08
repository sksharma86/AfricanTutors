declare module "@/lib/study-hall-365/hours-ctas.mjs" {
  export const OPEN_MEMBERSHIP_ATTENTION_TITLE: string;
  export const OPEN_MEMBERSHIP_ATTENTION_BODY: string;
  export const OPEN_MEMBERSHIP_UNKNOWN_MESSAGE: string;

  export function parseOpenMembershipFlag(rpcResult: unknown): boolean | null;
  export function joinAllowedByOpenMembership(openMembership: boolean | null | undefined): boolean;

  export type StudyHall365HoursCtas = {
    kind: "entitled" | "open_not_entitled" | "not_open" | "unknown";
    showJoin: boolean;
    showManageBilling: boolean;
    showKeepMembership: boolean;
    showCancelAtPeriodEnd: boolean;
    showAttentionCopy: boolean;
    attentionTitle: string | null;
    attentionBody: string | null;
    unknownStatus: boolean;
    unknownMessage: string | null;
  };

  export function studyHall365HoursCtas(input?: {
    entitled?: boolean;
    openMembership?: boolean | null;
    hasMembership?: boolean;
    cancelAtPeriodEnd?: boolean;
  }): StudyHall365HoursCtas;
}
