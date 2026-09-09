export const PARENT_PHONE_E164: RegExp;
export const PARENT_SMS_PHONE_PURPOSE: string;
export const PARENT_SMS_CONSENT_LABEL: string;
export const PARENT_SMS_CONSENT_HELP: string;
export const PARENT_SMS_OFF_HELP: string;
export const PARENT_SMS_TWILIO_RESTART_NOTE: string;
export function isUsableParentPhone(phone: unknown): boolean;
export function parentTransactionalSmsEligible(profile: {
  phone_e164?: string | null;
  sms_transactional_opt_in?: boolean | null;
} | null | undefined): { ok: true } | { ok: false; reason: string };
export function isParentTransactionalSmsEligible(profile: unknown): boolean;
export function smsIdempotencyKey(emailKey: string): string | null;
