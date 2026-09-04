import path from "node:path";
import { writeFileSync } from "node:fs";

import {
  BASE,
  ROOT,
  dirs,
  withBrowser,
  recordPage,
  gotoReady,
  linger,
  slowScroll,
  moveTo,
  kenBurns,
  holdCard,
  exists,
  run,
} from "./lib.mjs";

const STUDENT = "/workspace/public/images/student-tutoring-session.jpg";
const GUIDE = "/workspace/public/images/tutor-portrait.jpg";
const DESK = "/workspace/public/images/marketing/studyhall-hero-desk.webp";

async function concat(files, output) {
  const list = files.map((f) => `file '${f}'`).join("\n");
  const listPath = path.join(dirs().tmp, `concat-${Date.now()}.txt`);
  writeFileSync(listPath, list);
  await run("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    output,
  ]);
}

async function xfade(a, b, output, duration = 0.7) {
  await run("ffmpeg", [
    "-y",
    "-i",
    a,
    "-i",
    b,
    "-filter_complex",
    `[0:v][1:v]xfade=transition=fade:duration=${duration}:offset=0`,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    output,
  ]);
}

export async function scene01(browser) {
  const out = dirs();
  const home = path.join(out.tmp, "01-home.mp4");
  const card = path.join(out.cards, "01-homework-has-changed.mp4");
  const dest = path.join(out.scenes, "01-homework-has-changed.mp4");
  await recordPage(
    browser,
    home,
    async (page) => {
      await linger(page, 7000);
      await slowScroll(page, 240, 26);
      await linger(page, 8000);
      await slowScroll(page, 0, 16);
      await linger(page, 4000);
    },
    { prepare: (page) => gotoReady(page, `${BASE}/`) },
  );
  await holdCard(browser, "card-homework", 14, card);
  await concat([home, card], dest);
  return dest;
}

export async function scene02(browser) {
  const out = dirs();
  const parts = [];
  const cards = [
    ["card-ai-explain", 8],
    ["card-ai-answer", 8],
    ["card-ai-generate", 8],
    ["card-ai-work", 12],
    ["card-presence", 10],
  ];
  for (const [surface, sec] of cards) {
    const p = path.join(out.tmp, `02-${surface}.mp4`);
    await holdCard(browser, surface, sec, p);
    parts.push(p);
  }
  const dest = path.join(out.scenes, "02-ai-paradox.mp4");
  await concat(parts, dest);
  return dest;
}

export async function scene03(browser) {
  const dest = path.join(dirs().scenes, "03-what-study-hall-is.mp4");
  await recordPage(
    browser,
    dest,
    async (page) => {
      await linger(page, 5000);
      await slowScroll(page, 380, 26);
      await linger(page, 8000);
      await slowScroll(page, 980, 28);
      await linger(page, 10000);
      await slowScroll(page, 1680, 24);
      await linger(page, 8000);
    },
    { prepare: (page) => gotoReady(page, `${BASE}/how-it-works`) },
  );
  return dest;
}

export async function scene04(browser) {
  const dest = path.join(dirs().scenes, "04-parent-entry.mp4");
  await recordPage(
    browser,
    dest,
    async (page) => {
      await linger(page, 4000);
      const cta = page.getByRole("link", { name: /Try your first Study Hall free|Get started|Sign up/i }).first();
      await cta.waitFor({ state: "visible" });
      await moveTo(page, "a[href='/signup']");
      await linger(page, 1800);
      await cta.click();
      await page.waitForURL(/signup/);
      await linger(page, 7000);
      await gotoReady(page, `${BASE}/film/parent`);
      await linger(page, 7000);
      await slowScroll(page, 280, 18);
      await linger(page, 7000);
      await slowScroll(page, 560, 16);
      await linger(page, 6000);
    },
    { prepare: (page) => gotoReady(page, `${BASE}/`) },
  );
  return dest;
}

