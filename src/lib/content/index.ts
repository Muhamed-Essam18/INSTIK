import type { Cue } from "./vtt";
import { loadAllContent } from "./load";
import type { Glossary, Host, Video } from "./schema";
import { stageOrder } from "./taxonomy";

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

export function getTranscript(language: string, videoSlug: string): Cue[] | undefined {
  return forLanguage(language)?.transcripts[videoSlug];
}

export function getGlossary(language: string): Glossary {
  return forLanguage(language)?.glossary ?? { entries: [] };
}
