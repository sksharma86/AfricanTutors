declare module "@/lib/recording-viewer.mjs" {
  export function parentRecordingViewerPath(recordingId: string): string;
  export function adminRecordingViewerPath(recordingId: string): string;
  export function recordingViewerErrorCopy(status: number): { title: string; body: string };
}
