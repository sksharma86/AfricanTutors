"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  COMPENSATION_CURRENCIES,
  formatCompensationHourly,
  normalizeCompensationCurrency,
} from "@/lib/compensation-currency.mjs";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Admin-only control to set a Guide's hourly compensation amount and currency.
 * Calls SECURITY DEFINER `admin_set_tutor_rate`. Rate/currency changes only
 * affect FUTURE earnings — snapshotted rows never change.
 */
export function TutorRateForm({
  tutorId,
  initialRateCents,
  initialCurrency = "USD",
}: {
  tutorId: string;
  initialRateCents: number | null;
  initialCurrency?: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialRateCents != null ? (initialRateCents / 100).toString() : "");
  const [currency, setCurrency] = useState(normalizeCompensationCurrency(initialCurrency) ?? "USD");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setMsg(null);
    setErr(null);
    const major = Number(value);
    if (value.trim() === "" || !Number.isFinite(major) || major < 0) {
      setErr("Enter a valid non-negative hourly rate.");
      return;
    }
    const cents = Math.round(major * 100);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setErr("Not available.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_tutor_rate", {
      p_tutor: tutorId,
      p_rate_cents: cents,
      p_currency: currency,
    });
    setBusy(false);
    if (error) {
      setErr("Could not update the rate. Please try again.");
      return;
    }
    setMsg(`Saved — ${formatCompensationHourly(cents, currency)}.`);
    router.refresh();
  }

  return (
    <div className="max-w-sm rounded-2xl border border-ink-100 bg-white p-5">
      <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Hourly rate</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0.00"
          aria-label="Hourly compensation amount"
          className="w-28 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-ink-400"
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          aria-label="Compensation currency"
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-ink-400"
        >
          {(COMPENSATION_CURRENCIES.includes(currency) ? COMPENSATION_CURRENCIES : [...COMPENSATION_CURRENCIES, currency]).map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
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
        Compensation is paid externally, not through Stripe. Amount and currency apply to sessions completed after the
        change; already-earned or paid amounts never change.
      </p>
    </div>
  );
}
