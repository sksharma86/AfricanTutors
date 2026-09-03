import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  cameraPresenceApplies,
  cameraWarningCopy,
  classifyCameraError,
  classifyLocalVideoTrack,
  localVideoTrackFromParticipants,
  nextCameraPresenceAction,
  shouldAttemptCameraRestore,
  shouldShowCameraWarning,
} from "../src/lib/daily/camera-presence.mjs";
import { ROOM_PARTICIPANT_PROPERTIES } from "../src/lib/daily/room-props.mjs";
import { buildMeetingTokenProps } from "../src/lib/daily/token-props.mjs";
import { JOIN_OPEN_LEAD_MIN } from "../src/lib/session-window.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

function token(role, isOwner = false) {
  return buildMeetingTokenProps({
    room: "at-camera",
    userName: "Jordan",
    userId: role,
    isOwner,
    expUnix: 1_800_000_000,
    autoStartRecording: true,
  });
}

describe("Study Hall camera presence — policy", () => {
  it("requires camera for Guide and student, not admin support", () => {
    assert.equal(cameraPresenceApplies("tutor"), true);
    assert.equal(cameraPresenceApplies("student"), true);
    assert.equal(cameraPresenceApplies("admin"), false);
  });

  it("Guide warning is explicit about remaining visibly present", () => {
    const copy = cameraWarningCopy("tutor");
    assert.equal(copy.title, "Camera required");
    assert.match(copy.body, /visibly present/);
    assert.match(copy.body, /turn your camera back on/);
  });

  it("student warning is calm and not disciplinary", () => {
    const copy = cameraWarningCopy("student");
    assert.equal(copy.title, "Camera needed");
    assert.match(copy.body, /Guide can continue/);
    assert.doesNotMatch(copy.body, /punish|violation|must comply|disciplinary/i);
  });
});

describe("Study Hall camera presence — detection", () => {
  it("treats user-off and blocked/permission as camera-off", () => {
    assert.deepEqual(classifyLocalVideoTrack({ state: "off", off: { byUser: true } }), {
      kind: "off",
      reason: "user",
    });
    assert.deepEqual(classifyLocalVideoTrack({ state: "blocked", blocked: { byPermissions: true } }), {
      kind: "off",
      reason: "permission",
    });
    assert.deepEqual(classifyLocalVideoTrack({ state: "blocked", blocked: { byDeviceMissing: true } }), {
      kind: "off",
      reason: "device",
    });
    assert.deepEqual(classifyCameraError(), { kind: "off", reason: "device" });
    assert.equal(shouldShowCameraWarning(classifyLocalVideoTrack({ state: "off", off: { byUser: true } })), true);
  });

  it("does not treat network interruption or bandwidth off as intentional camera-off", () => {
    const interrupted = classifyLocalVideoTrack({ state: "interrupted" });
    const bandwidth = classifyLocalVideoTrack({ state: "off", off: { byBandwidth: true } });
    assert.equal(interrupted.kind, "degraded");
    assert.equal(bandwidth.kind, "degraded");
    assert.equal(shouldShowCameraWarning(interrupted), false);
    assert.equal(shouldShowCameraWarning(bandwidth), false);
    assert.equal(shouldAttemptCameraRestore(interrupted), false);
    assert.equal(shouldAttemptCameraRestore(bandwidth), false);
  });

  it("playable / loading / sendable are on, and restoration clears the warning", () => {
    for (const state of ["playable", "loading", "sendable"]) {
      const classification = classifyLocalVideoTrack({ state });
      assert.equal(classification.kind, "on");
      assert.deepEqual(nextCameraPresenceAction(classification, "tutor"), { warning: null, restore: false });
      assert.deepEqual(nextCameraPresenceAction(classification, "student"), { warning: null, restore: false });
    }
  });

  it("user-off asks to restore camera for Guide and student", () => {
    const off = classifyLocalVideoTrack({ state: "off", off: { byUser: true } });
    const guide = nextCameraPresenceAction(off, "tutor");
    const student = nextCameraPresenceAction(off, "student");
    const admin = nextCameraPresenceAction(off, "admin");
    assert.equal(guide.restore, true);
    assert.equal(guide.warning.title, "Camera required");
    assert.equal(student.restore, true);
    assert.equal(student.warning.title, "Camera needed");
    assert.deepEqual(admin, { warning: null, restore: false });
  });

  it("reads the local Daily video track from participants()", () => {
    const track = { state: "playable" };
    assert.equal(localVideoTrackFromParticipants({ local: { tracks: { video: track } } }), track);
    assert.equal(localVideoTrackFromParticipants({}), null);
  });
});

