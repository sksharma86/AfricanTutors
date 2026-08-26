"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

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
      setNote("Saved. We’ll only use this for Call Parent if your child needs you during Study Hall.");
      router.refresh();
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4 sm:p-5">
      <p className="text-sm font-medium text-ink-900">Phone number for Call Parent</p>
      <p className="mt-1.5 text-sm leading-6 text-ink-500">
        Study Hall (at home) needs your phone so we can reach you if a Guide uses Call Parent during a session —
        for example if your child needs you. Your number is never shared with Guides, and we do not sell or release
        it to third parties. You do not need to keep this portal open.
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
          className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm text-ink-900 sm:max-w-xs"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="min-h-10 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save phone"}
        </button>
      </div>
      {saved ? (
        <p className="mt-2 text-xs text-forest-700">On file: {saved}</p>
      ) : (
        <p className="mt-2 text-xs text-ink-500">
          Add a number so we can reach you if your child needs you during Study Hall.
        </p>
      )}
      {note ? <p className="mt-1 text-xs text-ink-500">{note}</p> : null}
    </div>
  );
}
