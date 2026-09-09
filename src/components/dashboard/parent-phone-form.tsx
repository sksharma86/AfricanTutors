"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  PARENT_SMS_CONSENT_HELP,
  PARENT_SMS_CONSENT_LABEL,
  PARENT_SMS_OFF_HELP,
  PARENT_SMS_PHONE_PURPOSE,
  PARENT_SMS_TWILIO_RESTART_NOTE,
} from "@/lib/notifications/parent-sms-consent.mjs";

/**
 * Parent phone for Call Parent voice + optional transactional SMS.
 * Guides never see this value; it is used only server-side by the platform.
 * Saving a phone does not opt the parent into SMS.
 */
export function ParentPhoneForm({
  initialPhone,
  initialSmsOptIn = false,
  smsPreferenceAvailable = true,
}: {
  initialPhone: string | null;
  initialSmsOptIn?: boolean;
  smsPreferenceAvailable?: boolean;
}) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const smsSubmittingRef = useRef(false);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [smsBusy, setSmsBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [smsNote, setSmsNote] = useState<string | null>(null);
  const [saved, setSaved] = useState(initialPhone);
  const [smsOptIn, setSmsOptIn] = useState(initialSmsOptIn === true);

  async function save() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/account/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNote(data?.error ?? "Unable to save phone.");
        return;
      }
      setSaved(data.phone ?? null);
      setNote("Saved.");
      router.refresh();
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }

  async function saveSmsPreference(next: boolean) {
    if (!smsPreferenceAvailable || smsSubmittingRef.current) return;
    smsSubmittingRef.current = true;
    const previous = smsOptIn;
    setSmsOptIn(next);
    setSmsBusy(true);
    setSmsNote(null);
    try {
      const res = await fetch("/api/account/sms-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optIn: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSmsOptIn(previous);
        setSmsNote(data?.error ?? "Unable to save text alerts.");
        return;
      }
      setSmsOptIn(data.optIn === true);
      router.refresh();
    } finally {
      setSmsBusy(false);
      smsSubmittingRef.current = false;
    }
  }

  return (
    <div className="rounded-[18px] bg-[var(--pp-card)] px-4 py-4 shadow-[var(--pp-shadow-1)] ring-1 ring-[#1c1915]/[0.05] sm:px-5">
      <p className="text-sm font-medium text-[var(--pp-ink)]">Contact information</p>
      <p className="mt-1.5 text-sm leading-6 text-[var(--pp-muted)]">{PARENT_SMS_PHONE_PURPOSE}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--pp-muted)]">Guides never see your phone number.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="parent-phone">
          Phone number
        </label>
        <input
          id="parent-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+15551234567"
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 sm:max-w-xs"
        />
        <Button type="button" variant="primary" size="sm" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save phone"}
        </Button>
      </div>
      {saved ? <p className="mt-2 text-xs text-forest-700">On file: {saved}</p> : null}
      {note ? <p className="mt-1 text-xs text-ink-500">{note}</p> : null}

      {smsPreferenceAvailable ? (
        <div className="mt-4 border-t border-[#1c1915]/[0.06] pt-4">
          <p className="text-sm font-medium text-[var(--pp-ink)]">Text alerts</p>
          <label htmlFor="parent-sms-opt-in" className="mt-2 flex items-start gap-2.5 text-sm text-[var(--pp-ink)]">
            <input
              id="parent-sms-opt-in"
              type="checkbox"
              checked={smsOptIn}
              disabled={smsBusy}
              onChange={(e) => void saveSmsPreference(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink-300"
            />
            <span>
              <span className="font-medium">{PARENT_SMS_CONSENT_LABEL}</span>
              <span className="mt-0.5 block text-[13px] leading-5 text-[var(--pp-muted)]">{PARENT_SMS_CONSENT_HELP}</span>
            </span>
          </label>
          {!smsOptIn ? (
            <p className="mt-2 text-[13px] leading-5 text-[var(--pp-muted)]">{PARENT_SMS_OFF_HELP}</p>
          ) : (
            <p className="mt-2 text-[13px] leading-5 text-[var(--pp-muted)]">{PARENT_SMS_TWILIO_RESTART_NOTE}</p>
          )}
          {smsNote ? <p className="mt-1 text-xs text-ink-500">{smsNote}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
