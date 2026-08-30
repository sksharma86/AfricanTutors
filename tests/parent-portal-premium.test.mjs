import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Parent Portal premium visual system", () => {
  it("scopes the application canvas to .parent-app so other portals stay unchanged", () => {
    const css = read("src/app/globals.css");
    const shell = read("src/components/dashboard/customer-shell.tsx");
    const guide = read("src/components/dashboard/guide-shell.tsx");
    const admin = read("src/components/dashboard/dashboard-shell.tsx");
    assert.match(css, /\.parent-app/);
    assert.match(css, /--pp-canvas: #f6f1e8/);
    assert.match(css, /--pp-gold: #c9a227/);
    assert.match(css, /--pp-hero: #161c18/);
    assert.match(shell, /parent-app/);
    assert.doesNotMatch(guide, /parent-app|--pp-canvas/);
    assert.doesNotMatch(admin, /parent-app|--pp-canvas/);
  });

  it("desktop uses a left rail and mobile keeps a scrollable destination bar", () => {
    const shell = read("src/components/dashboard/customer-shell.tsx");
    assert.match(shell, /<aside/);
    assert.match(shell, /PARENT_NAV_ICONS/);
    assert.match(shell, /bg-\[#f3e6c4\]/);
    assert.match(shell, /overflow-x-auto/);
    assert.match(shell, /snap-x/);
    assert.doesNotMatch(shell, /hamburger|Menu2/);
  });

  it("Next Study Hall is a dark featured hero with gold join action", () => {
    const next = read("src/components/dashboard/parent-next-study-hall.tsx");
    const surface = read("src/components/dashboard/parent-surface.tsx");
    assert.match(next, /ParentSurface featured/);
    assert.match(next, /variant="secondary"/);
    assert.match(next, /Join Study Hall/);
    assert.match(surface, /before:bg-gold-400/);
    assert.match(surface, /pp-hero/);
  });

  it("Home greeting uses local time-of-day without inventing profile data", () => {
    const greet = read("src/components/dashboard/parent-greeting.tsx");
    const home = read("src/app/dashboard/student/page.tsx");
    assert.match(home, /ParentGreeting/);
    assert.match(home, /firstName/);
    assert.match(greet, /Good morning/);
    assert.match(greet, /Good evening/);
    assert.match(greet, /getHours/);
  });
});
