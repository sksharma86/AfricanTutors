import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bookingToRoom, roomToBooking } from "../src/lib/daily/room-mapping.mjs";
import { RECORDING_OPTS, buildMeetingTokenProps } from "../src/lib/daily/token-props.mjs";

// Pure unit tests (no DB / no Daily credentials).
describe("Phase 5B — room↔booking mapping (authoritative association)", () => {
  const bookingA = "8f0be464-665a-49d9-8897-9f15adfe2806";
  const bookingB = "11111111-2222-3333-4444-555555555555";

  it("round-trips a booking id to its deterministic room and back", () => {
    const room = bookingToRoom(bookingA);
    assert.equal(room, "at-" + bookingA.replace(/-/g, ""));
    assert.equal(roomToBooking(room), bookingA);
  });

  it("a room for booking A never resolves to booking B", () => {
    assert.notEqual(roomToBooking(bookingToRoom(bookingA)), bookingB);
    assert.equal(roomToBooking(bookingToRoom(bookingB)), bookingB);
  });

  it("invalid / foreign room names resolve to null (ignored safely)", () => {
    for (const bad of [null, undefined, "", "lobby", "at-", "at-nothex", "at-123", "https://evil"]) {
      assert.equal(roomToBooking(bad), null);
    }
  });
});

describe("Phase 5B — meeting-token recording privileges", () => {
  it("auto-start recording is enabled at 720p for a normal (non-owner) participant", () => {
    const p = buildMeetingTokenProps({ room: "at-x", userName: "Amara", userId: "student", isOwner: false, expUnix: 123, autoStartRecording: true });
    assert.equal(p.is_owner, false, "students are never owners");
    assert.equal(p.start_cloud_recording, true, "recording auto-starts on join");
    assert.equal(p.start_cloud_recording_opts.height, 720, "composed 720p recording");
    assert.equal(RECORDING_OPTS.height, 720);
    // Must NOT grant recording-management permission → participant cannot stop it.
    assert.ok(!("enable_recording" in p), "participant token must not grant recording control");
    assert.equal(p.enable_recording_ui, false, "Prebuilt Record/Stop is hidden for parents/students");
  });

  it("without autoStartRecording, no recording start properties are added", () => {
    const p = buildMeetingTokenProps({ room: "at-x", userName: "T", userId: "tutor", isOwner: false, expUnix: 1 });
    assert.ok(!("start_cloud_recording" in p));
    assert.equal(p.enable_recording_ui, false);
  });

  it("admins are owners (support) but still don't carry enable_recording control on the token", () => {
    const p = buildMeetingTokenProps({ room: "at-x", userName: "Admin", userId: "admin", isOwner: true, expUnix: 1, autoStartRecording: true });
    assert.equal(p.is_owner, true);
    assert.ok(!("enable_recording" in p));
    assert.equal(p.start_cloud_recording, true, "admin join still auto-starts recording");
    assert.ok(!("enable_recording_ui" in p), "admin recording chrome is not newly restricted");
  });
});
