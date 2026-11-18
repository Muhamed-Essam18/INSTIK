import { buildGlossaryIndex, linkWords } from "@/lib/content/glossary-link";
import type { Segment } from "@/lib/content/transcript";
import { stripTashkeel } from "@/lib/text/normalize";

// Glossary helpers for the review editor (spec 10, FR-010). Word links are not stored: the learner site links words by matching the
// glossary at render time, so here "linked" just means "the glossary already has this word". Pure: no database.

export type GlossaryRow = {
  /** The database id. */
  id: string;
  /** The id used in content files; generated for entries added here. */
  entryKey: string;
  word: string;
  base: string;
  transliteration: string;
  english: string;
};

/** The matching key the learner site uses: tashkeel removed, words joined by single spaces. */
export const glossaryKey = (word: string): string => stripTashkeel(word).trim().split(/\s+/).join(" ");

/** `script` split into plain text and matched words, plus the entries those matches point at (by entry key). */
export function markLinked(script: string, entries: readonly GlossaryRow[]): { segments: Segment[]; entries: Record<string, GlossaryRow> } {
  const { index } = buildGlossaryIndex(
    entries.map((e) => ({ id: e.entryKey, word: e.word, base: e.base, transliteration: e.transliteration, english: e.english })),
  );
  const segments = linkWords(script, index);
  const byKey = new Map(entries.map((e) => [e.entryKey, e]));
  const used: Record<string, GlossaryRow> = {};
  for (const s of segments) {
    const entry = s.entryId ? byKey.get(s.entryId) : undefined;
    if (entry) used[entry.entryKey] = entry;
  }
  return { segments, entries: used };
}

/** The entry that already covers this word (same key once tashkeel is removed), if any. */
export const findExisting = (word: string, entries: readonly GlossaryRow[]): GlossaryRow | undefined => {
  const key = glossaryKey(word);
  return entries.find((e) => glossaryKey(e.word) === key);
};

/** An id for a new entry: unique among the entries, and never the same as a content-file id by accident. */
export function newEntryKey(existing: readonly GlossaryRow[], random: () => string = () => Math.random().toString(36).slice(2, 8)): string {
  const taken = new Set(existing.map((e) => e.entryKey));
  for (;;) {
    const key = `owner-${random()}`;
    if (!taken.has(key)) return key;
  }
}

export const GLOSSARY_WORD_MAX = 100;
export const GLOSSARY_MEANING_MAX = 200;

/** A tapped word without the punctuation around it ("دنيا،" becomes "دنيا"). */
export const coreWord = (word: string): string => word.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");
