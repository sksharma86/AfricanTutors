import { LinkButton } from "@/components/ui/button";
import { parentRecordingViewerPath } from "@/lib/recording-viewer.mjs";

/**
 * Same-tab Watch recording. Authorization and the short-lived Daily link
 * happen on the authenticated viewer route — never via a browser popup.
 */
export function WatchRecordingButton({ recordingId }: { recordingId: string }) {
  return (
    <div className="mt-1">
      <LinkButton href={parentRecordingViewerPath(recordingId)} variant="outline" size="sm">
        Watch recording
      </LinkButton>
    </div>
  );
}
