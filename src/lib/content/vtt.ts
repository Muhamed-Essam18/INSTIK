export type Cue = { start: number; end: number; text: string };

export type VttResult = { cues: Cue[]; errors: string[] };

const TIME = /^(?:(\d{1,2}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/;
const TIMING = /^(\S+)\s+-->\s+(\S+)(?:\s.*)?$/;

function seconds(stamp: string): number | undefined {
  const m = TIME.exec(stamp);
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

/** Parses the WebVTT subset Instik uses. Errors carry line numbers; cues are returned for what did parse. */
export function parseVtt(source: string): VttResult {
  const lines = source.replace(/^﻿/, "").split(/\r?\n/);
  const errors: string[] = [];
  const cues: Cue[] = [];

  if (!/^WEBVTT(\s.*)?$/.test(lines[0] ?? "")) {
    return { cues, errors: ['line 1: file must start with "WEBVTT"'] };
  }

  let i = 1;
  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i++;
      continue;
    }
    // A block runs to the next blank line.
    const start = i;
    while (i < lines.length && lines[i].trim() !== "") i++;
    const block = lines.slice(start, i);
    if (/^NOTE(\s|$)/.test(block[0])) continue;

    const timingIndex = block.findIndex((l) => l.includes("-->"));
    if (timingIndex < 0) {
      errors.push(`line ${start + 1}: cue has no timing line`);
      continue;
    }
    const line = start + timingIndex + 1;
    const m = TIMING.exec(block[timingIndex]);
    const from = m ? seconds(m[1]) : undefined;
    const to = m ? seconds(m[2]) : undefined;
    if (from === undefined || to === undefined) {
      errors.push(`line ${line}: malformed timestamp`);
      continue;
    }
    if (to <= from) {
      errors.push(`line ${line}: cue must end after it starts`);
      continue;
    }
    const prev = cues.at(-1);
    if (prev && from < prev.end) {
      errors.push(`line ${line}: cue starts before the previous cue ends`);
    }
    const body = block
      .slice(timingIndex + 1)
      .join("\n")
      .trim();
    if (!body) {
      errors.push(`line ${line}: cue text is empty`);
      continue;
    }
    cues.push({ start: from, end: to, text: body });
  }

  return { cues, errors };
}
