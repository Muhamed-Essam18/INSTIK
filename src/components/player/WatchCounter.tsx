"use client";

import { useWatchCounter } from "@/hooks/useWatchCounter";

/** Counts honest watch time for the video beside it. Renders nothing; must sit inside a PlaybackProvider. */
export function WatchCounter({ languageCode, videoSlug }: { languageCode: string; videoSlug: string }) {
  useWatchCounter({ languageCode, videoSlug });
  return null;
}
