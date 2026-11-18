import type { Cue } from "@/lib/content/vtt";

// Transcript segment rules for the owner's editor (spec 10). Pure: no database. Times are seconds.

export const SEGMENT_TEXT_MAX = 1000;
export const SEGMENTS_MAX = 2000;
export const VTT_MAX_BYTES = 1024 * 1024;

export type SegmentInput = { start: number; end: number; script: string; transliteration: string; english: string };
export type SegmentRecord = SegmentInput & { id: string; position: number; revision: number };

export type SegmentField = "start" | "end" | "script" | "transliteration" | "english" | "segment";
export type SegmentProblem = { field: SegmentField; message: string };

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;

/** What is wrong with one segment on its own (not against the others). Empty means fine. */
export function validateSegment(input: SegmentInput, context: { durationSeconds: number | null }): SegmentProblem[] {
  const problems: SegmentProblem[] = [];
  if (!Number.isFinite(input.start) || input.start < 0) problems.push({ field: "start", message: "The start time needs to be 0:00 or later." });
  if (!Number.isFinite(input.end)) problems.push({ field: "end", message: "Add an end time." });
  if (Number.isFinite(input.start) && Number.isFinite(input.end) && input.start >= input.end) {
    problems.push({ field: "end", message: "The start needs to come before the end." });
  }
  if (context.durationSeconds !== null && Number.isFinite(input.end) && input.end > context.durationSeconds) {
    problems.push({ field: "end", message: "This segment ends after the video does." });
  }
  if (input.script.trim() === "") problems.push({ field: "script", message: "Add the Arabic text." });
  for (const field of ["script", "transliteration", "english"] as const) {
    if (input[field].length > SEGMENT_TEXT_MAX) problems.push({ field, message: `Keep this to ${SEGMENT_TEXT_MAX.toLocaleString("en")} characters or fewer.` });
  }
  return problems;
}

/** Whether `candidate` overlaps any other segment (touching ends are fine). `exceptId` is the segment being edited. */
export function overlapsAny(others: readonly Pick<SegmentRecord, "id" | "start" | "end">[], candidate: { start: number; end: number }, exceptId?: string): boolean {
  return others.some((s) => s.id !== exceptId && overlaps(s, candidate));
}

/** Segments sorted by start time (then end). */
export const orderSegments = <T extends { start: number; end: number }>(segments: readonly T[]): T[] =>
  [...segments].sort((a, b) => a.start - b.start || a.end - b.end);

/** The position (1, 2, 3 ...) each segment should have, by start time. Only segments whose position changes are returned. */
export function renumber(segments: readonly Pick<SegmentRecord, "id" | "start" | "end" | "position">[]): { id: string; position: number }[] {
  return orderSegments(segments)
    .map((s, i) => ({ id: s.id, position: i + 1, was: s.position }))
    .filter((s) => s.position !== s.was)
    .map(({ id, position }) => ({ id, position }));
}

/** Seconds as m:ss, or h:mm:ss for an hour or more. Fractions are shown to one decimal only when there is one. */
export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const frac = Math.round((seconds - whole) * 10) / 10;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const tail = frac > 0 ? `.${Math.round(frac * 10)}` : "";
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${tail}` : `${m}:${String(s).padStart(2, "0")}${tail}`;
}

/** "1:05", "0:04.5", "1:02:03" or plain seconds ("65") as seconds; null when it is not a time. */
export function parseTime(text: string): number | null {
  const t = text.trim();
  if (t === "") return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(t);
  if (!m) return null;
  const [, h = "0", min, sec] = m;
  if (Number(min) > 59 || Number(sec) >= 60) return null;
  return Number(h) * 3600 + Number(min) * 60 + Number(sec);
}

const stripTags = (text: string) => text.replace(/<[^>]*>/g, "");

/** WebVTT cues as segments: several lines joined with a space, tags removed, the text goes into the Arabic field. */
export function cuesToSegments(cues: readonly Cue[]): SegmentInput[] {
  return cues.map((c) => ({
    start: c.start,
    end: c.end,
    script: stripTags(c.text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(" "),
    transliteration: "",
    english: "",
  }));
}

export type ImportMode = "add" | "replace";
export type MergeResult = { ok: true; segments: SegmentInput[] } | { ok: false; problems: string[] };

/**
 * The transcript that results from an import. Replace: the imported segments alone. Add: the existing ones plus the imported ones,
 * refused if any overlap. Either way the whole result must be valid, so an import is all or nothing.
 */
export function mergeImport(
  existing: readonly SegmentInput[],
  incoming: readonly SegmentInput[],
  mode: ImportMode,
  context: { durationSeconds: number | null },
): MergeResult {
  const problems: string[] = [];
  const all = mode === "replace" ? [...incoming] : [...existing, ...incoming];
  if (all.length > SEGMENTS_MAX) problems.push(`A transcript can have at most ${SEGMENTS_MAX.toLocaleString("en")} segments.`);
  incoming.forEach((s, i) => {
    for (const p of validateSegment(s, context)) problems.push(`Segment ${i + 1} of the file (${formatTime(s.start)}): ${p.message}`);
  });
  const ordered = orderSegments(all);
  for (let i = 1; i < ordered.length; i++) {
    if (overlaps(ordered[i - 1], ordered[i])) problems.push(`The segments at ${formatTime(ordered[i - 1].start)} and ${formatTime(ordered[i].start)} overlap.`);
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, segments: ordered };
}