export async function scene05(browser) {
  const dest = path.join(dirs().scenes, "05-booking.mp4");
  await recordPage(
    browser,
    dest,
    async (page) => {
      await page.locator('[data-film-next="who"]').waitFor();
      await linger(page, 7000);
      await page.locator('[data-film-next="who"]').click();
      await page.locator('[data-film="book-duration"]').waitFor();
      await linger(page, 7000);
      await page.locator('[data-film-next="duration"]').click();
      await page.locator('[data-film="book-when"]').waitFor();
      await linger(page, 4500);
      await page.locator('[data-film="book-when"] button', { hasText: "Fri 6" }).click();
      await linger(page, 1800);
      await page.locator('[data-film="book-when"] button', { hasText: "6:30 PM" }).click();
      await linger(page, 4000);
      await page.locator('[data-film-next="when"]').click();
      await page.locator('[data-film="book-confirm"]').waitFor();
      await linger(page, 8000);
      await page.locator('[data-film-next="confirm"]').click();
      await page.locator('[data-film="book-done"]').waitFor();
      await linger(page, 9000);
    },
    { prepare: (page) => gotoReady(page, `${BASE}/film/parent-book`) },
  );
  return dest;
}

export async function scene06(browser) {
  const dest = path.join(dirs().scenes, "06-guide-workstation.mp4");
  await recordPage(
    browser,
    dest,
    async (page) => {
      await linger(page, 7000);
      await slowScroll(page, 300, 18);
      await linger(page, 7000);
      await slowScroll(page, 760, 20);
      await linger(page, 7000);
      await gotoReady(page, `${BASE}/film/guide-required`);
      await linger(page, 10000);
    },
    { prepare: (page) => gotoReady(page, `${BASE}/film/guide`) },
  );
  return dest;
}

export async function scene07(browser) {
  const dest = path.join(dirs().scenes, "07-proactive-reliability.mp4");
  await recordPage(
    browser,
    dest,
    async (page) => {
      await linger(page, 7000);
      await gotoReady(page, `${BASE}/film/management-search`);
      await linger(page, 7000);
      await slowScroll(page, 360, 16);
      await linger(page, 4000);
      await gotoReady(page, `${BASE}/film/guide-coverage`);
      await linger(page, 7000);
      await gotoReady(page, `${BASE}/film/management-restored`);
      await linger(page, 7000);
    },
    { prepare: (page) => gotoReady(page, `${BASE}/film/guide-required`) },
  );
  return dest;
}

export async function scene08(browser) {
  const out = dirs();
  const a = path.join(out.tmp, "08-a.mp4");
  const b = path.join(out.tmp, "08-b.mp4");
  const cShot = path.join(out.stills, "08-session.png");
  const c = path.join(out.tmp, "08-c.mp4");
  const dShot = path.join(out.stills, "08-call.png");
  const d = path.join(out.tmp, "08-d.mp4");
  const dest = path.join(out.scenes, "08-actual-product.mp4");

  if (!exists(STUDENT) || !exists(GUIDE)) {
    throw new Error("Marketing photographs missing for scene 08");
  }
  await kenBurns({ image: STUDENT, output: a, seconds: 16, overlay: "LIVE HUMAN PRESENCE", start: "top" });
  await kenBurns({ image: GUIDE, output: b, seconds: 12, overlay: "VISIBLE. PRESENT. ENGAGED." });

  await recordPage(
    browser,
    path.join(out.tmp, "08-session-hold.mp4"),
    async (page) => {
      await page.screenshot({ path: cShot, fullPage: false });
      await linger(page, 2000);
    },
    { prepare: (page) => gotoReady(page, `${BASE}/film/session`) },
  );
  await kenBurns({
    image: cShot,
    output: c,
    seconds: 14,
    overlay: "VISIBLE. PRESENT. ENGAGED.",
  });

  await recordPage(
    browser,
    path.join(out.tmp, "08-call-hold.mp4"),
    async (page) => {
      await page.screenshot({ path: dShot, fullPage: false });
      await linger(page, 2000);
    },
    { prepare: (page) => gotoReady(page, `${BASE}/film/session-call`) },
  );
  await kenBurns({
    image: dShot,
    output: d,
    seconds: 14,
    overlay: "PARENT AVAILABLE WHEN NEEDED",
  });

  const rec = path.join(out.tmp, "08-rec.mp4");
  await kenBurns({
    image: DESK,
    output: rec,
    seconds: 12,
    overlay: "RECORDED FOR PARENT ACCESS",
  });

  await concat([a, b, c, d, rec], dest);
  return dest;
}

