import type { Metadata } from "next";

import { ManagementPage } from "@/components/dashboard/management-page";
import { RecordingViewerFrame } from "@/components/dashboard/recording-viewer-frame";
import { requireRole } from "@/lib/auth";
import { mintAuthorizedRecordingAccess } from "@/lib/recording-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Recording" };
export const dynamic = "force-dynamic";

export default async function AdminRecordingViewerPage({
  params,
}: {
  params: Promise<{ recordingId: string }>;
}) {
  const { recordingId } = await params;
  const user = await requireRole("admin", `/dashboard/admin/recordings/${recordingId}`);
  const supabase = await createSupabaseServerClient();
  const result = await mintAuthorizedRecordingAccess({
    recordingId,
    userId: user.id,
    asAdmin: true,
    userClient: supabase ?? undefined,
  });

  let bookingId: string | null = null;
  if (result.ok) {
    const service = getServiceSupabase();
    const { data: rec } = await service
      .from("session_recordings")
      .select("booking_id")
      .eq("id", recordingId)
      .maybeSingle();
    bookingId = rec?.booking_id ?? null;
  }

  return (
    <ManagementPage>
      <RecordingViewerFrame
        backHref="/dashboard/admin"
        backLabel="← Back to Control Tower"
        secondaryHref={bookingId ? `/dashboard/admin/study-halls/${bookingId}` : null}
        secondaryLabel={bookingId ? "← Back to Study Hall" : null}
        url={result.ok ? result.url : null}
        expiresAt={result.ok ? result.expiresAt : null}
        errorStatus={result.ok ? null : result.status}
      />
    </ManagementPage>
  );
}
