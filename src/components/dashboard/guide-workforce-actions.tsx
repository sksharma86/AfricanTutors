"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { bookingChildNames } from "@/lib/household-children.mjs";

type Action = "reject" | "suspend" | "reactivate";

type FutureRow = {
  id: string;
  public_reference: string | null;
  student_first_name: string | null;
  student_first_names?: string[] | null;
  scheduled_start: string | null;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "unscheduled";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Admin-only Guide workforce confirmations. Calls /api/admin/guide-workforce.
 * Copy is operational, not alarming.
 */
export function GuideWorkforceActions({
  profileId,
  label,
  futureCount = 0,
  futureAssignments = [],
  compact = false,
}: {
  profileId: string;
  label: "pending" | "active" | "suspended" | "rejected" | "unknown";
  futureCount?: number;
  futureAssignments?: FutureRow[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function run(action: Action) {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/guide-workforce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, profileId }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        reassigned?: { bookingId: string }[];
        needsAttention?: { bookingId: string; reason: string }[];
      } | null;
      if (!res.ok) {
        setErr(data?.error ?? "That action could not be completed.");
        return;
      }
      if (action === "suspend") {
        const moved = data?.reassigned?.length ?? 0;
        const stuck = data?.needsAttention?.length ?? 0;
        if (stuck > 0) {
          setResult(
            `Guide suspended. ${moved} upcoming Study Hall${moved === 1 ? "" : "s"} reassigned. ${stuck} still need manager attention — use Study Halls to assign a Guide.`,
          );
        } else if (moved > 0) {
          setResult(`Guide suspended. ${moved} upcoming Study Hall${moved === 1 ? "" : "s"} reassigned automatically.`);
        } else {
          setResult("Guide suspended. No upcoming assigned Study Halls.");
        }
      } else if (action === "reject") {
        setResult("Application rejected. This applicant was not approved as a Guide.");
      } else {
        setResult("Guide reactivated and eligible for future assignments.");
      }
      setOpen(null);
      router.refresh();
    } catch {
      setErr("That action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const showReject = label === "pending";
  const showSuspend = label === "active";
  const showReactivate = label === "suspended" || label === "rejected";

  if (!showReject && !showSuspend && !showReactivate) return null;

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "space-y-3"}>
      {showReject ? (
        <Button type="button" variant="destructive" size="sm" onClick={() => setOpen("reject")}>
          Reject Application
        </Button>
      ) : null}
      {showSuspend ? (
        <Button type="button" variant="destructive" size="sm" onClick={() => setOpen("suspend")}>
          Suspend Guide
        </Button>
      ) : null}
      {showReactivate ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen("reactivate")}>
          Reactivate Guide
        </Button>
      ) : null}

      {result ? <p className="w-full text-sm text-ink-600">{result}</p> : null}
      {err && !open ? <p className="w-full text-sm text-ink-600">{err}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-6 shadow-lg">
            {open === "reject" ? (
              <>
                <h3 className="font-display text-lg font-semibold text-ink-900">Reject Application?</h3>
                <p className="mt-2 text-sm leading-6 text-ink-600">
                  This applicant will not be approved as a Guide.
                </p>
              </>
            ) : null}
            {open === "suspend" ? (
              <>
                <h3 className="font-display text-lg font-semibold text-ink-900">Suspend Guide?</h3>
                <p className="mt-2 text-sm leading-6 text-ink-600">
                  This Guide will no longer be available for new Study Hall assignments. Their historical sessions,
                  reports, and earnings will be preserved.
                </p>
                {futureCount > 0 ? (
                  <div className="mt-3 rounded-xl border border-ink-100 bg-[#f4f5f7] p-3 text-sm text-ink-700">
                    <p>
                      {futureCount} upcoming assigned Study Hall{futureCount === 1 ? "" : "s"} will be automatically
                      reassigned when a replacement Guide is available. Any session that cannot be reassigned will stay
                      booked and need manager attention.
                    </p>
                    {futureAssignments.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-ink-500">
                        {futureAssignments.slice(0, 6).map((b) => (
                          <li key={b.id}>
                            {bookingChildNames(b, "Child")}
                            {b.public_reference ? ` · ${b.public_reference}` : ""} · {formatWhen(b.scheduled_start)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-ink-500">No upcoming assigned Study Halls.</p>
                )}
              </>
            ) : null}
            {open === "reactivate" ? (
              <>
                <h3 className="font-display text-lg font-semibold text-ink-900">Reactivate Guide?</h3>
                <p className="mt-2 text-sm leading-6 text-ink-600">
                  This Guide will return to the active workforce and may be assigned to future Study Halls. Historical
                  records stay unchanged.
                </p>
              </>
            ) : null}
            {err ? <p className="mt-3 text-sm text-ink-600">{err}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={open === "reactivate" ? "primary" : "destructive"}
                size="sm"
                disabled={busy}
                onClick={() => void run(open)}
              >
                {busy ? "Working…" : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
