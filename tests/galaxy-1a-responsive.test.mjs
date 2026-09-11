import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const css = read("src/app/globals.css");
const callouts = read("src/components/marketing/home/portal-callouts.tsx");
const evening = read("src/components/marketing/home/evening.tsx");
const page = read("src/app/(marketing)/page.tsx");

describe("Galaxy 1A homepage — responsive contracts", () => {
  it("keeps the approved five-section homepage", () => {
    const jsx = page.slice(page.indexOf("return"));
    for (const name of ["HomeHero", "HomeExplainer", "HomeEvening", "HomePortal", "HomePricing"]) {
      assert.match(jsx, new RegExp(name));
    }
  });

  it("uses an intentional Section 3 layout ladder instead of crushing three columns", () => {
    assert.match(css, /\.sh-home-evening__compare \{[\s\S]*display: grid;/);
    assert.match(css, /@media \(min-width: 768px\) \{[\s\S]*\.sh-home-evening__compare \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
    assert.match(css, /@media \(min-width: 980px\) \{[\s\S]*\.sh-home-evening__composition \{[\s\S]*grid-template-columns: minmax\(0, 62fr\) minmax\(0, 38fr\)/);
    assert.match(css, /@media \(min-width: 1280px\) \{[\s\S]*\.sh-home-evening__composition \{[\s\S]*grid-template-columns: minmax\(0, 55fr\) minmax\(0, 45fr\)/);
    assert.doesNotMatch(
      css.slice(css.indexOf("@media (min-width: 768px)"), css.indexOf("@media (min-width: 980px)")),
      /\.sh-home-evening__composition \{[\s\S]*grid-template-columns: minmax\(0, 6[25]fr\)/,
    );
    assert.match(evening, /sh-home-evening__composition/);
  });

  it("anchors Parent Portal annotations to the showcase stage, not a fixed viewBox", () => {
    assert.match(callouts, /closest\("\.sh-home-portal__stage"\)/);
    assert.match(callouts, /ResizeObserver/);
    assert.match(callouts, /min-width: 1180px/);
    assert.match(callouts, /setViewBox/);
    assert.match(callouts, /sh-home-portal__note-arrow/);
    assert.doesNotMatch(callouts, /viewBox="0 0 1000 620"|preserveAspectRatio="none"/);
    assert.match(css, /@media \(min-width: 1180px\) \{[\s\S]*\.sh-home-portal__stage \{[\s\S]*grid-template-columns: minmax\(0, 10rem\) minmax\(0, 1fr\) minmax\(0, 10rem\)/);
    assert.match(css, /@media \(min-width: 1280px\) \{[\s\S]*\.sh-home-portal__stage \{[\s\S]*grid-template-columns: minmax\(0, 13\.25rem\) minmax\(0, 1fr\) minmax\(0, 13\.25rem\)/);
    assert.match(css, /\.sh-home-portal__gutter,[\s\S]*\.sh-home-portal__arrows \{[\s\S]*display: none;/);
  });

  it("stacks pricing until desktop widths that can hold three comparable cards", () => {
    assert.match(css, /@media \(min-width: 1024px\) \{[\s\S]*\.sh-home-pricing__grid \{[\s\S]*minmax\(0, 1fr\) minmax\(0, 1fr\) minmax\(0, 1\.15fr\)/);
    const pricing768 = css.slice(css.indexOf("@media (min-width: 768px)"), css.indexOf("@media (min-width: 1024px)"));
    assert.doesNotMatch(pricing768, /\.sh-home-pricing__grid \{[\s\S]*grid-template-columns: 1fr 1fr 1\.15fr/);
  });

  it("prefers fluid type and min-width 0 over screenshot-locked pixel geometry", () => {
    assert.match(css, /\.sh-home-hero \{[\s\S]*min-height: 88vh;[\s\S]*min-height: 88svh;/);
    assert.match(css, /\.sh-home-offer__price \{[\s\S]*clamp\(2\.4rem, 4vw, 3\.4rem\)/);
    assert.match(css, /\.sh-home-offer__price-head \{[\s\S]*grid-template-rows: 1\.15rem auto/);
    assert.match(css, /\.sh-home-evening__list li \{[\s\S]*min-width: 0;/);
    assert.match(css, /\.sh-home-portal__frame \{[\s\S]*min-width: 0;/);
    assert.match(css, /\.sh-home-evening__list li \{[\s\S]*overflow-wrap: break-word;/);
    assert.match(css, /body:has\(\.sh-home\) footer \.max-w-7xl\.grid \{[\s\S]*minmax\(0, 1\.4fr\) repeat\(5, minmax\(0, 1fr\)\)/);
    assert.doesNotMatch(callouts, /left: 0\.15rem|top: 7%|M 152 48/);
  });
});
