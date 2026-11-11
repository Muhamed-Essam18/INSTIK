import { normalizeForSearch } from "../text/normalize";
import type { StageSlug, TopicSlug } from "./taxonomy";

/** What the Library needs about a video; plain data so it can cross to the client component. */
export type LibraryVideo = {
  slug: string;
  title: string;
  stage: StageSlug;
  stageLabel: string;
  topic: TopicSlug;
  minutes: number;
  hostName: string;
  hostSlug: string;
  /** Normalised title, Arabic title and host names, for search only. */
  searchKey: string;
  watched: boolean;
  /** From the video's content file: free, or full access. */
  access: "free" | "full";
  /** Set on the server for a learner without access to this video; absent in the static list. */
  locked?: boolean;
};

export type LibraryFilters = { stage: StageSlug; topic: TopicSlug | null; query: string };

export const isSearching = (query: string): boolean => normalizeForSearch(query) !== "";

/**
 * A non-empty search looks across all stages and topics (every term must match);
 * otherwise the selected stage and topic apply.
 */
export function filterVideos(videos: readonly LibraryVideo[], { stage, topic, query }: LibraryFilters): LibraryVideo[] {
  const terms = normalizeForSearch(query).split(" ").filter(Boolean);
  if (terms.length > 0) return videos.filter((v) => terms.every((t) => v.searchKey.includes(t)));
  return videos.filter((v) => v.stage === stage && (topic === null || v.topic === topic));
}
