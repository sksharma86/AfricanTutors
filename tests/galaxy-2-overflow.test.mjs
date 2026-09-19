import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";

const LIVE = process.env.GALAXY_LIVE === "1";
const BASE = process.env.GALAXY_BASE_URL || "http://127.0.0.1:3000/";
const CHROME = ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome"].find((p) => existsSync(p));

const WIDTHS = [1920, 1680, 1440, 1366, 1280, 1180, 1024, 980, 900, 820, 768, 430, 414, 393, 390, 360];
const ZOOMS = [0.8, 0.9, 1, 1.1, 1.25, 1.5];

async function loadPuppeteer() {
  try {
    return (await import("puppeteer-core")).default;
  } catch {
    return null;
  }
}

describe("Galaxy 2 homepage — live overflow and layout states", () => {
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
          const cs = (sel) => {
            const el = document.querySelector(sel);
            return el ? getComputedStyle(el) : null;
          };
          const hero = document.querySelector(".sh-home-hero")?.getBoundingClientRect();
          return {
            width: w,
            clientWidth: doc.clientWidth,
            scrollWidth: doc.scrollWidth,
            overflow: doc.scrollWidth > doc.clientWidth + 1,
            heroHeight: hero?.height ?? 0,
            stagePosition: cs(".sh-home-portal__stage-wrap")?.position ?? "",
            sideDisplay: cs(".sh-home-portal__side")?.display ?? "",
            revealCols: cs(".sh-home-portal__reveal")?.gridTemplateColumns ?? "",
            ladderCols: cs(".sh-home-pricing__ladder")?.gridTemplateColumns ?? "",
            spreadCols: cs(".sh-home-hour__spread")?.gridTemplateColumns ?? "",
            headerPosition: cs("header")?.position ?? "",
          };
        }, width);

        if (report.overflow) failures.push(`${width}: horizontal overflow ${report.scrollWidth} > ${report.clientWidth}`);
        if (report.heroHeight < 899) failures.push(`${width}: hero should fill the viewport (${report.heroHeight}px)`);
        if (report.headerPosition !== "fixed") failures.push(`${width}: header should be fixed`);

        const tracks = (v) => (v.match(/[0-9.]+px/g) || []).length;
        if (width >= 1024) {
          if (report.stagePosition !== "sticky") failures.push(`${width}: portal stage should be sticky`);
          if (report.sideDisplay === "none") failures.push(`${width}: portal sidebar should be visible`);
          if (tracks(report.revealCols) < 2) failures.push(`${width}: reveal should be steps | stage`);
          if (tracks(report.ladderCols) < 2) failures.push(`${width}: pricing ladder should be options | flagship`);
          if (tracks(report.spreadCols) < 2) failures.push(`${width}: hour spread should be copy | photo`);
        } else {
          if (report.stagePosition === "sticky") failures.push(`${width}: portal stage should not be sticky`);
          if (report.sideDisplay !== "none") failures.push(`${width}: portal sidebar should be hidden`);
          if (tracks(report.revealCols) >= 2) failures.push(`${width}: reveal should stack`);
          if (tracks(report.ladderCols) >= 2) failures.push(`${width}: pricing ladder should stack`);
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