describe("Study Hall camera presence — room wiring", () => {
  it("session room listens for Daily media events and restores with setLocalVideo, not CSS hide", () => {
    const room = read("src/components/session/session-room.tsx");
    const banner = read("src/components/session/camera-required-banner.tsx");
    assert.match(room, /createFrame/);
    assert.match(room, /participant-updated/);
    assert.match(room, /joined-meeting/);
    assert.match(room, /camera-error/);
    assert.match(room, /setLocalVideo\(true\)/);
    assert.match(room, /CameraRequiredBanner/);
    assert.match(room, /nextCameraPresenceAction/);
    assert.match(banner, /role="alert"/);
    assert.match(banner, /aria-live="assertive"/);
    assert.doesNotMatch(room, /display:\s*none[\s\S]{0,40}camera|\[data-daily-cam\]|hideCamera/);
    assert.doesNotMatch(room, /setLocalAudio\(/);
  });

  it("microphone remains muteable and screen sharing stays enabled", () => {
    const parent = token("student");
    const guide = token("tutor");
    assert.equal(parent.start_audio_off, false);
    assert.equal(guide.start_audio_off, false);
    assert.ok(!("canSend" in parent));
    assert.ok(!("canSend" in guide));
    assert.equal(ROOM_PARTICIPANT_PROPERTIES.enable_screenshare, true);
    const room = read("src/components/session/session-room.tsx");
    assert.match(room, /mute your microphone/);
    assert.match(room, /Screen sharing stays available/);
  });

  it("recording, Call Parent, five-minute join, and role handling stay intact", () => {
    assert.equal(JOIN_OPEN_LEAD_MIN, 5);
    const parent = token("student");
    const guide = token("tutor");
    const admin = token("admin", true);
    assert.equal(parent.start_cloud_recording, true);
    assert.equal(guide.start_cloud_recording, true);
    assert.equal(parent.enable_recording_ui, false);
    assert.equal(guide.enable_recording_ui, false);
    assert.ok(!("enable_recording" in parent));
    assert.ok(!("enable_recording" in guide));
    assert.equal(admin.is_owner, true);
    assert.equal(ROOM_PARTICIPANT_PROPERTIES.enable_recording, "cloud");
    const room = read("src/components/session/session-room.tsx");
    assert.match(room, /CallParentControl/);
    assert.match(room, /Guide expectations/);
    assert.match(room, /recorded for quality assurance/);
    assert.match(room, /Ready to join 5 minutes before start/);
    const service = read("src/lib/session-service.ts");
    assert.match(service, /autoStartRecording:\s*true/);
    assert.match(service, /isOwner:\s*Boolean\(info\.is_owner\)/);
    const presence = read("src/lib/daily/camera-presence.mjs");
    assert.match(presence, /does not persist incidents/);
  });

  it("visual-review is gated and uses the production banner copy", () => {
    const review = read("src/app/dashboard/session/visual-review/page.tsx");
    assert.match(review, /SESSION_VISUAL_REVIEW/);
    assert.match(review, /notFound/);
    assert.match(review, /CameraRequiredBanner/);
    assert.match(review, /cameraWarningCopy/);
    assert.doesNotMatch(review, /createFrame|DailyIframe/);
  });
});
