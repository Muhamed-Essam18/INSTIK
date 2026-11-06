import type { Cue } from "./vtt";

export type TranscriptLine = {
  start: number;
  end: number;
  /** Script as stored, with tashkeel. */
  script: string;
  transliteration: string | null;
  english: string | null;
};

/** A run of the script line: plain text, or a word (or phrase) linked to a glossary entry. */
export type Segment = { text: string; entryId?: string };

export type TranscriptViewEntry = { word: string; transliteration: string; english: string; audio?: string };

/** What the page sends to the client: plain data only. */
export type TranscriptView = {
  lines: { start: number; end: number; segments: Segment[]; transliteration: string | null; english: string | null }[];
  entries: Record<string, TranscriptViewEntry>;
};

/** Layers that have their own line in a cue; `tashkeel` is derived from the script, so it has none. */
export const cueLayers = (layers: readonly string[]): string[] => layers.filter((layer) => layer !== "tashkeel");

const NOTHING = "-";

/**
 * Splits each cue into one line per layer, in the order of the language's `transcriptLayers` without `tashkeel`.
 * A layer with nothing to show is a single `-` (becomes null); the script line may not be empty or `-`.
 */
export function parseTranscript(
  layers: readonly string[],
  cues: readonly Cue[],
): { lines: TranscriptLine[]; errors: string[] } {
  const expected = cueLayers(layers);
  const errors: string[] = [];
  const lines: TranscriptLine[] = [];

  for (const cue of cues) {
    const parts = cue.text.split("\n").map((part) => part.trim());
    if (parts.length !== expected.length) {
      errors.push(
        `line ${cue.line}: expected ${expected.length} lines (${expected.join(", ")}), found ${parts.length}`,
      );
      continue;
    }
    const byLayer = new Map(expected.map((layer, i) => [layer, parts[i]]));
    const script = byLayer.get("script") ?? "";
    if (script === "" || script === NOTHING) {
      errors.push(`line ${cue.line}: the script line must have text (not empty or "-")`);
      continue;
    }
    const optional = (layer: string) => {
      const value = byLayer.get(layer);
      return value === undefined || value === "" || value === NOTHING ? null : value;
    };
    lines.push({
      start: cue.start,
      end: cue.end,
      script,
      transliteration: optional("transliteration"),
      english: optional("english"),
    });
  }

  return { lines, errors };
}
