// The video status path and who may walk it (spec FR-018 to FR-020 and FR-030). Pure: no database, no session.

export const videoStatuses = [
  "DRAFT",
  "UPLOADING",
  "PROCESSING",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "REJECTED",
  "APPROVED",
] as const;

export type VideoStatusName = (typeof videoStatuses)[number];

/** Who is making a change: the video host's notifications, the video's creator, or an owner. */
export type ActorKind = "system" | "creator" | "owner";

/** Every move on the path (FR-019). APPROVED and REJECTED have no way out in this spec. */
const path: Record<VideoStatusName, readonly VideoStatusName[]> = {
  DRAFT: ["UPLOADING"],
  UPLOADING: ["PROCESSING", "DRAFT"],
  PROCESSING: ["IN_REVIEW", "DRAFT"],
  IN_REVIEW: ["APPROVED", "CHANGES_REQUESTED", "REJECTED"],
  CHANGES_REQUESTED: ["UPLOADING", "IN_REVIEW"],
  REJECTED: [],
  APPROVED: [],
};

export const allowedNext = (from: VideoStatusName): readonly VideoStatusName[] => path[from];

/** Which kind of actor may make which move (FR-030). Saving a draft is not a move. */
export const movesBy: Record<ActorKind, ReadonlyArray<readonly [VideoStatusName, VideoStatusName]>> = {
  system: [
    ["UPLOADING", "PROCESSING"],
    ["PROCESSING", "IN_REVIEW"],
    ["PROCESSING", "DRAFT"],
    // The first upload was cancelled, errored or expired (spec 9).
    ["UPLOADING", "DRAFT"],
  ],
  creator: [
    ["DRAFT", "UPLOADING"],
    // The creator's submission completes the move once the video host has finished (spec 9).
    ["PROCESSING", "IN_REVIEW"],
    ["CHANGES_REQUESTED", "UPLOADING"],
    ["CHANGES_REQUESTED", "IN_REVIEW"],
  ],
  owner: [
    ["IN_REVIEW", "APPROVED"],
    ["IN_REVIEW", "CHANGES_REQUESTED"],
    ["IN_REVIEW", "REJECTED"],
  ],
};

export const NOTE_MAX = 2000;

/** The note the system records when the video host fails to process an upload and the video goes back to Draft. */
export const PROCESSING_FAILED_NOTE = "The upload didn't work. Please try again.";

/** The note the system records when a video is longer than the limit and goes back to Draft (spec 9, FR-018). */
export const TOO_LONG_NOTE = "That video is longer than 30 minutes. Please upload a shorter one.";

/** The note a system move gets when the caller gave none: only a failed upload or processing (back to Draft) has one. */
export const automaticNote = (from: VideoStatusName, to: VideoStatusName): string | null =>
  (from === "PROCESSING" || from === "UPLOADING") && to === "DRAFT" ? PROCESSING_FAILED_NOTE : null;

const needsNote = (to: VideoStatusName) => to === "REJECTED" || to === "CHANGES_REQUESTED";

export type TransitionCheck =
  | { ok: true }
  | { ok: false; reason: "not-allowed" | "forbidden" | "note-required" | "note-too-long" };

/**
 * Whether `by` may move a video from `from` to `to`. `not-allowed` means the move is off the path;
 * `forbidden` means it is on the path but not for that kind of actor.
 */
export function checkTransition(input: {
  from: VideoStatusName;
  to: VideoStatusName;
  by: ActorKind;
  note?: string | null;
}): TransitionCheck {
  const { from, to, by } = input;
  if (!path[from].includes(to)) return { ok: false, reason: "not-allowed" };
  if (!movesBy[by].some(([f, t]) => f === from && t === to)) return { ok: false, reason: "forbidden" };
  const note = input.note?.trim() ?? "";
  if (needsNote(to) && note === "") return { ok: false, reason: "note-required" };
  if (note.length > NOTE_MAX) return { ok: false, reason: "note-too-long" };
  return { ok: true };
}
