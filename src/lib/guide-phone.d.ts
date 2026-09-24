declare module "@/lib/guide-phone.mjs" {
  export const GUIDE_PHONE_E164: RegExp;
  export const GUIDE_CALLING_CODES: readonly {
    id: string;
    label: string;
    callingCode: string;
  }[];
  export function isGuidePhoneE164(value: unknown): boolean;
  export function normalizeGuidePhone(
    raw: string | null | undefined,
    callingCode?: string | null,
  ): string | null;
}
