/**
 * Bounded Auth-server calls. GoTrue getUser() is a network hop and can stall
 * for tens of seconds; login/portal entry must not wait unbounded.
 *
 * Never logs tokens, cookies, or emails.
 */

export const AUTH_GET_USER_TIMEOUT_MS = 8_000;
export const AUTH_GET_USER_RETRIES = 1;

export class AuthLookupTimeoutError extends Error {
  constructor(label, timeoutMs) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = "AuthLookupTimeoutError";
  }
}

export async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new AuthLookupTimeoutError(label, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * getUser() with a per-attempt timeout and one retry.
 * Returns { user: null } after exhaustion so callers can fail closed.
 */
export async function getUserBounded(lookup, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? AUTH_GET_USER_TIMEOUT_MS;
  const retries = opts.retries ?? AUTH_GET_USER_RETRIES;
  const label = opts.label ?? "auth.getUser";
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const started = Date.now();
    try {
      const result = await withTimeout(lookup(), timeoutMs, label);
      const ms = Date.now() - started;
      if (ms >= 1500) {
        console.info(`[auth-timing] ${label} ${ms}ms attempt=${attempt + 1}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      const ms = Date.now() - started;
      console.info(`[auth-timing] ${label} failed ${ms}ms attempt=${attempt + 1}`);
    }
  }

  const message = lastError instanceof Error ? lastError.message : "auth lookup failed";
  return { data: { user: null }, error: { message } };
}
