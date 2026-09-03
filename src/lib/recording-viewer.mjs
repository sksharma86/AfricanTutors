/**
 * In-portal recording playback paths and copy.
 * Signed Daily URLs are minted only on the authenticated viewer page —
 * never placed on list-page hrefs or opened via window.open.
 */

export function parentRecordingViewerPath(recordingId) {
  return `/dashboard/student/recordings/${encodeURIComponent(String(recordingId ?? ""))}`;
}

export function adminRecordingViewerPath(recordingId) {
  return `/dashboard/admin/recordings/${encodeURIComponent(String(recordingId ?? ""))}`;
}

export function recordingViewerErrorCopy(status) {
  if (status === 410) {
    return {
      title: "Recording expired",
      body: "This recording is no longer available.",
    };
  }
  if (status === 409) {
    return {
      title: "Recording not ready",
      body: "This recording is not available for playback yet.",
    };
  }
  if (status === 503) {
    return {
      title: "Recording unavailable",
      body: "Video playback is not configured right now.",
    };
  }
  if (status === 502) {
    return {
      title: "Recording unavailable",
      body: "Could not load a secure playback link. Try again.",
    };
  }
  return {
    title: "Recording not found",
    body: "This recording is not available.",
  };
}
