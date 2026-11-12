import { normalizeForSearch } from "../text/normalize";
import { getHosts, getVideos } from "./index";
import type { PublicHost } from "./mappers";
import type { LibraryVideo } from "./search";
import type { Video } from "./schema";
import { getUpNext } from "./upnext";
import { stageLabel } from "./taxonomy";

/** Whole minutes, rounded down, at least 1 (8:40 shows as 8 min). */
export const minutesOf = (durationSeconds: number): number => Math.max(1, Math.floor(durationSeconds / 60));

/** One Approved video as a library card. A video whose host is missing is left out rather than shown without its host. */
export function toLibraryVideos(videos: readonly Video[], hosts: readonly PublicHost[]): LibraryVideo[] {
  const byHost = new Map(hosts.map((h) => [h.slug, h]));
  return videos.flatMap((video) => {
    const host = byHost.get(video.host);
    if (!host) return []; // every video shows its host (brand behaviour)
    return [
      {
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
        access: video.access,
      },
    ];
  });
}

export async function getLibraryVideos(language: string): Promise<LibraryVideo[]> {
  const [videos, hosts] = await Promise.all([getVideos(language), getHosts(language)]);
  return toLibraryVideos(videos, hosts);
}

/** Up next for the player page: up to three other videos at the same stage. */
export async function getUpNextVideos(language: string, videoSlug: string): Promise<LibraryVideo[]> {
  return getUpNext(await getLibraryVideos(language), videoSlug);
}
