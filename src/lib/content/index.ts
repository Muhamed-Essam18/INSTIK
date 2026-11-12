import "server-only";
import { db } from "@/lib/db";
import { getLanguageBySlug } from "@/lib/languages";
import { buildGlossaryIndex, linkWords, type GlossaryIndex } from "./glossary-link";
import { toGlossaryEntry, toHost, toTranscriptLines, toVideo, type PublicHost } from "./mappers";
import type { Glossary, Video } from "./schema";
import { stageOrder } from "./taxonomy";
import type { TranscriptLine, TranscriptView } from "./transcript";

// What learners see. Every video read here goes through `approvedOnly`, and no function takes a status, so a video that
// is not Approved cannot be returned by this module, and asking for one gives the same answer as a missing video.
// Creator and owner reads live in creator-reads.ts and need an acting user.

/** The one filter every learner-facing video query uses (constitution VIII). */
export const approvedOnly = { status: "APPROVED" } as const;

/** Languages are addressed by slug in URLs and stored by code; an unknown slug has no content. */
const codeOf = (slug: string): string | undefined => getLanguageBySlug(slug)?.code;

const byStageThenTitle = (a: Video, b: Video) =>
  stageOrder(a.stage) - stageOrder(b.stage) || a.title.localeCompare(b.title);

const withHost = { host: { select: { slug: true } } } as const;

export async function getVideos(language: string): Promise<Video[]> {
  const languageCode = codeOf(language);
  if (!languageCode) return [];
  const rows = await db().video.findMany({ where: { languageCode, ...approvedOnly }, include: withHost });
  return rows.map(toVideo).sort(byStageThenTitle);
}

export async function getVideo(language: string, slug: string): Promise<Video | undefined> {
  const languageCode = codeOf(language);
  if (!languageCode) return undefined;
  const row = await db().video.findFirst({ where: { languageCode, slug, ...approvedOnly }, include: withHost });
  return row ? toVideo(row) : undefined;
}

/**
 * The hosts list: imported hosts, and creators who have at least one Approved video. Only the list is filtered;
 * `getHost` opens any host so a new creator's page works before their first video is approved.
 */
export async function getHosts(language: string): Promise<PublicHost[]> {
  const languageCode = codeOf(language);
  if (!languageCode) return [];
  const rows = await db().host.findMany({
    where: { languageCode, OR: [{ userId: null }, { videos: { some: approvedOnly } }] },
    orderBy: { order: "asc" },
  });
  return rows.map(toHost);
}

export async function getHost(language: string, slug: string): Promise<PublicHost | undefined> {
  const languageCode = codeOf(language);
  if (!languageCode) return undefined;
  const row = await db().host.findUnique({ where: { languageCode_slug: { languageCode, slug } } });
  return row ? toHost(row) : undefined;
}

export async function getVideosByHost(language: string, hostSlug: string): Promise<Video[]> {
  const languageCode = codeOf(language);
  if (!languageCode) return [];
  const rows = await db().video.findMany({
    where: { languageCode, host: { slug: hostSlug }, ...approvedOnly },
    include: withHost,
  });
  return rows.map(toVideo).sort(byStageThenTitle);
}

export async function getTranscript(language: string, videoSlug: string): Promise<TranscriptLine[] | undefined> {
  const languageCode = codeOf(language);
  if (!languageCode) return undefined;
  const row = await db().video.findFirst({
    where: { languageCode, slug: videoSlug, ...approvedOnly },
    select: { segments: { orderBy: { position: "asc" } } },
  });
  if (!row || row.segments.length === 0) return undefined;
  return toTranscriptLines(row.segments);
}

export async function getGlossary(language: string): Promise<Glossary> {
  const languageCode = codeOf(language);
  if (!languageCode) return { entries: [] };
  const rows = await db().glossaryEntry.findMany({ where: { languageCode }, orderBy: { entryKey: "asc" } });
  return { entries: rows.map(toGlossaryEntry) };
}

// The glossary index is rebuilt only when the entries change (checked by their count and last entry).
const glossaryIndexes = new Map<string, { stamp: string; index: GlossaryIndex }>();

function glossaryIndex(language: string, glossary: Glossary): GlossaryIndex {
  const last = glossary.entries.at(-1);
  const stamp = `${glossary.entries.length}:${last?.id ?? ""}:${last?.word ?? ""}`;
  const cached = glossaryIndexes.get(language);
  if (cached?.stamp === stamp) return cached.index;
  const { index } = buildGlossaryIndex(glossary.entries); // ambiguity is refused when the glossary is imported
  glossaryIndexes.set(language, { stamp, index });
  return index;
}

/** The transcript with each Arabic line split into plain and glossary-linked segments, or undefined without a transcript. */
export async function getTranscriptView(language: string, videoSlug: string): Promise<TranscriptView | undefined> {
  const lines = await getTranscript(language, videoSlug);
  if (!lines) return undefined;
  const glossary = await getGlossary(language);
  const index = glossaryIndex(language, glossary);
  const byId = new Map(glossary.entries.map((e) => [e.id, e]));
  const entries: TranscriptView["entries"] = {};
  const view = lines.map((line) => {
    const segments = linkWords(line.script, index);
    for (const { entryId } of segments) {
      if (!entryId || entries[entryId]) continue;
      const entry = byId.get(entryId)!;
      entries[entryId] = { word: entry.word, transliteration: entry.transliteration, english: entry.english, audio: entry.audio };
    }
    return { start: line.start, end: line.end, segments, transliteration: line.transliteration, english: line.english };
  });
  return { lines: view, entries };
}
