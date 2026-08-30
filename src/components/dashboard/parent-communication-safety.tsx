import Link from "next/link";

import { ParentIconShield } from "@/components/dashboard/parent-icons";
import { ParentSurface } from "@/components/dashboard/parent-surface";

/**
 * Permanent Parent Account notice. Complements existing on-platform
 * communication rules. Does not add reporting state or a new workflow.
 */
export function ParentCommunicationSafety() {
  return (
    <ParentSurface className="px-4 py-4">
      <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-[var(--pp-muted)] uppercase">
        <ParentIconShield className="h-3.5 w-3.5 text-[#c9a227]" />
        Safety &amp; communication
      </p>
      <h2 className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-[var(--pp-ink)]">
        Keeping communication on Study Hall
      </h2>
      <div className="mt-2 space-y-2.5 text-[13px] leading-6 text-[var(--pp-muted)]">
        <p>
          For everyone’s privacy and safety, all communication with your Guide should stay within
          Study Hall. Guides are not permitted to request personal contact information, contact your
          family outside the platform, or ask you to communicate with them privately.
        </p>
        <p>
          If a Guide ever asks to connect with you outside Study Hall, please let us know right away.
          Our Guides are carefully vetted, trained, and monitored, but we also rely on families to
          help us maintain these boundaries.
        </p>
        <p>Thank you for helping us keep Study Hall safe and professional for everyone.</p>
      </div>
      <p className="mt-3">
        <Link
          href="/contact"
          className="text-[13px] font-medium text-[var(--pp-ink)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a227]"
        >
          Report a concern →
        </Link>
      </p>
    </ParentSurface>
  );
}
