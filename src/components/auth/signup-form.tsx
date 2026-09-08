"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { AuthNotConfiguredNotice } from "@/components/auth/auth-not-configured-notice";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form";
import { Button } from "@/components/ui/button";
import { ANALYTICS_EVENTS, track } from "@/lib/analytics";
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
  const submittingRef = useRef(false);
  const role = defaultRole;
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signedUpEmail, setSignedUpEmail] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setStatus("submitting");
    setErrorMessage(null);
    track(ANALYTICS_EVENTS.signupStarted, { role });

    const formData = new FormData(event.currentTarget);
    const displayName = String(formData.get("displayName") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, email, password, requestedRole: role }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      submittingRef.current = false;
      setStatus("error");
      setErrorMessage(typeof data?.error === "string" ? data.error : "We couldn’t create your account right now. Please try again.");
      return;
    }

    track(ANALYTICS_EVENTS.signupCompleted, { role });

    if (data?.status === "authenticated") {
      const fallback = role === "tutor" ? "/dashboard/applicant" : "/dashboard/student";
      const next = typeof data.redirect === "string" ? data.redirect : fallback;
      router.push(next);
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
