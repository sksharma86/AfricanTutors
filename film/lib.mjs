import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

export const BASE = process.env.FILM_BASE_URL || "http://localhost:3460";
export const ROOT = process.env.FILM_OUT || "/opt/cursor/artifacts/operation-dumbo-drop";
export const W = 1920;
export const H = 1080;
export const FPS = 30;

export function dirs() {
  for (const p of ["master", "scenes", "stills", "title-cards", "manifests", "tmp"]) {
    mkdirSync(path.join(ROOT, p), { recursive: true });
  }
  return {
    master: path.join(ROOT, "master"),
    scenes: path.join(ROOT, "scenes"),
    stills: path.join(ROOT, "stills"),
    cards: path.join(ROOT, "title-cards"),
    manifests: path.join(ROOT, "manifests"),
    tmp: path.join(ROOT, "tmp"),
  };
}

export function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} failed: ${err.slice(-800)}`));
    });
  });
}

export async function toMp4(input, output, { ss = 0 } = {}) {
  const args = ["-y"];
  if (ss > 0.08) args.push("-ss", ss.toFixed(3));
  args.push(
    "-i",
    input,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(FPS),
    "-vf",
    `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2`,
    output,
  );
  await run("ffmpeg", args);
}

export async function withBrowser(fn) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--hide-scrollbars", "--disable-infobars"],
  });
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

export async function hideCaptureChrome(page) {
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-next-badge-root],
      [data-nextjs-toast],
      [data-nextjs-dev-overlay] { display: none !important; }
    `,
  });
}

export async function recordPage(browser, outMp4, runScene, { prepare } = {}) {
  const out = dirs();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    recordVideo: { dir: out.tmp, size: { width: W, height: H } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const started = Date.now();
  if (prepare) await prepare(page);
  const trim = Math.max(0, (Date.now() - started) / 1000 - 0.12);
  await runScene(page);
  const video = page.video();
  await page.close();
  const webm = await video.path();
  await context.close();
  await toMp4(webm, outMp4, { ss: trim });
  return outMp4;
}

export async function gotoReady(page, url) {
  await page.goto(url, { waitUntil: "load", timeout: 45000 });
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {
    /* HMR / long-poll should not block capture */
  }
  await hideCaptureChrome(page);
  await page.evaluate(async () => {
    const timeout = (ms) => new Promise((res) => setTimeout(res, ms));
    if (document.fonts?.ready) await Promise.race([document.fonts.ready, timeout(2500)]);
    await Promise.race([
      Promise.all(
        [...document.images].map((img) =>
          img.complete
            ? null
            : new Promise((res) => {
                img.onload = img.onerror = res;
              }),
        ),
      ),
      timeout(4000),
    ]);
  });
  await page.waitForTimeout(900);
}

export async function linger(page, ms) {
  await page.waitForTimeout(ms);
}

export async function slowScroll(page, y, steps = 18) {
  const current = await page.evaluate(() => window.scrollY);
  const delta = y - current;
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((v) => window.scrollTo(0, v), current + (delta * i) / steps);
    await page.waitForTimeout(90);
  }
}

export async function moveTo(page, selector) {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: "visible" });
  const box = await loc.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 28 });
  }
}

export async function kenBurns({ image, output, seconds, overlay, start = "center" }) {
  const frames = seconds * FPS;
  const yExpr = start === "top" ? "ih*0.12-(ih/zoom/2)" : "ih/2-(ih/zoom/2)";
  const filters = [
    `scale=3200:-1`,
    `zoompan=z='min(zoom+0.00055,1.12)':x='iw/2-(iw/zoom/2)':y='${yExpr}':d=${frames}:s=${W}x${H}:fps=${FPS}`,
  ];
  if (overlay) {
    const escaped = overlay.replace(/'/g, "\\'");
    filters.push(
      `drawtext=text='${escaped}':fontcolor=white:fontsize=42:font=DejaVu\\ Sans:x=(w-text_w)/2:y=h-140:shadowcolor=black@0.55:shadowx=2:shadowy=2`,
    );
  }
  await run("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-i",
    image,
    "-vf",
    filters.join(","),
    "-t",
    String(seconds),
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    output,
  ]);
}

export async function holdCard(browser, surface, seconds, output) {
  return recordPage(
    browser,
    output,
    async (page) => {
      await linger(page, seconds * 1000);
    },
    { prepare: (page) => gotoReady(page, `${BASE}/film/${surface}`) },
  );
}

export function exists(p) {
  return existsSync(p);
}
