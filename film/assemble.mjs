import { readdirSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { ROOT, dirs, run, FPS, W, H } from "./lib.mjs";

const ORDER = [
  "01-homework-has-changed.mp4",
  "02-ai-paradox.mp4",
  "03-what-study-hall-is.mp4",
  "04-parent-entry.mp4",
  "05-booking.mp4",
  "06-guide-workstation.mp4",
  "07-proactive-reliability.mp4",
  "08-actual-product.mp4",
  "09-post-session-loop.mp4",
  "10-management-reveal.mp4",
  "11-management-control-center.mp4",
  "12-finance-workforce.mp4",
  "13-invisible-machine.mp4",
  "14-return-to-human.mp4",
  "15-final-brand.mp4",
];

function probe(file) {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration:stream=width,height,r_frame_rate,codec_type", "-of", "json", file],
    { encoding: "utf8" },
  );
  const json = JSON.parse(r.stdout || "{}");
  const video = (json.streams || []).find((s) => s.codec_type === "video");
  const audio = (json.streams || []).find((s) => s.codec_type === "audio");
  return {
    duration: Number(json.format?.duration || 0),
    width: video?.width || null,
    height: video?.height || null,
    fps: video?.r_frame_rate || null,
    hasAudio: Boolean(audio),
  };
}

const out = dirs();
const files = ORDER.map((name) => path.join(out.scenes, name));
const missing = files.filter((f) => {
  try {
    statSync(f);
    return false;
  } catch {
    return true;
  }
});
if (missing.length) {
  console.error("Missing scenes:\n" + missing.join("\n"));
  process.exit(2);
}

const scenes = files.map((file) => ({ file, name: path.basename(file), ...probe(file) }));
const listPath = path.join(out.tmp, "master-concat.txt");
writeFileSync(listPath, files.map((f) => `file '${f}'`).join("\n"));

const master = path.join(out.master, "study-hall-master-silent.mp4");
await run("ffmpeg", [
  "-y",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  listPath,
  "-an",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-r",
  String(FPS),
  master,
]);

const masterInfo = probe(master);
const manifest = {
  generatedAt: new Date().toISOString(),
  resolution: { width: W, height: H, fps: FPS },
  master: { file: master, ...masterInfo },
  scenes,
};
writeFileSync(path.join(out.manifests, "scene-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
console.log(`assembled ${master} (${masterInfo.duration.toFixed(1)}s)`);
void readdirSync;
