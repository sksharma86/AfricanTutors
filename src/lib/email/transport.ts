import "server-only";

import {
  EMAIL_FROM_PLACEHOLDER,
  isPlaceholderEmailFrom,
  resolveEmailFrom,
  resolveEmailReplyTo,
} from "@/lib/email/from.mjs";

/**
 * Low-level Resend transport. Server-only; the API key never reaches the browser.
 * In STUB mode (no RESEND_API_KEY) it logs and reports `skipped` so tests and
 * unconfigured environments never send real email. Returns a structured result;
 * it never throws.
 *
 * A `.example` / example.com From is never sent — including in production.
 * Set EMAIL_FROM to a Resend-verified identity such as
 * `Study Hall at Home <notifications@studyhallathome.com>` only after DNS/Resend
 * verification. Optional EMAIL_REPLY_TO is included only when it is a real
 * address; this app does not invent a support inbox.
 */
export const RESEND_API_KEY = process.env.RESEND_API_KEY;

/** @deprecated Use resolveEmailFrom(). Placeholder must never be sent. */
export const EMAIL_FROM = EMAIL_FROM_PLACEHOLDER;

/** True when a real provider is configured. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface SendResult {
  status: "sent" | "skipped" | "failed";
  id?: string | null;
  error?: string | null;
}

export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Optional notification_type for ops logs (never the recipient address). */
  type?: string;
  /**
   * PR7E: Resend Idempotency-Key (delivery row id). Same key + same body
   * returns the original message for ~24h instead of a second send.
   */
  idempotencyKey?: string | null;
}): Promise<SendResult> {
  const type = msg.type || "untyped";
  if (!msg.to) return { status: "skipped", error: "no recipient" };
  if (!isEmailConfigured()) {
    console.info(`[email:stub] type=${type} subject=${JSON.stringify(msg.subject)}`);
    return { status: "skipped", error: "provider not configured" };
  }
  const from = resolveEmailFrom();
  if (!from || isPlaceholderEmailFrom(from)) {
    console.error(`[email] refused type=${type} reason=email_from_unconfigured`);
    return { status: "skipped", error: "email_from_unconfigured" };
  }
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    };
    const idempotencyKey = typeof msg.idempotencyKey === "string" ? msg.idempotencyKey.trim() : "";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey.slice(0, 256);
    const payload: Record<string, unknown> = {
      from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    };
    const replyTo = resolveEmailReplyTo();
    if (replyTo) payload.reply_to = replyTo;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const err = `resend ${res.status} ${detail.slice(0, 200)}`;
      console.error(`[email] failed type=${type} status=${res.status}`);
      return { status: "failed", error: err };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    const id = data.id ?? null;
    console.info(`[email] sent type=${type}${id ? ` id=${id}` : ""}`);
    return { status: "sent", id };
  } catch (e) {
    const err = e instanceof Error ? e.message : "send error";
    console.error(`[email] failed type=${type} error=${err}`);
    return { status: "failed", error: err };
  }
}
