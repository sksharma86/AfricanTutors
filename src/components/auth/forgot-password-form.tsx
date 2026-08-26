"use client";

import { useState, type FormEvent } from "react";

import { AuthNotConfiguredNotice } from "@/components/auth/auth-not-configured-notice";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function ForgotPasswordForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    setStatus("submitting");
    setErrorMessage(null);

    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });

    if (error) {
      setStatus("error");
      setErrorMessage("We couldn’t send a reset email right now. Please try again in a minute.");
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
        If an account exists for that email, we&apos;ve sent a link to reset your password. Check
        your inbox.
      </div>
    );
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
          className="sh-input mt-1.5"
        />
      </div>

      {status === "error" && errorMessage ? (
        <p className="text-sm text-red-600">{errorMessage}</p>
      ) : null}

      <Button
        type="submit"
        disabled={!isSupabaseConfigured || status === "submitting"}
        className="w-full"
      >
        {status === "submitting" ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}
