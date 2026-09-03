declare module "@/lib/daily/camera-presence.mjs" {
  export type CameraPresenceKind = "on" | "off" | "degraded" | "unknown";
  export type CameraPresenceClassification = { kind: CameraPresenceKind; reason: string };

  export function cameraPresenceApplies(role: string | null | undefined): boolean;
  export function classifyLocalVideoTrack(track: unknown): CameraPresenceClassification;
  export function classifyCameraError(): CameraPresenceClassification;
  export function shouldShowCameraWarning(classification: CameraPresenceClassification | null | undefined): boolean;
  export function shouldAttemptCameraRestore(classification: CameraPresenceClassification | null | undefined): boolean;
  export function cameraWarningCopy(role: string | null | undefined): { title: string; body: string };
  export function localVideoTrackFromParticipants(participants: {
    local?: { tracks?: { video?: unknown } };
  } | null | undefined): unknown;
  export function nextCameraPresenceAction(
    classification: CameraPresenceClassification | null | undefined,
    role: string | null | undefined,
  ): { warning: { title: string; body: string } | null; restore: boolean };
}
