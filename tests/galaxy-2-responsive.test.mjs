import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const css = read("src/app/globals.css");

/** The rule whose selector list is exactly `selector` (not a grouped list). */
const block = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:\\n\\n|\\*/\\n)(${escaped} \\{[^}]*\\})`).exec(css);
  assert.ok(match, `${selector} must exist`);
  return match[1];
};
const media = (query) => {
  const start = css.indexOf(`@media (${query}) {`);
  assert.ok(start >= 0, `@media (${query}) must exist`);
  let depth = 0;
  for (let i = start; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  return css.slice(start);
};

describe("Galaxy 2 homepage — visual system contracts", () => {
  it("replaces the 1A homepage CSS instead of stacking on top of it", () => {
    assert.doesNotMatch(css, /Homepage 1A/);
    assert.doesNotMatch(css, /\.sh-home-explainer|\.sh-home-offer|\.sh-home-portal__gutter|\.sh-home-portal__note/);
    assert.match(css, /Galaxy 2 — public homepage visual system/);
  });

  it("pairs an editorial serif for statements with Geist for everything functional", () => {
    assert.match(read("src/app/layout.tsx"), /Instrument_Serif/);
    assert.match(read("src/app/layout.tsx"), /--font-editorial/);
    assert.match(block(".sh-home .sh-home-display"), /var\(--font-editorial\)/);
    assert.match(block(".sh-home .sh-home-kicker"), /text-transform: uppercase/);
    assert.match(block(".sh-home-option__price"), /font-weight: 600/);
    assert.doesNotMatch(block(".sh-home-option__price"), /font-editorial/);
  });

  it("builds on a restrained warm palette with strategic dark moments", () => {
    const root = block(".sh-home");
    for (const token of ["--sh-paper", "--sh-charcoal", "--sh-night", "--sh-accent"]) assert.match(root, new RegExp(token));
    assert.match(block(".sh-home-portal"), /background: var\(--sh-night\)/);
    assert.match(block(".sh-home-evening__before"), /background: var\(--sh-charcoal\)/);
    assert.match(block(".sh-home-hour"), /background: var\(--sh-paper\)/);
    assert.match(block(".sh-home-pricing"), /background: var\(--sh-paper\)/);
  });

  it("uses fluid type and min-width: 0 rather than pixel-locked geometry", () => {
    assert.match(block(".sh-home-hero"), /min-height: 100vh;[\s\S]*min-height: 100svh;/);
    for (const sel of [
      ".sh-home-hero__title",
      ".sh-home-hour__title",
      ".sh-home-evening__title",
      ".sh-home-portal__title",
      ".sh-home-flagship__title",
      ".sh-home-option__price",
    ]) {
      assert.match(block(sel), /clamp\(/, `${sel} uses clamp()`);
    }
    for (const sel of [".sh-home-portal__frame", ".sh-home-hour__spread", ".sh-home-pricing__ladder", ".sh-home-option"]) {
      assert.match(block(sel), /min-width: 0/, `${sel} has min-width: 0`);
    }
    assert.doesNotMatch(block(".sh-home-evening__fragment"), /position: absolute/);
    assert.match(block(".sh-home-evening__noise"), /display: grid/);
  });

  it("keeps the sticky product reveal desktop-only and the stage static below", () => {
    const desktop = media("min-width: 1024px");
    assert.match(desktop, /\.sh-home-portal__stage-wrap \{[\s\S]*position: sticky;/);
    assert.match(desktop, /\.sh-home-portal__reveal \{[\s\S]*grid-template-columns: minmax\(0, 4fr\) minmax\(0, 8fr\)/);
    assert.match(desktop, /\.sh-home-portal__side \{[\s\S]*display: flex;/);
    assert.doesNotMatch(block(".sh-home-portal__stage-wrap"), /position: sticky/);
    assert.match(block(".sh-home-portal__side"), /display: none/);
    assert.match(css, /\.sh-home-portal__stage\[data-step="plan"\] \[data-region="plan"\]/);
    assert.match(css, /\.sh-home-portal__stage\[data-step="join"\] \[data-region="join"\]/);
  });

  it("lays pricing out as two quiet rows plus the flagship, three-across nowhere", () => {
    const desktop = media("min-width: 1024px");
    assert.match(desktop, /\.sh-home-pricing__ladder \{[\s\S]*grid-template-columns: minmax\(0, 6fr\) minmax\(0, 6fr\)/);
    assert.doesNotMatch(css, /\.sh-home-pricing__ladder \{[\s\S]*repeat\(3/);
    assert.match(block(".sh-home-option"), /border-top: 1px solid var\(--sh-line\)/);
  });

  it("treats motion as progressive enhancement and honors reduced motion", () => {
    assert.match(css, /@supports \(animation-timeline: view\(\)\)/);
    assert.match(css, /@supports \(animation-timeline: scroll\(\)\)/);
    const reduced = css.slice(css.indexOf("Galaxy 2 — public homepage"));
    assert.match(reduced, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.sh-home-hero__photo,[\s\S]*animation: none;/);
    assert.match(reduced, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.sh-home-portal__stage \[data-region\],[\s\S]*transition: none;/);
    const galaxy2 = css.slice(css.indexOf("Galaxy 2 — public homepage"), css.indexOf("Galaxy 1B — How It Works"));
    assert.ok(galaxy2.length > 0, "Galaxy 2 block precedes the 1B block");
    assert.doesNotMatch(galaxy2, /rotate\((?:[2-9]\d|1\d)deg\)|scale\(1\.[3-9]/);
  });

  it("keeps the public header fixed and transparent over the hero", () => {
    const header = block("body:has(.sh-home) header");
    assert.match(header, /position: fixed;/);
    assert.match(header, /z-index: 60;/);
    assert.match(header, /background: transparent;/);
    assert.doesNotMatch(header, /position: absolute;/);
    assert.match(read("src/components/marketing/home/header-scroll.tsx"), /data-scrolled/);
    assert.match(css, /body:has\(\.sh-home\) header\[data-scrolled\]/);
  });

  it("lets the footer continue the paper environment", () => {
    assert.match(block("body:has(.sh-home) footer"), /background: #f7f3ec/);
    assert.match(css, /body:has\(\.sh-home\) footer \.max-w-7xl\.grid \{[\s\S]*minmax\(0, 1\.4fr\) repeat\(5, minmax\(0, 1fr\)\)/);
  });
});
