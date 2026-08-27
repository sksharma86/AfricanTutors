import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { ROOM_PARTICIPANT_PROPERTIES, buildRoomProperties } from "../src/lib/daily/room-props.mjs";
import { RECORDING_OPTS, buildMeetingTokenProps } from "../src/lib/daily/token-props.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

function parentToken() {
  return buildMeetingTokenProps({
    room: "at-b26e4654146840d0864a80be622e47f4",
    userName: "Amara",
    userId: "student",
    isOwner: false,
    expUnix: 1_800_000_000,
    autoStartRecording: true,
  });
}

function guideToken() {
  return buildMeetingTokenProps({
    room: "at-b26e4654146840d0864a80be622e47f4",
    userName: "Tomiwa",
    userId: "tutor",
    isOwner: false,
    expUnix: 1_800_000_000,
    autoStartRecording: true,
  });
}

function adminToken() {
  return buildMeetingTokenProps({
    room: "at-b26e4654146840d0864a80be622e47f4",
    userName: "Admin",
    userId: "admin",
    isOwner: true,
    expUnix: 1_800_000_000,
    autoStartRecording: true,
  });
}

describe("Daily participant controls — parent/student token", () => {
  it("is not a room owner and cannot control recording", () => {
    const p = parentToken();
    assert.equal(p.is_owner, false);
    assert.ok(!("enable_recording" in p), "must not grant token recording permission");
    assert.equal(p.enable_recording_ui, false, "Prebuilt Record/Stop hidden");
    assert.deepEqual(p.permissions, { canAdmin: false }, "no moderator/admin tasks");
  });

  it("still auto-starts cloud recording and leaves camera/mic on", () => {
    const p = parentToken();
    assert.equal(p.start_cloud_recording, true);
    assert.deepEqual(p.start_cloud_recording_opts, RECORDING_OPTS);
    assert.equal(p.start_video_off, false);
    assert.equal(p.start_audio_off, false);
  });
});

describe("Daily participant controls — Guide token", () => {
  it("is not a room owner and cannot control recording", () => {
    const p = guideToken();
    assert.equal(p.is_owner, false);
    assert.ok(!("enable_recording" in p));
    assert.equal(p.enable_recording_ui, false);
    assert.deepEqual(p.permissions, { canAdmin: false });
  });

  it("still auto-starts cloud recording and leaves camera/mic on", () => {
    const p = guideToken();
    assert.equal(p.start_cloud_recording, true);
    assert.equal(p.start_video_off, false);
    assert.equal(p.start_audio_off, false);
  });
});

describe("Daily participant controls — admin token", () => {
  it("remains owner for support and does not gain enable_recording", () => {
    const p = adminToken();
    assert.equal(p.is_owner, true);
    assert.ok(!("enable_recording" in p));
    assert.equal(p.start_cloud_recording, true);
    assert.equal(p.start_video_off, false);
    assert.equal(p.start_audio_off, false);
    assert.ok(!("enable_recording_ui" in p), "admin chrome not newly restricted");
    assert.ok(!("permissions" in p), "admin permissions object left unset");
  });
});

describe("Daily participant controls — room capabilities", () => {
  it("disables chat and keeps automatic cloud recording", () => {
    assert.equal(ROOM_PARTICIPANT_PROPERTIES.enable_chat, false);
    assert.equal(ROOM_PARTICIPANT_PROPERTIES.enable_recording, "cloud");
    assert.equal(ROOM_PARTICIPANT_PROPERTIES.enable_screenshare, true);
    assert.equal(ROOM_PARTICIPANT_PROPERTIES.enable_prejoin_ui, true);
    assert.deepEqual(ROOM_PARTICIPANT_PROPERTIES.permissions, { canAdmin: false });
  });

  it("create payload includes chat-off, cloud recording, and join window bounds", () => {
    const props = buildRoomProperties({ notBeforeUnix: 10, notAfterUnix: 20 });
    assert.equal(props.enable_chat, false);
    assert.equal(props.enable_recording, "cloud");
    assert.equal(props.nbf, 10);
    assert.equal(props.exp, 20);
    assert.ok(!("enable_recording_ui" in props), "recording UI is a token property, not a room field");
    assert.ok(!("start_video_off" in props));
    assert.ok(!("start_audio_off" in props));
  });

  it("ensureRoom uses the shared room properties and re-applies them on reuse", () => {
    const client = read("src/lib/daily/client.ts");
    const roomProps = read("src/lib/daily/room-props.mjs");
    assert.match(client, /buildRoomProperties/);
    assert.match(client, /applyRoomParticipantProperties/);
    assert.match(client, /ROOM_PARTICIPANT_PROPERTIES/);
    assert.match(roomProps, /enable_recording: "cloud"/);
    assert.match(roomProps, /enable_chat:\s*false/);
    assert.doesNotMatch(client, /enable_chat:\s*true/);
    assert.doesNotMatch(roomProps, /enable_chat:\s*true/);
  });

  it("session join still auto-starts recording for every role and only admins are owners", () => {
    const service = read("src/lib/session-service.ts");
    assert.match(service, /autoStartRecording:\s*true/);
    assert.match(service, /isOwner:\s*Boolean\(info\.is_owner\)/);
    assert.match(service, /createMeetingToken/);
    const room = read("src/components/session/session-room.tsx");
    assert.match(room, /createFrame/);
    assert.match(room, /frame\.join\(\{\s*url:\s*payload\.roomUrl,\s*token:\s*payload\.token\s*\}\)/);
  });
});
