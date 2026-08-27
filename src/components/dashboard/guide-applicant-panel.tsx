import Link from "next/link";

import type { GuideApplicantInfo } from "@/lib/guide-applicant";

function formatSubmitted(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

/**
 * Dedicated pending / suspended Guide applicant experience.
 * Must not expose parent booking, prepaid hours, or approved Guide tools.
 */
export function GuideApplicantPanel({ info }: { info: GuideApplicantInfo }) {
  const submitted = formatSubmitted(info.submittedAt);
  const isSuspended = info.status === "suspended";
  const isRejected = info.status === "rejected";
  const headline = isRejected
    ? "Application not approved"
    : isSuspended
      ? "Application paused"
      : "Application received";
  const body = isRejected
    ? "This application was not approved as a Study Hall Guide. Parent booking, prepaid hours, and Guide tools are not available on this account."
    : isSuspended
      ? "Your Study Hall Guide application is not active right now. Contact us if you have questions about next steps."
      : "Your application to become a Study Hall Guide is under review. We will email you when there is an update.";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <section className="rounded-2xl border border-ink-100 bg-white p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-wide text-ink-400 uppercase">Guide application</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-ink-900">
          {headline}
        </h2>
        <p className="mt-3 text-sm leading-6 text-ink-600">
          {body}
        </p>

        <dl className="mt-6 space-y-3 border-t border-ink-100 pt-5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">Status</dt>
            <dd className="font-medium capitalize text-ink-900">
              {info.status === "rejected" ? "Not approved" : info.status}
            </dd>
          </div>
          {submitted ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Submitted</dt>
              <dd className="font-medium text-ink-900">{submitted}</dd>
            </div>
          ) : null}
          {info.displayName ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Name</dt>
              <dd className="font-medium text-ink-900">{info.displayName}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-6 sm:p-8">
        <h3 className="font-display text-lg font-semibold text-ink-900">What happens next</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink-600">
          <li>Our team reviews your application.</li>
          <li>If approved, this account becomes your Guide workspace — no new signup needed.</li>
          <li>Approval is not guaranteed; we only hire Guides who fit Study Hall supervision needs.</li>
        </ul>
        <p className="mt-4 text-sm text-ink-500">
          Questions?{" "}
          <Link href="/contact" className="font-medium text-ink-800 underline-offset-4 hover:underline">
            Contact support
          </Link>
          .
        </p>
      </section>

      <p className="text-center text-xs text-ink-400">
        Parent booking, prepaid hours, and Guide tools are not available on this Guide application account.
      </p>
    </div>
  );
}
