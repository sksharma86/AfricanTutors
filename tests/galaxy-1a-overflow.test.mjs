import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";

const LIVE = process.env.GALAXY_LIVE === "1";
const BASE = process.env.GALAXY_BASE_URL || "http://127.0.0.1:3000/";
const CHROME = ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome"].find((p) => existsSync(p));

const WIDTHS = [1920, 1680, 1440, 1366, 1280, 1180, 1024, 820, 768, 430, 414, 393, 390];
const ZOOMS = [0.8, 0.9, 1, 1.1, 1.25, 1.5];

async function loadPuppeteer() {
  try {
    return (await import("puppeteer-core")).default;
  } catch {
    return null;
  }
}

describe("Galaxy 1A homepage — live overflow and layout states", () => {
  it("has no horizontal overflow and uses intentional layout ladders", async (t) => {
    if (!LIVE) {
      t.skip("set GALAXY_LIVE=1 with the marketing homepage served to run this audit");
      return;
    }
    if (!CHROME) {
      t.skip("Chrome is not available in this environment");
      return;
    }
    const puppeteer = await loadPuppeteer();
    if (!puppeteer) {
      t.skip("puppeteer-core is not installed");
      return;
    }

    let reachable = false;
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(2500) });
      reachable = res.ok;
    } catch {
      reachable = false;
    }
    if (!reachable) {
      t.skip(`homepage is not reachable at ${BASE}`);
      return;
    }

    const browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: "new",
      args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
    });

    const failures = [];
    try {
      for (const width of WIDTHS) {
        const page = await browser.newPage();
        await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
        await page.goto(BASE, { waitUntil: "networkidle0", timeout: 60000 });
        await page.waitForSelector(".sh-home");
        await new Promise((r) => setTimeout(r, 350));

        const report = await page.evaluate((w) => {
          const doc = document.documentElement;
          const evening = document.querySelector(".sh-home-evening__composition");
          const compare = document.querySelector(".sh-home-evening__compare");
          const stage = document.querySelector(".sh-home-portal__stage");
          const gutters = [...document.querySelectorAll(".sh-home-portal__gutter")];
          const arrows = document.querySelector(".sh-home-portal__arrows");
          const pricing = document.querySelector(".sh-home-pricing__grid");
          const cs = (el) => (el ? getComputedStyle(el) : null);
          const eveningCs = cs(evening);
          const compareCs = cs(compare);
          const stageCs = cs(stage);
          const gutterCs = gutters.map((el) => getComputedStyle(el).display);
          const arrowCs = cs(arrows);
          const pricingCs = cs(pricing);
          const notes = [...document.querySelectorAll(".sh-home-portal__note")].map((el) => {
            const r = el.getBoundingClientRect();
            const stageBox = stage?.getBoundingClientRect();
            return {
              clipped:
                stageBox &&
                (r.left < stageBox.left - 1 || r.right > stageBox.right + 1 || r.top < stageBox.top - 1 || r.bottom > stageBox.bottom + 1),
              visible: r.width > 0 && getComputedStyle(el).display !== "none",
            };
          });
          return {
            width: w,
            clientWidth: doc.clientWidth,
            scrollWidth: doc.scrollWidth,
            overflow: doc.scrollWidth > doc.clientWidth + 1,
            eveningCols: eveningCs?.gridTemplateColumns || "",
            compareCols: compareCs?.gridTemplateColumns || "",
            stageCols: stageCs?.gridTemplateColumns || "",
            guttersVisible: gutterCs.some((d) => d !== "none"),
            arrowsVisible: Boolean(arrowCs && arrowCs.display !== "none"),
            pricingCols: pricingCs?.gridTemplateColumns || "",
            notes,
          };
        }, width);

        if (report.overflow) {
          failures.push(`${width}: horizontal overflow ${report.scrollWidth} > ${report.clientWidth}`);
        }

        const threeRegion = /minmax\(0,\s*55fr\)/.test(report.eveningCols);
        if (width >= 1280 && !threeRegion) {
          failures.push(`${width}: evening should be Before | With | Photo`);
        }
        if (width < 1280 && threeRegion) {
          failures.push(`${width}: evening should not use the three-region composition`);
        }
        if (width >= 768 && width < 1280 && !/minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/.test(report.compareCols)) {
          failures.push(`${width}: evening compare should be Before | With`);
        }
        if (width < 768 && /minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/.test(report.compareCols)) {
          failures.push(`${width}: evening should stack Before / With`);
        }

        if (width >= 1180) {
          if (!report.guttersVisible || !report.arrowsVisible) {
            failures.push(`${width}: portal annotations should be visible`);
          }
          if (report.notes.some((n) => n.clipped)) {
            failures.push(`${width}: a portal annotation extends outside the stage`);
          }
        } else if (report.guttersVisible || report.arrowsVisible) {
          failures.push(`${width}: portal annotations should be hidden`);
        }

        const threePrice = (report.pricingCols.match(/minmax/g) || []).length >= 3;
        if (width >= 1024 && !threePrice) {
          failures.push(`${width}: pricing should be three comparable columns`);
        }
        if (width < 1024 && threePrice) {
          failures.push(`${width}: pricing should stack`);
        }

        await page.close();
      }

      const zoomPage = await browser.newPage();
      for (const zoom of ZOOMS) {
        const width = Math.round(1440 / zoom);
        await zoomPage.setViewport({ width, height: Math.round(900 / zoom), deviceScaleFactor: 1 });
        await zoomPage.goto(BASE, { waitUntil: "networkidle0", timeout: 60000 });
        await new Promise((r) => setTimeout(r, 250));
        const overflow = await zoomPage.evaluate(() => {
          const doc = document.documentElement;
          return doc.scrollWidth > doc.clientWidth + 1 ? [doc.scrollWidth, doc.clientWidth] : null;
        });
        if (overflow) {
          failures.push(`zoom ${Math.round(zoom * 100)}% effective ${width}: overflow ${overflow[0]} > ${overflow[1]}`);
        }
      }
      await zoomPage.close();
    } finally {
      await browser.close();
    }

    assert.deepEqual(failures, []);
  });
});
