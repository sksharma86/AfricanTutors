"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { AuthNotConfiguredNotice } from "@/components/auth/auth-not-configured-notice";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form";
import { Button } from "@/components/ui/button";
import { ANALYTICS_EVENTS, track } from "@/lib/analytics";
import { authCallbackUrl } from "@/lib/auth-redirect";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { RequestableRole } from "@/lib/roles";

function friendlySignupError(message: string): string {
  if (/already registered|already been registered|User already registered/i.test(message)) {
    return "An account with that email already exists. Sign in, or reset your password.";
  }
  if (/password/i.test(message) && /weak|least|characters/i.test(message)) {
    return "Choose a stronger password (at least 8 characters).";
  }
  if (/rate limit|too many/i.test(message)) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  return "We couldn’t create your account right now. Please try again.";
}

export function SignupForm({
  defaultRole = "student",
  submitLabel = "Create Account",
}: {
  defaultRole?: RequestableRole;
  submitLabel?: string;
} = {}) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const role = defaultRole;
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signedUpEmail, setSignedUpEmail] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    submittingRef.current = true;
    setStatus("submitting");
    setErrorMessage(null);
    track(ANALYTICS_EVENTS.signupStarted, { role });

    const formData = new FormData(event.currentTarget);
    const displayName = String(formData.get("displayName") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    // `requested_role` is only a signal for onboarding. Actual tutor access
    // is granted by an administrator, never by this signup form.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, requested_role: role },
        emailRedirectTo: authCallbackUrl(window.location.origin, "/dashboard"),
      },
    });

    if (error) {
      submittingRef.current = false;
      setStatus("error");
      setErrorMessage(friendlySignupError(error.message));
      return;
    }

    track(ANALYTICS_EVENTS.signupCompleted, { role });

    if (data.session) {
      // Applicants keep profiles.role=student until approval.
      router.push(role === "tutor" ? "/dashboard/applicant" : "/dashboard/student");
      router.refresh();
      return;
    }

    setSignedUpEmail(email);
    setStatus("success");
    submittingRef.current = false;
  }

  if (status === "success") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
          <p className="font-medium">Check your email to confirm your account</p>
          <p className="mt-2 leading-6">
            We sent a confirmation link{signedUpEmail ? ` to ${signedUpEmail}` : ""}. After you confirm,
            you’ll continue to your{" "}
            {role === "tutor" ? "Guide application status" : "parent dashboard"} automatically when
            possible.
          </p>
          <p className="mt-2 text-xs text-brand-700">Didn’t get it? Check spam, or resend below.</p>
        </div>
        <ResendConfirmationForm defaultEmail={signedUpEmail} />
        <p className="text-center text-sm text-ink-500">
          Already confirmed?{" "}
          <Link href="/login" className="font-medium text-ink-800 underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!isSupabaseConfigured ? <AuthNotConfiguredNotice /> : null}

      {role === "tutor" ? (
        <p className="text-xs leading-5 text-ink-400">
          Guide applications are reviewed by our team before you get full Guide access.
        </p>
      ) : null}

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-ink-800">
          Full name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          disabled={!isSupabaseConfigured}
          autoComplete="name"
          className="mt-1.5 w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400 disabled:bg-ink-50"
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

      {status === "error" && errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <Button type="submit" disabled={!isSupabaseConfigured || status === "submitting"} className="w-full">
        {status === "submitting" ? "Creating account..." : submitLabel}
      </Button>

      {defaultRole === "student" ? (
        <p className="text-center text-sm text-ink-400">
          Applying as a Guide?{" "}
          <Link href="/guides/apply" className="font-medium text-ink-700 underline-offset-4 hover:underline">
            Start an application
          </Link>
        </p>
      ) : null}
    </form>
  );
}
