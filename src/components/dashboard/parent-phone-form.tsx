"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Parent phone for Call Parent telephony (E.164). Guides never see this value
 * in their UI; it is used only server-side by the platform.
 */
export function ParentPhoneForm({ initialPhone }: { initialPhone: string | null }) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState(initialPhone);

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

  return (
    <div className="rounded-[18px] bg-[var(--pp-card)] px-4 py-4 shadow-[var(--pp-shadow-1)] ring-1 ring-[#1c1915]/[0.05] sm:px-5">
      <p className="text-sm font-medium text-[var(--pp-ink)]">Contact information</p>
      <p className="mt-1.5 text-sm leading-6 text-[var(--pp-muted)]">
        We’ll only use your number for important Study Hall communication. Guides never see your phone number.
      </p>
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
    </div>
  );
}
