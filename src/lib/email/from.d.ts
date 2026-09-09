declare module "@/lib/email/from.mjs" {
  export const EMAIL_SENDER_DISPLAY_NAME: "Study Hall at Home";
  export const EMAIL_FROM_PLACEHOLDER: string;
  export function isPlaceholderEmailFrom(from: unknown): boolean;
  export function resolveEmailFrom(): string | null;
  export function resolveEmailReplyTo(): string | null;
  export function isProductionEmailEnv(): boolean;
}
