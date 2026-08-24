export function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signatureHeader: string | null | undefined,
): boolean;

export const TWILIO_CALL_FAILURE_STATUSES: readonly string[];
export const TWILIO_CALL_ANSWERED_STATUS: string;
export const TWILIO_CALL_INTERMEDIATE_STATUSES: readonly string[];
export function classifyTwilioCallStatus(
  callStatus: string | null | undefined,
): "answered" | "failed" | "intermediate" | "unknown";
