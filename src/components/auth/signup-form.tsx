"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { AuthNotConfiguredNotice } from "@/components/auth/auth-not-configured-notice";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { RequestableRole } from "@/lib/roles";

export function SignupForm({
  defaultRole = "student",
  submitLabel = "Create Account",
}: {
  defaultRole?: RequestableRole;
  submitLabel?: string;
} = {}) {
  const router = useRouter();
  const [role, setRole] = useState<RequestableRole>(defaultRole);
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
      setErrorMessage(error.message);
      return;
    }

    if (data.session) {
      router.push(role === "tutor" ? "/dashboard/tutor" : "/dashboard/student");
      router.refresh();
      return;
    }

    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
        Check your email to confirm your account before logging in.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!isSupabaseConfigured ? <AuthNotConfiguredNotice /> : null}

      <fieldset disabled={!isSupabaseConfigured}>
        <legend className="block text-sm font-medium text-ink-800">I want to</legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {(
            [
              { value: "student", label: "Learn" },
              { value: "tutor", label: "Teach" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium ${
                role === option.value
                  ? "border-ink-900 bg-ink-900 text-white"
                  : "border-ink-200 text-ink-700 hover:border-ink-300"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={role === option.value}
                onChange={() => setRole(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
        {role === "tutor" ? (
          <p className="mt-2 text-xs text-ink-400">
            Tutor applications are reviewed by our team before you get full tutor access.
          </p>
        ) : null}
      </fieldset>

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-ink-800">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          disabled={!isSupabaseConfigured}
          autoComplete="name"
          placeholder="This is what other platform users will see"
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
        {status === "submitting" ? "Creating account..." : submitLabel}
      </Button>
    </form>
  );
}
