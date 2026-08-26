import "server-only";

/**
 * Low-level Resend transport. Server-only; the API key never reaches the browser.
 * In STUB mode (no RESEND_API_KEY) it logs and reports `skipped` so tests and
 * unconfigured environments never send real email. Returns a structured result;
 * it never throws.
 */
export const RESEND_API_KEY = process.env.RESEND_API_KEY;
export const EMAIL_FROM = process.env.EMAIL_FROM ?? "Study Hall at Home <notifications@studyhallathome.example>";

/** True when a real provider is configured. */
export const isEmailConfigured = Boolean(RESEND_API_KEY);

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
}): Promise<SendResult> {
  const type = msg.type || "untyped";
  if (!msg.to) return { status: "skipped", error: "no recipient" };
  // TEMPORARY runtime diagnostic — remove after Production env diagnosis.
  console.info(
    `[email-config] configured=${Boolean(process.env.RESEND_API_KEY)} length=${(process.env.RESEND_API_KEY ?? "").length}`,
  );
  if (!isEmailConfigured) {
    console.info(`[email:stub] type=${type} subject=${JSON.stringify(msg.subject)}`);
    return { status: "skipped", error: "provider not configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
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
