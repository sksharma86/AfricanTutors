"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Admin-only control to set a tutor's hourly compensation rate. Calls the
 * existing SECURITY DEFINER RPC `admin_set_tutor_rate`, which enforces
 * `is_admin(auth.uid())` and non-negative validation server-side and writes a
 * financial_audit_log entry. Rate changes only affect FUTURE earnings — existing
 * tutor_earnings rows snapshot their rate/amount at creation and never change.
 */
export function TutorRateForm({
  tutorId,
  initialRateCents,
}: {
  tutorId: string;
  initialRateCents: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialRateCents != null ? (initialRateCents / 100).toString() : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setMsg(null);
    setErr(null);
    const dollars = Number(value);
    if (value.trim() === "" || !Number.isFinite(dollars) || dollars < 0) {
      setErr("Enter a valid non-negative hourly rate.");
      return;
    }
    const cents = Math.round(dollars * 100);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setErr("Not available.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_tutor_rate", { p_tutor: tutorId, p_rate_cents: cents });
    setBusy(false);
    if (error) {
      setErr("Could not update the rate. Please try again.");
      return;
    }
    setMsg(`Saved — new rate $${(cents / 100).toFixed(2)}/hour.`);
    router.refresh();
  }

  return (
    <div className="max-w-sm rounded-2xl border border-ink-100 bg-white p-5">
      <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Hourly rate</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-ink-500">$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0.00"
          aria-label="Hourly compensation rate in US dollars"
          className="w-28 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-ink-400"
        />
        <span className="text-sm text-ink-500">/ hour</span>
      </div>
      <div className="mt-3">
        <Button onClick={save} disabled={busy} size="sm">
          {busy ? "Saving…" : "Save rate"}
        </Button>
      </div>
      {msg ? <p className="mt-2 text-xs text-forest-700">{msg}</p> : null}
      {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
      <p className="mt-3 text-xs leading-5 text-ink-400">
        Compensation is paid externally, not through Stripe. This rate applies to sessions completed after the change;
        already-earned or paid amounts never change when the rate changes.
      </p>
    </div>
  );
}
