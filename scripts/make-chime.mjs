// Generates public/sounds/hour-chime.wav: a soft two-note chime synthesised here (no third-party audio, no licence).
import { writeFileSync } from "node:fs";

const rate = 16000;
const seconds = 0.8;
const n = Math.floor(rate * seconds);
const data = Buffer.alloc(n * 2);
const notes = [
  { f: 880, start: 0, len: 0.8 },
  { f: 1320, start: 0.12, len: 0.68 },
];
for (let i = 0; i < n; i++) {
  const t = i / rate;
  let v = 0;
  for (const { f, start, len } of notes) {
    const u = t - start;
    if (u < 0 || u > len) continue;
    const attack = Math.min(1, u / 0.01);
    v += Math.sin(2 * Math.PI * f * t) * attack * Math.exp(-4.5 * u) * 0.5;
  }
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 0.6 * 32767), i * 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);
writeFileSync("public/sounds/hour-chime.wav", Buffer.concat([header, data]));
