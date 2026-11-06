// Makes public/sample/sample-clip.mp4: the 30 s placeholder clip every sample video plays (spec 003).
// Generated from ffmpeg's test pattern and a quiet tone, so there is no third-party footage.
// The finished file is committed; run this only to change it.
//
// ffmpeg does not have to be installed. Either put one on PATH, or point FFMPEG at a binary, e.g.:
//   mkdir %TEMP%\ffm && cd %TEMP%\ffm && npm init -y && npm install ffmpeg-static
//   set FFMPEG=%TEMP%\ffm\node_modules\ffmpeg-static\ffmpeg.exe && node scripts/make-sample-clip.mjs
// (ffmpeg-static is deliberately not a dependency of this project.)
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const ffmpeg = process.env.FFMPEG || "ffmpeg";
const out = path.join(process.cwd(), "public", "sample", "sample-clip.mp4");
mkdirSync(path.dirname(out), { recursive: true });

const seconds = 30;
const args = [
  "-y",
  "-f", "lavfi", "-i", `testsrc2=size=640x360:rate=24:duration=${seconds}`,
  "-f", "lavfi", "-i", `sine=frequency=220:sample_rate=44100:duration=${seconds}`,
  "-af", "volume=0.04",
  "-c:v", "libx264", "-preset", "veryslow", "-crf", "34", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "32k",
  "-movflags", "+faststart",
  "-shortest",
  out,
];

const result = spawnSync(ffmpeg, args, { stdio: "inherit" });
if (result.status !== 0) {
  console.error(`ffmpeg failed or was not found (tried "${ffmpeg}"). See the notes at the top of this file.`);
  process.exit(result.status ?? 1);
}
console.log(`Wrote ${out}`);
