// Turns database rows into the shapes the learner site already uses. Pure: no database access here.

import type { GlossaryEntry, Video } from "./schema";
import type { StageSlug, TopicSlug } from "./taxonomy";
import type { TranscriptLine } from "./transcript";

/**
 * A host as visitors see it. Imported hosts always have every field; a new creator may have no Arabic name,
 * no topics and no story yet, so those are allowed to be empty here (the file-based `Host` type stays strict).
 */
export type PublicHost = {
  slug: string;
  name: string;
  nameArabic: string | null;
  story: string;
  topics: string[];
  photo: string | null;
  order: number;
};

type VideoRow = {
  slug: string;
  title: string;
  titleArabic: string | null;
  stage: string;
  topic: string;
  durationSeconds: number;
  access: "FREE" | "FULL";
  playbackId: string | null;
  sample: boolean;
  host: { slug: string };
};

export function toVideo(row: VideoRow): Video {
  return {
    ...(row.sample ? { sample: true } : {}),
    title: row.title,
    ...(row.titleArabic ? { titleArabic: row.titleArabic } : {}),
    slug: row.slug,
    // Stage and topic are checked against the taxonomy when a video is written.
    stage: row.stage as StageSlug,
    topic: row.topic as TopicSlug,
    host: row.host.slug,
    durationSeconds: row.durationSeconds,
    access: row.access === "FREE" ? "free" : "full",
    ...(row.playbackId ? { playbackId: row.playbackId } : {}),
  };
}

type HostRow = {
  slug: string;
  name: string;
  nameArabic: string | null;
  story: string;
  topics: string[];
  photo: string | null;
  order: number;
};

export function toHost(row: HostRow): PublicHost {
  return {
    slug: row.slug,
    name: row.name,
    nameArabic: row.nameArabic,
    story: row.story,
    topics: row.topics,
    photo: row.photo,
    order: row.order,
  };
}

type SegmentRow = {
  position: number;
  start: number;
  end: number;
  script: string;
  transliteration: string | null;
  english: string | null;
};

/** Transcript lines in playback order. */
export function toTranscriptLines(rows: readonly SegmentRow[]): TranscriptLine[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      start: r.start,
      end: r.end,
      script: r.script,
      transliteration: r.transliteration,
      english: r.english,
    }));
}

type GlossaryRow = {
  entryKey: string;
  word: string;
  base: string;
  transliteration: string;
  english: string;
  audio: string | null;
};

export function toGlossaryEntry(row: GlossaryRow): GlossaryEntry {
  return {
    id: row.entryKey,
    word: row.word,
    base: row.base,
    transliteration: row.transliteration,
    english: row.english,
    ...(row.audio ? { audio: row.audio } : {}),
  };
}
