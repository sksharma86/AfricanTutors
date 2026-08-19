import "server-only";

/**
 * Low-level Resend transport. Server-only; the API key never reaches the browser.
 * In STUB mode (no RESEND_API_KEY) it logs and reports `skipped` so tests and
 * unconfigured environments never send real email. Returns a structured result;
 * it never throws.
 */
export const RESEND_API_KEY = process.env.RESEND_API_KEY;
export const EMAIL_FROM = process.env.EMAIL_FROM ?? "African Tutors <notifications@africantutors.example>";

/** True when a real provider is configured. */
export const isEmailConfigured = Boolean(RESEND_API_KEY);

export interface SendResult {
  status: "sent" | "skipped" | "failed";
  id?: string | null;
  error?: string | null;
}

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<SendResult> {
  if (!msg.to) return { status: "skipped", error: "no recipient" };
  if (!isEmailConfigured) {
    console.info(`[email:stub] to=${msg.to} subject=${JSON.stringify(msg.subject)}`);
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
      return { status: "failed", error: `resend ${res.status} ${detail.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { status: "sent", id: data.id ?? null };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "send error" };
  }
}
