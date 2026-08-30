"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { AuthNotConfiguredNotice } from "@/components/auth/auth-not-configured-notice";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form";
import { Button } from "@/components/ui/button";
import { sanitizeNextPath } from "@/lib/auth-redirect";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function friendlyLoginError(message: string): { text: string; needsConfirm?: boolean } {
  if (/email not confirmed|not confirmed|confirm your email/i.test(message)) {
    return {
      text: "Confirm your email before signing in. You can resend the confirmation link below.",
      needsConfirm: true,
    };
  }
  if (/invalid login|invalid credentials|wrong password/i.test(message)) {
    return { text: "That email or password doesn’t look right. Try again, or reset your password." };
  }
  if (/rate limit|too many/i.test(message)) {
    return { text: "Too many attempts. Please wait a minute and try again." };
  }
  return { text: "We couldn’t sign you in right now. Please try again." };
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const submittingRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [emailForResend, setEmailForResend] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    submittingRef.current = true;
    setStatus("submitting");
    setErrorMessage(null);
    setNeedsConfirm(false);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    setEmailForResend(email);

    let data: { user: unknown } | null = null;
    let error: { message: string } | null = null;
    try {
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("sign-in timed out")), 20_000);
        }),
      ]);
      data = result.data;
      error = result.error;
    } catch {
      submittingRef.current = false;
      setStatus("error");
      setErrorMessage("We couldn’t sign you in right now. Please try again.");
      return;
    }

    if (error) {
      submittingRef.current = false;
      setStatus("error");
      const mapped = friendlyLoginError(error.message);
      setErrorMessage(mapped.text);
      setNeedsConfirm(Boolean(mapped.needsConfirm));
      return;
    }

    // Prefer dashboard index so role/applicant routing stays authoritative.
    // Full navigation (not a client router refresh) so the session cookie is
    // sent on the first portal request and this form cannot stay on
    // "Logging in..." if the destination is slow.
    const requested = sanitizeNextPath(searchParams.get("redirectTo"), "/dashboard");
    const dest = requested.startsWith("/dashboard") ? "/dashboard" : requested;
    void data;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- session cookie must be sent on a new document
    window.location.assign(dest);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!isSupabaseConfigured ? <AuthNotConfiguredNotice /> : null}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink-800">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          disabled={!isSupabaseConfigured}
          autoComplete="email"
          className="mt-1.5 w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400 disabled:bg-ink-50"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink-800">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          disabled={!isSupabaseConfigured}
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400 disabled:bg-ink-50"
        />
      </div>

      {status === "error" && errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {needsConfirm ? <ResendConfirmationForm defaultEmail={emailForResend} /> : null}

      <Button type="submit" disabled={!isSupabaseConfigured || status === "submitting"} className="w-full">
        {status === "submitting" ? "Logging in..." : "Log In"}
      </Button>
    </form>
  );
}
