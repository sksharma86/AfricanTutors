"use client";

import { useState } from "react";

/**
 * Same-tab playback. Never uses window.open or target=_blank.
 * If the short-lived Daily URL cannot play inline, a same-tab link remains.
 */
export function RecordingPlayer({ src, expiresAt }: { src: string; expiresAt?: string | null }) {
  const [failed, setFailed] = useState(false);

  return (
    <div>
      {failed ? (
        <p className="rounded-xl bg-[var(--pp-card)] px-4 py-6 text-sm text-[var(--pp-muted)] ring-1 ring-[#1c1915]/[0.06]">
          This recording could not play in the page. Use the link below to open it in this tab.
        </p>
      ) : (
        <video
          className="aspect-video w-full rounded-xl bg-black"
          controls
          playsInline
          preload="metadata"
          src={src}
          onError={() => setFailed(true)}
        />
      )}
      <p className="mt-3">
        <a
          href={src}
          className="text-sm font-medium text-[var(--pp-ink)] underline-offset-4 hover:underline"
        >
          Open recording in this tab
        </a>
      </p>
      {expiresAt ? (
        <p className="mt-1.5 text-xs text-[var(--pp-muted)]">
          Secure playback link expires {new Date(expiresAt).toLocaleString()}.
        </p>
      ) : null}
    </div>
  );
}
