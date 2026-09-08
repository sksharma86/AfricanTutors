import Link from "next/link";

import { ParentSurface } from "@/components/dashboard/parent-surface";
import { formatMoneyCents } from "@/lib/format.mjs";
import {
  PARENT_HOURS_HREF,
  parentHomeFundingCopy,
  parentMembershipPresentation,
  type ParentMembership,
} from "@/lib/parent-week.mjs";

export function ParentHouseholdStatus({
  membership,
  minutes,
  creditCents,
  freeTrialAvailable,
  timeZone,
}: {
  membership: ParentMembership;
  minutes: number;
  creditCents: number;
  freeTrialAvailable: boolean;
  timeZone: string;
}) {
  const entitled365 = Boolean(membership?.entitled);
  const member = parentMembershipPresentation(membership, timeZone);
  const funding = parentHomeFundingCopy({
    entitled365,
    minutes,
    creditCents,
    freeTrialAvailable,
  });

  return (
    <ParentSurface className="px-4 py-3.5">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">Household</p>
      {member ? (
        <div className="mt-2">
          <p className="text-sm font-semibold text-[var(--pp-ink)]">{member.title}</p>
          <p className="mt-0.5 text-sm text-[var(--pp-ink)]">{member.status}</p>
          <p className="mt-0.5 text-[13px] leading-5 text-[var(--pp-muted)]">{member.detail}</p>
        </div>
      ) : null}
      {funding.line ? (
        <p className="mt-2 text-[13px] leading-5 text-[var(--pp-muted)]">
          {funding.line}
        </p>
      ) : null}
      {freeTrialAvailable && funding.kind === "free_trial" ? (
        <p className="mt-2">
          <Link href="/dashboard/student/book" className="text-[13px] font-medium text-[var(--pp-ink)] underline-offset-4 hover:underline">
            Book free session →
          </Link>
        </p>
      ) : null}
      {!entitled365 && funding.kind === "prepaid" ? (
        <p className="mt-2">
          <Link href={PARENT_HOURS_HREF} className="text-[13px] font-medium text-[var(--pp-ink)] underline-offset-4 hover:underline">
            Hours →
          </Link>
        </p>
      ) : null}
      {Number(funding.creditCents) > 0 ? (
        <p className="mt-2 text-[13px] text-[var(--pp-muted)]">
          Account credit {formatMoneyCents(funding.creditCents)} · applied when you book
        </p>
      ) : null}
    </ParentSurface>
  );
}
