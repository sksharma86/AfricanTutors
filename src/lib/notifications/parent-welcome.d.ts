declare module "@/lib/notifications/parent-welcome.mjs" {
  export function parentWelcomeEligible(input?: {
    requestedRole?: string | null;
    user?: { id?: string | null; identities?: unknown[] | null } | null;
    error?: { message?: string } | null;
  }): boolean;
  export function welcomeIdempotencyKey(accountId: string): string;
  export function friendlySignupError(message: string | null | undefined): string;
}