export async function scene09(browser) {
  const dest = path.join(dirs().scenes, "09-post-session-loop.mp4");
  await recordPage(
    browser,
    dest,
    async (page) => {
      await linger(page, 5000);
      const good = page.getByText(/Good|Great/i).first();
      if (await good.count()) await good.click();
      await linger(page, 2500);
      const work = page.locator("textarea").first();
      if (await work.count()) {
        await work.click();
        await work.fill("Homework stayed on track.");
      }
      await linger(page, 6000);
      await gotoReady(page, `${BASE}/film/parent-completed`);
      await linger(page, 9000);
      await slowScroll(page, 380, 16);
      await linger(page, 7000);
      await gotoReady(page, `${BASE}/film/parent-recording`);
      await linger(page, 10000);
    },
    { prepare: (page) => gotoReady(page, `${BASE}/film/guide-report`) },
  );
  return dest;
}

export async function scene10(browser) {
  const out = dirs();
  const a = path.join(out.cards, "10-simple.mp4");
  const b = path.join(out.cards, "10-not-simple.mp4");
  const c = path.join(out.tmp, "10-mgmt.mp4");
  const dest = path.join(out.scenes, "10-management-reveal.mp4");
  await holdCard(browser, "card-simple", 5, a);
  await holdCard(browser, "card-not-simple", 5, b);
  await recordPage(
    browser,
    c,
    async (page) => {
      await linger(page, 5500);
    },
    { prepare: (page) => gotoReady(page, `${BASE}/film/management`) },
  );
  await concat([a, b, c], dest);
  return dest;
}

export async function scene11(browser) {
  const dest = path.join(dirs().scenes, "11-management-control-center.mp4");
  await recordPage(
    browser,
    dest,
    async (page) => {
      await linger(page, 8000);
      await slowScroll(page, 420, 20);
      await linger(page, 6000);
      await gotoReady(page, `${BASE}/film/management-study-halls`);
      await linger(page, 8000);
      await gotoReady(page, `${BASE}/film/management-guides`);
      await linger(page, 8000);
      await gotoReady(page, `${BASE}/film/management-customers`);
      await linger(page, 7000);
      await gotoReady(page, `${BASE}/film/management-attention`);
      await linger(page, 7000);
      await gotoReady(page, `${BASE}/film/management-incidents`);
      await linger(page, 8000);
    },
    { prepare: (page) => gotoReady(page, `${BASE}/film/management`) },
  );
  return dest;
}

export async function scene12(browser) {
  const dest = path.join(dirs().scenes, "12-finance-workforce.mp4");
  await recordPage(
    browser,
    dest,
    async (page) => {
      await linger(page, 8000);
      await slowScroll(page, 380, 16);
      await linger(page, 8000);
      await gotoReady(page, `${BASE}/film/guide`);
      await linger(page, 3000);
      await slowScroll(page, 860, 20);
      await linger(page, 10000);
    },
    { prepare: (page) => gotoReady(page, `${BASE}/film/management-finance`) },
  );
  return dest;
}

export async function scene13(browser) {
  const dest = path.join(dirs().scenes, "13-invisible-machine.mp4");
  await recordPage(
    browser,
    dest,
    async (page) => {
      await linger(page, 42000);
    },
    { prepare: (page) => gotoReady(page, `${BASE}/film/machine`) },
  );
  return dest;
}

export async function scene14() {
  const out = dirs();
  const a = path.join(out.tmp, "14-a.mp4");
  const b = path.join(out.tmp, "14-b.mp4");
  const dest = path.join(out.scenes, "14-return-to-human.mp4");
  await kenBurns({ image: STUDENT, output: a, seconds: 34, start: "top" });
  await kenBurns({ image: GUIDE, output: b, seconds: 20 });
  await concat([a, b], dest);
  return dest;
}

export async function scene15(browser) {
  const dest = path.join(dirs().scenes, "15-final-brand.mp4");
  await holdCard(browser, "card-final", 16, dest);
  return dest;
}

const SCENES = {
  "01": scene01,
  "02": scene02,
  "03": scene03,
  "04": scene04,
  "05": scene05,
  "06": scene06,
  "07": scene07,
  "08": scene08,
  "09": scene09,
  "10": scene10,
  "11": scene11,
  "12": scene12,
  "13": scene13,
  "14": scene14,
  "15": scene15,
};

const only = process.argv[2];

dirs();
await withBrowser(async (browser) => {
  const ids = only ? [only] : Object.keys(SCENES);
  for (const id of ids) {
    const fn = SCENES[id];
    if (!fn) throw new Error(`Unknown scene ${id}`);
    console.log(`capturing scene ${id}`);
    const file = await fn(browser);
    console.log(`wrote ${file}`);
  }
});
