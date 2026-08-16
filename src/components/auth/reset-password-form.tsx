"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { AuthNotConfiguredNotice } from "@/components/auth/auth-not-configured-notice";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAuthErrorMessage } from "@/lib/supabase/errors";

export function ResetPasswordForm() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    setStatus("submitting");
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setStatus("error");
      setErrorMessage("Those passwords don't match. Please try again.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setErrorMessage(getAuthErrorMessage(error));
      return;
    }

    setStatus("success");
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
        Your password has been updated. Taking you to your dashboard...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!isSupabaseConfigured ? <AuthNotConfiguredNotice /> : null}

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink-800">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          disabled={!isSupabaseConfigured}
          autoComplete="new-password"
          className="mt-1.5 w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400 disabled:bg-ink-50"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink-800">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          disabled={!isSupabaseConfigured}
          autoComplete="new-password"
          className="mt-1.5 w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400 disabled:bg-ink-50"
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
        {status === "submitting" ? "Updating..." : "Update Password"}
      </Button>
    </form>
  );
}
