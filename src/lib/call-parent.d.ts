export type EscalationReason =
  | "child_unwell"
  | "refusing_to_work"
  | "needs_parent_assistance"
  | "behavior_issue"
  | "other";

export const ESCALATION_REASONS: readonly EscalationReason[];
export const ESCALATION_REASON_LABELS: Readonly<Record<EscalationReason, string>>;
export const ESCALATION_NOTE_MAX: number;
export const ESCALATION_COOLDOWN_MS: number;
export const CALL_PARENT_VOICE_MESSAGE: string;
export const CALL_PARENT_SMS_MESSAGE: string;
export function isEscalationReason(value: string | null | undefined): value is EscalationReason;
