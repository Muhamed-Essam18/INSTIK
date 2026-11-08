// When a video counts as Watched. Pure.

/** The share of a video after which it counts as watched (the last 10%). */
export const WATCHED_FROM = 0.9;

/** Position clamped into the video; an unknown duration gives 0. */
export function clampPosition(position: number, duration: number): number {
  if (!Number.isFinite(position) || !(duration > 0)) return 0;
  return Math.min(Math.max(0, Math.floor(position)), Math.floor(duration));
}

/** True once the learner reaches the last 10% or the end. Once true it stays true. */
export function isWatched(position: number, duration: number, alreadyWatched = false): boolean {
  if (alreadyWatched) return true;
  if (!(duration > 0) || !Number.isFinite(position)) return false;
  return position >= duration * WATCHED_FROM;
}
