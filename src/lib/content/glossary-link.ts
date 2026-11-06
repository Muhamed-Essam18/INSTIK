import { stripTashkeel } from "../text/normalize";
import type { GlossaryEntry } from "./schema";
import type { Segment } from "./transcript";

const EDGE_PUNCTUATION = /^([\p{P}\p{S}]*)([\s\S]*?)([\p{P}\p{S}]*)$/u;

/** Matching key: tashkeel and tatweel removed, no letter folding, words joined by single spaces. */
const keyOf = (text: string): string => stripTashkeel(text).trim().split(/\s+/).join(" ");

export type GlossaryIndex = {
  byKey: ReadonlyMap<string, GlossaryEntry>;
  /** Most words in any one entry; bounds how far a phrase match looks ahead. */
  maxWords: number;
};

/** Indexes entries by key. Two entries with the same key are ambiguous and reported as errors. */
export function buildGlossaryIndex(entries: readonly GlossaryEntry[]): { index: GlossaryIndex; errors: string[] } {
  const byKey = new Map<string, GlossaryEntry>();
  const errors: string[] = [];
  let maxWords = 1;
  for (const entry of entries) {
    const key = keyOf(entry.word);
    const first = byKey.get(key);
    if (first) {
      errors.push(`ambiguous "${key}" in entries "${first.id}" and "${entry.id}"`);
      continue;
    }
    byKey.set(key, entry);
    maxWords = Math.max(maxWords, key.split(" ").length);
  }
  return { index: { byKey, maxWords }, errors };
}

type Word = { lead: string; core: string; trail: string; key: string };

function splitWord(token: string): Word {
  const [, lead = "", core = "", trail = ""] = EDGE_PUNCTUATION.exec(token) ?? [];
  return { lead, core, trail, key: keyOf(core) };
}

/**
 * Splits a script line into plain text and glossary-linked words or phrases.
 * Longest phrase wins; punctuation stays outside the link; the segments always join back to the original line.
 */
export function linkWords(script: string, { byKey, maxWords }: GlossaryIndex): Segment[] {
  const tokens = script.split(/(\s+)/); // even positions: words (possibly ""), odd positions: whitespace
  const words = new Map<number, Word>();
  tokens.forEach((token, i) => {
    if (i % 2 === 0 && token !== "") words.set(i, splitWord(token));
  });

  const segments: Segment[] = [];
  const push = (text: string, entryId?: string) => {
    if (!text) return;
    const last = segments.at(-1);
    if (!entryId && last && !last.entryId) last.text += text;
    else segments.push(entryId ? { text, entryId } : { text });
  };

  const matchAt = (start: number): { count: number; id: string } | undefined => {
    for (let count = maxWords; count >= 1; count--) {
      const run = Array.from({ length: count }, (_, k) => words.get(start + 2 * k));
      if (run.some((w) => !w || w.key === "")) continue;
      const parts = run as Word[];
      // A phrase must not span punctuation between its words.
      const clean = parts.every((w, k) => k === parts.length - 1 || (w.trail === "" && parts[k + 1].lead === ""));
      if (!clean) continue;
      const entry = byKey.get(parts.map((w) => w.key).join(" "));
      if (entry) return { count, id: entry.id };
    }
    return undefined;
  };

  let t = 0;
  while (t < tokens.length) {
    const word = words.get(t);
    if (!word) {
      push(tokens[t]);
      t++;
      continue;
    }
    const match = matchAt(t);
    if (!match) {
      push(tokens[t]);
      t++;
      continue;
    }
    let text = "";
    for (let k = 0; k < match.count; k++) {
      text += words.get(t + 2 * k)!.core;
      if (k < match.count - 1) text += tokens[t + 2 * k + 1];
    }
    push(word.lead);
    push(text, match.id);
    push(words.get(t + 2 * (match.count - 1))!.trail);
    t += 2 * match.count - 1; // the next token is the whitespace after the last word
  }
  return segments;
}
