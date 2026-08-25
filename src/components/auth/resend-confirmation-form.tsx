"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { authCallbackUrl } from "@/lib/auth-redirect";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Resend signup confirmation email with the correct callback URL.
 * Always shows a generic success message to avoid account enumeration.
 */
export function ResendConfirmationForm({ defaultEmail = "" }: { defaultEmail?: string } = {}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    setStatus("submitting");
    setErrorMessage(null);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) {
      setStatus("error");
      setErrorMessage("Enter the email you used to sign up.");
      return;
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: authCallbackUrl(window.location.origin, "/dashboard"),
      },
    });

    if (error) {
      setStatus("error");
      // Avoid leaking whether the account exists / is already confirmed.
      setErrorMessage("We couldn’t send a confirmation email right now. Try again in a minute, or sign in.");
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
        If that email still needs confirmation, we&apos;ve sent a new link. Check your inbox (and spam folder).
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="resend-email" className="block text-sm font-medium text-ink-800">
          Email
        </label>
        <input
          id="resend-email"
          name="email"
          type="email"
          required
          defaultValue={defaultEmail}
          disabled={!isSupabaseConfigured || status === "submitting"}
          autoComplete="email"
          className="mt-1.5 w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400 disabled:bg-ink-50"
        />
      </div>
      {status === "error" && errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      <Button type="submit" variant="outline" className="w-full" disabled={!isSupabaseConfigured || status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Resend confirmation email"}
      </Button>
    </form>
  );
}
