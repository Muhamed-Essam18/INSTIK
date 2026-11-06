import { buildGlossaryIndex, linkWords, type GlossaryIndex } from "./glossary-link";
import { loadAllContent } from "./load";
import type { Glossary, Host, Video } from "./schema";
import { stageOrder } from "./taxonomy";
import type { TranscriptLine, TranscriptView } from "./transcript";

// Loaded and validated once per process; invalid content throws here, which fails `next build`.
const content = loadAllContent();

const forLanguage = (language: string) => content.get(language);

const byStageThenTitle = (a: Video, b: Video) =>
  stageOrder(a.stage) - stageOrder(b.stage) || a.title.localeCompare(b.title);

export function getVideos(language: string): Video[] {
  return [...(forLanguage(language)?.videos ?? [])].sort(byStageThenTitle);
}

export function getVideo(language: string, slug: string): Video | undefined {
  return forLanguage(language)?.videos.find((v) => v.slug === slug);
}

export function getHosts(language: string): Host[] {
  return forLanguage(language)?.hosts ?? [];
}

export function getHost(language: string, slug: string): Host | undefined {
  return getHosts(language).find((h) => h.slug === slug);
}

export function getVideosByHost(language: string, hostSlug: string): Video[] {
  return getVideos(language).filter((v) => v.host === hostSlug);
}

export function getTranscript(language: string, videoSlug: string): TranscriptLine[] | undefined {
  return forLanguage(language)?.transcripts[videoSlug];
}

export function getGlossary(language: string): Glossary {
  return forLanguage(language)?.glossary ?? { entries: [] };
}

const glossaryIndexes = new Map<string, GlossaryIndex>();

function glossaryIndex(language: string): GlossaryIndex {
  let index = glossaryIndexes.get(language);
  if (!index) {
    index = buildGlossaryIndex(getGlossary(language).entries).index; // ambiguity already fails the build
    glossaryIndexes.set(language, index);
  }
  return index;
}

/** The transcript with each Arabic line split into plain and glossary-linked segments, or undefined without a transcript. */
export function getTranscriptView(language: string, videoSlug: string): TranscriptView | undefined {
  const lines = getTranscript(language, videoSlug);
  if (!lines) return undefined;
  const index = glossaryIndex(language);
  const entries: TranscriptView['entries'] = {};
  const view = lines.map((line) => {
    const segments = linkWords(line.script, index);
    for (const { entryId } of segments) {
      if (!entryId || entries[entryId]) continue;
      const entry = getGlossary(language).entries.find((e) => e.id === entryId)!;
      entries[entryId] = { word: entry.word, transliteration: entry.transliteration, english: entry.english, audio: entry.audio };
    }
    return { start: line.start, end: line.end, segments, transliteration: line.transliteration, english: line.english };
  });
  return { lines: view, entries };
}
