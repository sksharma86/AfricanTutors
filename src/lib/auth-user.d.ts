export const AUTH_GET_USER_TIMEOUT_MS: number;
export const AUTH_GET_USER_RETRIES: number;

export class AuthLookupTimeoutError extends Error {
  constructor(label: string, timeoutMs: number);
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T>;

export function getUserBounded<T>(
  lookup: () => Promise<T>,
  opts?: { timeoutMs?: number; retries?: number; label?: string },
): Promise<T>;
