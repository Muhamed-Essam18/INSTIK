import { normalizeForSearch } from "../text/normalize";
import { getHosts, getVideos } from "./index";
import type { LibraryVideo } from "./search";
import { stageLabel } from "./taxonomy";

/** Whole minutes, rounded down, at least 1 (8:40 shows as 8 min). */
export const minutesOf = (durationSeconds: number): number => Math.max(1, Math.floor(durationSeconds / 60));

export function getLibraryVideos(language: string): LibraryVideo[] {
  const hosts = new Map(getHosts(language).map((h) => [h.slug, h]));
  return getVideos(language).map((video) => {
    const host = hosts.get(video.host)!; // validated at build: every video has a host
    return {
      slug: video.slug,
      title: video.title,
      stage: video.stage,
      stageLabel: stageLabel(video.stage),
      topic: video.topic,
      minutes: minutesOf(video.durationSeconds),
      hostName: host.name,
      hostSlug: host.slug,
      searchKey: normalizeForSearch([video.title, video.titleArabic, host.name, host.nameArabic].join(" ")),
      watched: false,
    };
  });
}
