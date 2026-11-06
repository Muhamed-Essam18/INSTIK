/**
 * Other videos at the same stage as `currentSlug`, in library order starting after it and wrapping around.
 * `videos` is the whole library in order. At most `limit` (three by default); empty for an unknown slug.
 */
export function getUpNext<T extends { slug: string; stage: string }>(
  videos: readonly T[],
  currentSlug: string,
  limit = 3,
): T[] {
  const at = videos.findIndex((video) => video.slug === currentSlug);
  if (at < 0) return [];
  const stage = videos[at].stage;
  const rotated = [...videos.slice(at + 1), ...videos.slice(0, at)];
  return rotated.filter((video) => video.stage === stage).slice(0, limit);
}
