"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Parent account phone for Call Parent (E.164). Guides never see this value
 * through their UI; it is used only server-side. Verification deferred.
 */
export function ParentPhoneForm({ initialPhone }: { initialPhone: string | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState(initialPhone);

  async function save() {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/account/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim() || null }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setNote(data?.error ?? "Unable to save phone.");
      return;
    }
    setSaved(data.phone ?? null);
    setNote("Saved. We’ll use this number only if a Guide needs your attention during Study Hall.");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4">
      <p className="text-sm font-medium text-ink-900">Phone for Study Hall alerts</p>
      <p className="mt-1 text-xs leading-5 text-ink-500">
        If a Guide needs you during a live session, we may call or text this number. Guides never see your phone
        number. Use international format (e.g. +15551234567). Verification will be added before broad public launch.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+15551234567"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-900 sm:max-w-xs"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save phone"}
        </button>
      </div>
      {saved ? (
        <p className="mt-2 text-xs text-forest-700">On file: {saved}</p>
      ) : (
        <p className="mt-2 text-xs text-amber-700">No phone on file yet — Call Parent cannot reach you until you add one.</p>
      )}
      {note ? <p className="mt-1 text-xs text-ink-500">{note}</p> : null}
    </div>
  );
}
