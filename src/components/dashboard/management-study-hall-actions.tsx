"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Action = "complete" | "no_show" | "release" | "reassign";

interface ReassignCandidate {
  profile_id: string;
  display_name: string | null;
}

/**
 * Existing admin booking operations (complete / no-show / reassign / release).
 * Presentation only — same /api/admin/booking contract.
 */
export function ManagementStudyHallActions({
  bookingId,
  canAct,
  needsGuide,
}: {
  bookingId: string;
  canAct: boolean;
  needsGuide: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);

  async function run(action: Action) {
    setError(null);
    const payload: Record<string, unknown> = { bookingId, action };

    if (action === "release") {
      const comp = window.prompt("Courtesy account credit in dollars (0 for none):", "0");
      if (comp === null) return;
      payload.compCreditCents = Math.max(0, Math.round(parseFloat(comp) * 100) || 0);
      payload.reason = "admin/Guide cancellation";
    }

    if (action === "reassign") {
      const candRes = await fetch(`/api/admin/reassignment-candidates?bookingId=${encodeURIComponent(bookingId)}`);
      const candData = await candRes.json().catch(() => null);
      if (!candRes.ok) {
        setError(candData?.error ?? "Unable to load eligible Guides.");
        return;
      }
      const candidates = (candData?.candidates ?? []) as ReassignCandidate[];
      if (candidates.length === 0) {
        setError("No eligible Guides are continuously available for this entire Study Hall.");
        return;
      }
      const list = candidates.map((t, i) => `${i + 1}) ${t.display_name ?? t.profile_id.slice(0, 8)}`).join("\n");
      const pick = window.prompt(`Assign which eligible Guide?\n(Only Guides continuously available for the full session)\n${list}`);
      if (pick === null) return;
      const idx = parseInt(pick, 10) - 1;
      if (!(idx >= 0 && idx < candidates.length)) {
        setError("Invalid choice.");
        return;
      }
      payload.newTutorId = candidates[idx].profile_id;
      payload.reason = "Guide reassignment";
    }

    setBusy(action);
    const res = await fetch("/api/admin/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) {
      setError(data?.error ?? "Operation failed.");
      return;
    }
    router.refresh();
  }

  if (!canAct) return null;

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run("reassign")}
          disabled={busy != null}
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-50"
        >
          {busy === "reassign" ? "Working…" : needsGuide ? "Assign Guide" : "Reassign Guide"}
        </button>
        <button
          type="button"
          onClick={() => run("complete")}
          disabled={busy != null}
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-50"
        >
          Mark complete
        </button>
        <button
          type="button"
          onClick={() => run("no_show")}
          disabled={busy != null}
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-50"
        >
          Mark no-show
        </button>
        <button
          type="button"
          onClick={() => run("release")}
          disabled={busy != null}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Cancel Study Hall
        </button>
      </div>
    </div>
  );
}
