import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { partitionBookings } from "../src/lib/bookings.mjs";
import { JOIN_CLOSE_GRACE_MIN, JOIN_OPEN_LEAD_MIN, customerJoinState } from "../src/lib/session-window.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const START = Date.parse("2026-08-26T23:00:00Z");
const END = Date.parse("2026-08-27T00:00:00Z");
const startISO = new Date(START).toISOString();
const endISO = new Date(END).toISOString();

function confirmed(id = "active") {
  return { id, status: "confirmed", scheduled_start: startISO, scheduled_end: endISO };
}

describe("Session join window — partitionBookings keeps active confirmed sessions", () => {
  it("keeps JOIN_OPEN_LEAD_MIN = 5 and JOIN_CLOSE_GRACE_MIN = 15", () => {
    assert.equal(JOIN_OPEN_LEAD_MIN, 5);
    assert.equal(JOIN_CLOSE_GRACE_MIN, 15);
  });

  it("a confirmed future booking remains Upcoming/Next", () => {
    const now = START - 30 * 60000;
    const row = confirmed();
    const { upcoming, past, next } = partitionBookings([row], now);
    assert.deepEqual(upcoming.map((b) => b.id), ["active"]);
    assert.deepEqual(past, []);
    assert.equal(next?.id, "active");
    assert.equal(customerJoinState("confirmed", startISO, endISO, now).state, "opens_at");
  });

  it("at T−6 Join is unavailable (opens_at)", () => {
    const now = START - 6 * 60000;
    assert.equal(customerJoinState("confirmed", startISO, endISO, now).state, "opens_at");
    const { upcoming, next } = partitionBookings([confirmed()], now);
    assert.equal(upcoming.length, 1);
    assert.equal(next?.id, "active");
  });

  it("at T−5 Join becomes available", () => {
    const now = START - 5 * 60000;
    assert.equal(customerJoinState("confirmed", startISO, endISO, now).state, "join");
    const { upcoming, next } = partitionBookings([confirmed()], now);
    assert.equal(next?.id, "active");
    assert.equal(upcoming.length, 1);
  });

  it("after scheduled_start the confirmed booking stays Upcoming/Next, not past", () => {
    const now = START + 20 * 60000;
    assert.equal(customerJoinState("confirmed", startISO, endISO, now).state, "join");
    const { upcoming, past, next } = partitionBookings([confirmed()], now);
    assert.deepEqual(upcoming.map((b) => b.id), ["active"]);
    assert.deepEqual(past, []);
    assert.equal(next?.id, "active");
  });

  it("Join remains available during the session", () => {
    const now = START + 40 * 60000;
    assert.equal(customerJoinState("confirmed", startISO, endISO, now).state, "join");
    assert.equal(partitionBookings([confirmed()], now).next?.id, "active");
  });

  it("Join remains available through scheduled_end + 15 minutes", () => {
    const now = END + JOIN_CLOSE_GRACE_MIN * 60000;
    assert.equal(customerJoinState("confirmed", startISO, endISO, now).state, "join");
    const { upcoming, past } = partitionBookings([confirmed()], now);
    assert.equal(upcoming.length, 1);
    assert.equal(past.length, 0);
  });

  it("after the join-close window it becomes history / non-joinable", () => {
    const now = END + JOIN_CLOSE_GRACE_MIN * 60000 + 1;
    assert.equal(customerJoinState("confirmed", startISO, endISO, now).state, "ended");
    const { upcoming, past, next } = partitionBookings([confirmed()], now);
    assert.deepEqual(upcoming, []);
    assert.deepEqual(past.map((b) => b.id), ["active"]);
    assert.equal(next, null);
  });

  it("completed/cancelled bookings stay in past even during the clock window", () => {
    const now = START + 10 * 60000;
    const done = { id: "done", status: "completed", scheduled_start: startISO, scheduled_end: endISO };
    const { upcoming, past } = partitionBookings([done], now);
    assert.deepEqual(upcoming, []);
    assert.equal(past[0]?.id, "done");
  });
});

describe("Session join window — parent dashboard uses partition + join state", () => {
  it("history cards are only used for the past list", () => {
    const page = read("src/app/dashboard/student/page.tsx");
    assert.match(page, /past\.map\(\(b\) => cardFor\(b, \{ history: true \}\)\)/);
    assert.match(page, /laterUpcoming\.map\(\(b\) => cardFor\(b\)\)/);
    assert.match(page, /cardFor\(next, \{ featured: true \}\)/);
    assert.match(page, /state === "join"/);
    assert.match(page, /Join Study Hall/);
  });

  it("partitionBookings uses customerJoinState rather than start < now", () => {
    const src = read("src/lib/bookings.mjs");
    assert.match(src, /customerJoinState/);
    assert.doesNotMatch(src, /scheduled_start\)\.getTime\(\) < now && b\.status === "confirmed"/);
  });
});

describe("Daily mount — persistent visible stage", () => {
  const room = read("src/components/session/session-room.tsx");

  it("does not initialize Daily inside a hidden / display:none mount", () => {
    assert.doesNotMatch(room, /ref=\{containerRef\}[\s\S]{0,80}className="hidden"/);
    assert.doesNotMatch(room, /className="hidden"/);
    assert.match(room, /data-daily-mount="true"/);
    assert.match(room, /setStageOpen\(true\)/);
    assert.match(room, /createFrame\(node/);
    assert.match(room, /if \(!stageOpen \|\| !payloadRef\.current/);
  });

  it("uses one persistent Daily mount node", () => {
    const mounts = room.match(/data-daily-mount="true"/g) ?? [];
    assert.equal(mounts.length, 1);
    const refs = room.match(/ref=\{containerRef\}/g) ?? [];
    assert.equal(refs.length, 1);
    assert.match(room, /h-\[70vh\] w-full overflow-hidden rounded-2xl bg-black/);
  });
});
