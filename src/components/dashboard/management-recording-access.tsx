import { LinkButton } from "@/components/ui/button";
import { adminRecordingViewerPath } from "@/lib/recording-viewer.mjs";

export function ManagementRecordingAccess({
  id,
  minutes,
}: {
  id: string;
  minutes: number | null;
}) {
  return (
    <LinkButton href={adminRecordingViewerPath(id)} variant="outline" size="sm">
      Review recording{minutes != null ? ` · ${minutes} min` : ""}
    </LinkButton>
  );
}
