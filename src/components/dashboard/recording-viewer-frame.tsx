import type { ReactNode } from "react";

import { RecordingPlayer } from "@/components/dashboard/recording-player";
import { PortalTextLink } from "@/components/ui/portal-text-link";
import { recordingViewerErrorCopy } from "@/lib/recording-viewer.mjs";

export function RecordingViewerFrame({
  backHref,
  backLabel,
  secondaryHref,
  secondaryLabel,
  url,
  expiresAt,
  errorStatus,
  heading = "Study Hall recording",
  note,
}: {
  backHref: string;
  backLabel: string;
  secondaryHref?: string | null;
  secondaryLabel?: string | null;
  url?: string | null;
  expiresAt?: string | null;
  errorStatus?: number | null;
  heading?: string;
  note?: ReactNode;
}) {
  const error = errorStatus ? recordingViewerErrorCopy(errorStatus) : null;

  return (
    <div>
      <p className="mb-3">
        <PortalTextLink href={backHref}>{backLabel}</PortalTextLink>
      </p>
      {secondaryHref && secondaryLabel ? (
        <p className="mb-5">
          <PortalTextLink href={secondaryHref}>{secondaryLabel}</PortalTextLink>
        </p>
      ) : null}

      <h1 className="font-display text-3xl font-semibold tracking-[-0.035em] text-[var(--pp-ink,var(--mg-ink,#1c1915))]">
        {error ? error.title : heading}
      </h1>

      {error ? (
        <p className="mt-3 max-w-xl text-sm text-[var(--pp-muted,var(--mg-muted,#6b655c))]">{error.body}</p>
      ) : (
        <>
          {note ? <div className="mt-2 text-sm text-[var(--pp-muted,#6b655c)]">{note}</div> : null}
          {url ? (
            <div className="mt-6">
              <RecordingPlayer src={url} expiresAt={expiresAt} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
