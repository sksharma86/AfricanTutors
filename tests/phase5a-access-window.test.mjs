import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ADMIN_SUPPORT_SECONDS, computeSessionAccessWindow } from "../src/lib/daily/access-window.mjs";

// Pure unit tests (no DB / no Daily credentials) for the Daily access interval
// sent for each participant role.
describe("Phase 5A — Daily access-window computation", () => {
  const now = Date.UTC(2026, 7, 20, 12, 0, 0); // fixed instant
  const nowUnix = Math.floor(now / 1000);
  const open = new Date(now + 50 * 60_000).toISOString(); // opens in 50 min (join_open_at; Study Hall = start-5)
  const close = new Date(now + 135 * 60_000).toISOString(); // end(+60)+15

  it("student token expiration is tied to the normal session close", () => {
    const w = computeSessionAccessWindow({ role: "student", joinOpenAt: open, joinCloseAt: close }, now);
    assert.equal(w.tokenExp, Math.floor(new Date(close).getTime() / 1000), "token expires at normal close");
    assert.equal(w.roomExp, Math.floor(new Date(close).getTime() / 1000));
    assert.equal(w.roomNbf, Math.floor(new Date(open).getTime() / 1000) - 60, "room nbf tracks join_open_at (5 min lead)");
  });

  it("tutor token expiration is also tied to the normal session close", () => {
    const w = computeSessionAccessWindow({ role: "tutor", joinOpenAt: open, joinCloseAt: close }, now);
    assert.equal(w.tokenExp, Math.floor(new Date(close).getTime() / 1000));
  });

  it("admin outside the normal window gets an immediately-valid interval", () => {
    // Session is far in the future (normal room would not be open yet).
    const w = computeSessionAccessWindow({ role: "admin", joinOpenAt: open, joinCloseAt: close }, now);
    assert.ok(w.roomNbf <= nowUnix, "room valid from now (nbf in the past)");
    assert.ok(w.roomExp >= nowUnix, "room valid through now");
    assert.ok(w.tokenExp > nowUnix, "token valid starting now");
  });

  it("admin support token is short-lived (~45 min, never excessive)", () => {
    const w = computeSessionAccessWindow({ role: "admin", joinOpenAt: open, joinCloseAt: close }, now);
    const life = w.tokenExp - nowUnix;
    assert.equal(life, ADMIN_SUPPORT_SECONDS, "admin token lives exactly the support duration");
    assert.ok(life <= 60 * 60, "admin token is at most ~60 minutes");
  });

  it("admin room exp never shrinks below the normal close", () => {
    // If the session close is later than the admin support horizon, keep the later one.
    const farClose = new Date(now + 24 * 60 * 60_000).toISOString();
    const w = computeSessionAccessWindow({ role: "admin", joinOpenAt: open, joinCloseAt: farClose }, now);
    assert.equal(w.roomExp, Math.floor(new Date(farClose).getTime() / 1000));
    assert.equal(w.tokenExp, nowUnix + ADMIN_SUPPORT_SECONDS, "admin token stays short-lived regardless");
  });
});
