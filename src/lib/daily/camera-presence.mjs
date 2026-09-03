/**
 * Study Hall camera-presence policy.
 *
 * Daily Prebuilt cannot hard-lock a participant camera: browsers always let a
 * user stop a MediaStreamTrack, and meeting-token `permissions.canSend` can
 * only withhold video (not require it). V1 therefore:
 *   1. Detect local video-off from Daily track state
 *   2. Distinguish user/device/permission off from transient network stalls
 *   3. Re-enable via setLocalVideo(true) when the user turned the camera off
 *   4. Show a persistent in-room warning until playable video returns
 *
 * Microphone stays participant-controlled. Screen share and cloud recording
 * are unchanged. This module does not persist incidents — Incident History
 * is derived from attendance/coverage/ledger/email and has no camera signal.
 */

export function cameraPresenceApplies(role) {
  return role === "student" || role === "tutor";
}

export function classifyLocalVideoTrack(track) {
  if (!track || typeof track !== "object") {
    return { kind: "unknown", reason: "missing" };
  }
  const state = track.state;
  if (state === "playable" || state === "sendable" || state === "loading") {
    return { kind: "on", reason: state };
  }
  if (state === "interrupted") {
    return { kind: "degraded", reason: "interrupted" };
  }
  if (state === "off" && track.off?.byBandwidth) {
    return { kind: "degraded", reason: "bandwidth" };
  }
  if (state === "off" && track.off?.byUser) {
    return { kind: "off", reason: "user" };
  }
  if (state === "blocked") {
    if (track.blocked?.byPermissions) return { kind: "off", reason: "permission" };
    if (track.blocked?.byDeviceMissing) return { kind: "off", reason: "device" };
    if (track.blocked?.byDeviceInUse) return { kind: "off", reason: "device" };
    return { kind: "off", reason: "blocked" };
  }
  if (state === "off") {
    return { kind: "off", reason: "off" };
  }
  return { kind: "unknown", reason: state ? String(state) : "unknown" };
}

export function classifyCameraError() {
  return { kind: "off", reason: "device" };
}

export function shouldShowCameraWarning(classification) {
  return classification?.kind === "off";
}

export function shouldAttemptCameraRestore(classification) {
  return classification?.kind === "off" && (classification.reason === "user" || classification.reason === "off");
}

export function cameraWarningCopy(role) {
  if (role === "tutor") {
    return {
      title: "Camera required",
      body: "Guides must remain visibly present throughout the Study Hall. Please turn your camera back on to continue.",
    };
  }
  return {
    title: "Camera needed",
    body: "Please turn your camera back on so your Guide can continue your Study Hall with you.",
  };
}

export function localVideoTrackFromParticipants(participants) {
  return participants?.local?.tracks?.video ?? null;
}

export function nextCameraPresenceAction(classification, role) {
  if (!cameraPresenceApplies(role)) {
    return { warning: null, restore: false };
  }
  if (shouldShowCameraWarning(classification)) {
    return {
      warning: cameraWarningCopy(role),
      restore: shouldAttemptCameraRestore(classification),
    };
  }
  return { warning: null, restore: false };
}
