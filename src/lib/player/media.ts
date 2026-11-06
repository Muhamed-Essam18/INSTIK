import type { PlayableMedia } from "@/components/player/PlaybackProvider";

// Writes to a media element live here, outside components, so the React lint rule against mutating props stays meaningful.

export function seekMedia(media: PlayableMedia, seconds: number): void {
  media.currentTime = Math.max(0, seconds);
}

export function skipMedia(media: PlayableMedia, deltaSeconds: number): void {
  media.currentTime = Math.max(0, media.currentTime + deltaSeconds);
}

export function setMediaRate(media: PlayableMedia, rate: number): void {
  media.playbackRate = rate;
}
