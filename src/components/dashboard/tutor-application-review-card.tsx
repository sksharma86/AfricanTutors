"use client";

import { useState } from "react";

import { setTutorApplicationStatus } from "@/app/dashboard/admin/actions";
import { Button } from "@/components/ui/button";
import type { TutorStatus } from "@/lib/supabase/database.types";

export interface TutorApplicationSummary {
  id: string;
  displayName: string;
  status: TutorStatus;
  headline: string | null;
  bio: string | null;
  education: string | null;
  yearsExperience: number | null;
  applicationNotes: string | null;
  submittedAt: string | null;
  subjectNames: string[];
}

const STATUS_LABEL: Record<TutorStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

const STATUS_TONE: Record<TutorStatus, string> = {
  pending: "bg-gold-50 text-gold-700 border-gold-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-ink-100 text-ink-600 border-ink-200",
  suspended: "bg-red-50 text-red-700 border-red-200",
};

export function TutorApplicationReviewCard({ application }: { application: TutorApplicationSummary }) {
  const [status, setStatus] = useState(application.status);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<TutorStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAction(newStatus: TutorStatus) {
    setPending(newStatus);
    setErrorMessage(null);

    const result = await setTutorApplicationStatus(application.id, newStatus, note);

    if (!result.ok) {
      setErrorMessage(result.error);
      setPending(null);
      return;
    }

    setStatus(newStatus);
    setPending(null);
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-ink-900">{application.displayName}</p>
          {application.headline ? (
            <p className="text-sm text-ink-500">{application.headline}</p>
          ) : (
            <p className="text-sm text-ink-400 italic">No headline provided</p>
          )}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_TONE[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-ink-700">Education</dt>
          <dd className="mt-0.5 text-ink-500">{application.education || "Not provided"}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink-700">Years of experience</dt>
          <dd className="mt-0.5 text-ink-500">{application.yearsExperience ?? "Not provided"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-ink-700">Bio</dt>
          <dd className="mt-0.5 text-ink-500">{application.bio || "Not provided"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-ink-700">Subjects</dt>
          <dd className="mt-0.5 text-ink-500">
            {application.subjectNames.length > 0 ? application.subjectNames.join(", ") : "None selected"}
          </dd>
        </div>
        {application.applicationNotes ? (
          <div className="sm:col-span-2">
            <dt className="font-medium text-ink-700">Notes from applicant</dt>
            <dd className="mt-0.5 text-ink-500">{application.applicationNotes}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-5 border-t border-ink-100 pt-5">
        <label htmlFor={`note-${application.id}`} className="block text-sm font-medium text-ink-800">
          Internal note (only visible to administrators)
        </label>
        <textarea
          id={`note-${application.id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Optional — e.g. reason for this decision"
          className="mt-1.5 w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-300 focus:border-ink-400"
        />

        {errorMessage ? <p className="mt-2 text-sm text-red-600">{errorMessage}</p> : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={pending !== null || status === "approved"}
            onClick={() => handleAction("approved")}
          >
            {pending === "approved" ? "Approving..." : "Approve"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending !== null || status === "rejected"}
            onClick={() => handleAction("rejected")}
          >
            {pending === "rejected" ? "Rejecting..." : "Reject"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending !== null || status === "suspended"}
            onClick={() => handleAction("suspended")}
          >
            {pending === "suspended" ? "Suspending..." : "Suspend"}
          </Button>
        </div>
      </div>
    </div>
  );
}
