export function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signatureHeader: string | null | undefined,
): boolean;

export const TWILIO_CALL_FAILURE_STATUSES: readonly string[];
export const TWILIO_CALL_ANSWERED_STATUS: string;
export const TWILIO_CALL_INTERMEDIATE_STATUSES: readonly string[];
export const TWILIO_AMD_MACHINE_VALUES: readonly string[];

export function classifyTwilioCallStatus(
  callStatus: string | null | undefined,
): "completed" | "failed" | "intermediate" | "unknown";

export function classifyTwilioAnsweredBy(
  answeredBy: string | null | undefined,
): "human" | "machine" | "unknown";

export function isConfirmedHumanParentContact(
  callStatus: string | null | undefined,
  answeredBy: string | null | undefined,
): boolean;
