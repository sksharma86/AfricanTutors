import type { Metadata } from "next";

import { ParentPage } from "@/components/dashboard/parent-page";
import { RecordingViewerFrame } from "@/components/dashboard/recording-viewer-frame";
import { requireRole } from "@/lib/auth";
import { mintAuthorizedRecordingAccess } from "@/lib/recording-access";
import { recordingAvailabilityLabel } from "@/lib/recording-retention.mjs";
import { getServiceSupabase } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Recording" };
export const dynamic = "force-dynamic";

export default async function ParentRecordingViewerPage({
  params,
}: {
  params: Promise<{ recordingId: string }>;
}) {
  const { recordingId } = await params;
  const user = await requireRole("student", `/dashboard/student/recordings/${recordingId}`);
  const result = await mintAuthorizedRecordingAccess({
    recordingId,
    userId: user.id,
    asAdmin: false,
  });

  let bookingId: string | null = null;
  let retentionUntil: string | null = null;
  if (result.ok) {
    const service = getServiceSupabase();
    const { data: rec } = await service
      .from("session_recordings")
      .select("booking_id, retention_until")
      .eq("id", recordingId)
      .maybeSingle();
    bookingId = rec?.booking_id ?? null;
    retentionUntil = rec?.retention_until ?? null;
  }

  return (
    <ParentPage>
      <RecordingViewerFrame
        backHref="/dashboard/student/reports"
        backLabel="← Back to Reports & Recordings"
        secondaryHref={bookingId ? `/dashboard/student/study-halls/${bookingId}` : null}
        secondaryLabel={bookingId ? "← Back to Study Hall" : null}
        url={result.ok ? result.url : null}
        expiresAt={result.ok ? result.expiresAt : null}
        errorStatus={result.ok ? null : result.status}
        note={result.ok ? <p>{recordingAvailabilityLabel(retentionUntil)}</p> : null}
      />
    </ParentPage>
  );
}
