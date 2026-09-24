"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { AuthNotConfiguredNotice } from "@/components/auth/auth-not-configured-notice";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form";
import { GuideHandbookDownload } from "@/components/auth/guide-handbook-download";
import { Button } from "@/components/ui/button";
import { ANALYTICS_EVENTS, track } from "@/lib/analytics";
import { GUIDE_CALLING_CODES, normalizeGuidePhone } from "@/lib/guide-phone.mjs";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const PHONE_HELP =
  "Enter a WhatsApp number with your country code, like +254712345678, or pick a country and type the local number.";

export function GuideApplicationForm() {
  const submittingRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signedUpEmail, setSignedUpEmail] = useState("");
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [countryId, setCountryId] = useState(GUIDE_CALLING_CODES[0]?.id ?? "US");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const formData = new FormData(event.currentTarget);
    const displayName = String(formData.get("displayName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const phoneRaw = String(formData.get("phone") ?? "");
    const callingCode = GUIDE_CALLING_CODES.find((c) => c.id === countryId)?.callingCode ?? "";
    const phone = normalizeGuidePhone(phoneRaw, callingCode);

    if (!displayName || !email || !password) {
      setStatus("error");
      setErrorMessage("Full name, email, and password are required.");
      return;
    }
    if (!phone) {
      setStatus("error");
      setErrorMessage(PHONE_HELP);
      return;
    }

    submittingRef.current = true;
    setStatus("submitting");
    setErrorMessage(null);
    track(ANALYTICS_EVENTS.signupStarted, { role: "tutor" });

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
        email,
        password,
        phone,
        countryCallingCode: callingCode,
        requestedRole: "tutor",
      }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      submittingRef.current = false;
      setStatus("error");
      setErrorMessage(typeof data?.error === "string" ? data.error : "We couldn’t submit your application right now. Please try again.");
      return;
    }

    track(ANALYTICS_EVENTS.signupCompleted, { role: "tutor" });
    setSignedUpEmail(email);
    setNeedsEmailConfirm(data?.status !== "authenticated");
    setStatus("success");
    submittingRef.current = false;
  }

  if (status === "success") {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
          <p className="font-medium">Application received</p>
          <p className="mt-2 leading-6">
            We have your application{signedUpEmail ? ` for ${signedUpEmail}` : ""}. A manager will reach out on
            WhatsApp. You are not approved yet, and hours stay closed until then.
          </p>
          {needsEmailConfirm ? (
            <p className="mt-2 leading-6">
              Confirm the email we just sent so you can sign back in and see this status. Check spam if it is not
              in your inbox.
            </p>
          ) : (
            <p className="mt-2 leading-6">You can sign in anytime to see that your application is still under review.</p>
          )}
        </div>
        <GuideHandbookDownload className="w-full" />
        {needsEmailConfirm ? <ResendConfirmationForm defaultEmail={signedUpEmail} /> : null}
        <p className="text-center text-sm text-ink-500">
          <Link href="/dashboard/applicant" className="font-medium text-ink-800 underline-offset-4 hover:underline">
            View application status
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!isSupabaseConfigured ? <AuthNotConfiguredNotice /> : null}

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
        <label htmlFor="guide-phone-country" className="block text-sm font-medium text-ink-800">
          WhatsApp number
        </label>
        <p className="mt-1 text-xs leading-5 text-ink-500">{PHONE_HELP}</p>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <select
            id="guide-phone-country"
            name="country"
            value={countryId}
            disabled={!isSupabaseConfigured}
            onChange={(event) => setCountryId(event.target.value)}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400 disabled:bg-ink-50 sm:max-w-[14rem]"
          >
            {GUIDE_CALLING_CODES.map((country) => (
              <option key={country.id} value={country.id}>
                {country.label} ({country.callingCode})
              </option>
            ))}
          </select>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            required
            disabled={!isSupabaseConfigured}
            autoComplete="tel"
            placeholder="+254712345678"
            className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400 disabled:bg-ink-50"
          />
        </div>
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
        {status === "submitting" ? "Submitting application..." : "Submit Application"}
      </Button>
    </form>
  );
}
