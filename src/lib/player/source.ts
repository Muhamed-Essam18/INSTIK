export const SAMPLE_CLIP_SRC = "/sample/sample-clip.mp4";

export type VideoSource =
  | { kind: "none" }
  | { kind: "sample"; src: string }
  | { kind: "mux"; playbackId: string };

/** Ids starting with "sample-" play the repo's sample clip; any other id is a Mux playback id. */
export function resolveSource(playbackId: string | undefined | null): VideoSource {
  const id = playbackId?.trim();
  if (!id) return { kind: "none" };
  if (id.startsWith("sample-")) return { kind: "sample", src: SAMPLE_CLIP_SRC };
  return { kind: "mux", playbackId: id };
}
