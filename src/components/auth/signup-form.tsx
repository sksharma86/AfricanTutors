"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { AuthNotConfiguredNotice } from "@/components/auth/auth-not-configured-notice";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAuthErrorMessage } from "@/lib/supabase/errors";
import type { RequestableRole } from "@/lib/roles";

/**
 * `role` is fixed by the page that renders this form ("student" for the
 * primary /signup path, "tutor" for the secondary /apply-to-tutor path) —
 * there is no toggle presented to the visitor. This is a presentation
 * choice only: the underlying signup mechanics (Supabase Auth signUp with
 * `requested_role` in user metadata, and the database trigger that creates
 * a `pending` tutor application) are unchanged from Prompt 2. See
 * DECISIONS.md.
 */
export function SignupForm({
  role,
  submitLabel = "Create Account",
}: {
  role: RequestableRole;
  submitLabel?: string;
}) {
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
    const displayName = String(formData.get("displayName") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    // `requested_role` is only a signal for onboarding. Actual tutor access
    // is granted by an administrator, never by this signup form. See
    // ARCHITECTURE.md > Role Based Access Strategy.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, requested_role: role },
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(getAuthErrorMessage(error));
      return;
    }

    if (data.session) {
      // Let the server-side proxy (src/proxy.ts) route to the right
      // dashboard based on the role actually stored in the database.
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-gold-200 bg-gold-50 p-4 text-sm text-gold-800">
        Check your email to confirm your account before logging in.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!isSupabaseConfigured ? <AuthNotConfiguredNotice /> : null}

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-ink-800">
          {role === "tutor" ? "Full name" : "Parent or student name"}
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          disabled={!isSupabaseConfigured}
          autoComplete="name"
          placeholder="This is what appears on your account"
          className="mt-1.5 w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-300 focus:border-ink-400 disabled:bg-ink-50"
        />
      </div>

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
        {status === "submitting" ? "Submitting..." : submitLabel}
      </Button>
    </form>
  );
}
