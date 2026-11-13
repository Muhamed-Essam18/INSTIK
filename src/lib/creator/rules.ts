// What a creator sees and may do, worked out from a video's stored status and flags (spec 9, data-model.md). Pure: no
// database, no session, no clock except the one passed in.

import { getLanguageByCode, isAvailable } from "@/lib/languages";
import type { VideoStatusName } from "@/lib/content/status";
import { stageSlugs, topicSlugs } from "@/lib/content/taxonomy";
import { UPLOAD_GIVE_UP_SECONDS } from "./limits";

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 1000;

/** The five items a creator confirms before submitting, as in docs/design/CreatorUpload.dc.html. */
export const CHECKLIST_ITEMS = [
  "A real person is on camera, in a real place, with natural light.",
  "The room is quiet and the speech is clear.",
  "I speak at the pace of the stage I chose.",
  "No background music with lyrics.",
  "I own this video and its music, and I agree to the creator terms.",
] as const;

/** The stored facts display and permissions are worked out from. */
export type VideoFacts = {
  status: VideoStatusName;
  deletedAt?: Date | null;
  submittedAt?: Date | null;
  assetReadyAt?: Date | null;
  uploadStartedAt?: Date | null;
  /** Whether the video host has created the current file's asset (the ids themselves never reach the browser). */
  hasAsset?: boolean;
  /** A new version was started / its asset exists. */
  hasPendingUpload?: boolean;
  hasPendingAsset?: boolean;
  pendingReadyAt?: Date | null;
  pendingStartedAt?: Date | null;
};

export type DisplayKey =
  | "draft"
  | "upload-unfinished"
  | "uploading"
  | "processing"
  | "ready-to-submit"
  | "in-review"
  | "changes-requested"
  | "rejected"
  | "live";

export type PendingKey = "new-version-processing" | "new-version-ready" | "new-version-unfinished";

export type Display = {
  key: DisplayKey;
  label: string;
  /** Set only for a Changes requested video with a new version on the way. */
  pending?: { key: PendingKey; label: string };
};

const labels: Record<DisplayKey, string> = {
  draft: "Draft",
  "upload-unfinished": "Upload didn't finish",
  uploading: "Uploading",
  processing: "Processing",
  "ready-to-submit": "Ready to submit",
  "in-review": "In review",
  "changes-requested": "Changes requested",
  rejected: "Rejected",
  live: "Live",
};

const pendingLabels: Record<PendingKey, string> = {
  "new-version-processing": "New version processing",
  "new-version-ready": "New version ready to submit",
  "new-version-unfinished": "New version didn't finish",
};

const gaveUp = (startedAt: Date | null | undefined, now: Date): boolean =>
  Boolean(startedAt) && now.getTime() - startedAt!.getTime() > UPLOAD_GIVE_UP_SECONDS * 1000;

/** What the creator sees for a video (the table in data-model.md). */
export function displayStatus(video: VideoFacts, now: Date): Display {
  const make = (key: DisplayKey, pending?: PendingKey): Display => ({
    key,
    label: labels[key],
    ...(pending ? { pending: { key: pending, label: pendingLabels[pending] } } : {}),
  });
  switch (video.status) {
    case "DRAFT":
      return make("draft");
    case "UPLOADING":
      return gaveUp(video.uploadStartedAt, now) && !video.hasAsset ? make("upload-unfinished") : make("uploading");
    case "PROCESSING":
      return video.assetReadyAt && !video.submittedAt ? make("ready-to-submit") : make("processing");
    case "IN_REVIEW":
      return make("in-review");
    case "REJECTED":
      return make("rejected");
    case "APPROVED":
      return make("live");
    case "CHANGES_REQUESTED": {
      if (video.pendingReadyAt) return make("changes-requested", "new-version-ready");
      if (video.hasPendingAsset) return make("changes-requested", "new-version-processing");
      if (video.hasPendingUpload) {
        return gaveUp(video.pendingStartedAt, now)
          ? make("changes-requested", "new-version-unfinished")
          : make("changes-requested", "new-version-processing");
      }
      return make("changes-requested");
    }
  }
}

export type Filter = "all" | "in-review" | "changes" | "live" | "drafts";
export const filters: readonly { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in-review", label: "In review" },
  { key: "changes", label: "Changes requested" },
  { key: "live", label: "Live" },
  { key: "drafts", label: "Drafts" },
];

/** Reads the `?status=` value; anything unknown means All. */
export function parseFilter(value: string | string[] | undefined): Filter {
  const one = Array.isArray(value) ? value[0] : value;
  return filters.some((f) => f.key === one) ? (one as Filter) : "all";
}

const draftKeys: readonly DisplayKey[] = ["draft", "upload-unfinished", "ready-to-submit"];

/** Whether a video with this display status belongs under the filter. Uploading, Processing and Rejected are only under All. */
export function inFilter(key: DisplayKey, filter: Filter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "in-review":
      return key === "in-review";
    case "changes":
      return key === "changes-requested";
    case "live":
      return key === "live";
    case "drafts":
      return draftKeys.includes(key);
  }
}

/** Soft-deleted videos are in no list and in no count. */
export function visibleVideos<T extends VideoFacts>(videos: readonly T[]): T[] {
  return videos.filter((v) => !v.deletedAt);
}

/** Videos for a filter; the counts below use the same function so rows and counts always agree. */
export function listFor<T extends VideoFacts>(videos: readonly T[], filter: Filter, now: Date): T[] {
  return visibleVideos(videos).filter((v) => inFilter(displayStatus(v, now).key, filter));
}

export function countByFilter(videos: readonly VideoFacts[], now: Date): Record<Filter, number> {
  const counts = {} as Record<Filter, number>;
  for (const { key } of filters) counts[key] = listFor(videos, key, now).length;
  return counts;
}

/** The note as shown in a list: trimmed and cut at a word boundary with an ellipsis when long. */
export function shortNote(note: string | null | undefined, max = 60): string | null {
  const text = note?.trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// ---- What a creator may do -------------------------------------------------------------------------------------------

/** Details can be edited in a Draft, while uploading or processing before submitting, and in Changes requested. */
export function canEditDetails(video: VideoFacts): boolean {
  if (video.deletedAt) return false;
  if (video.status === "DRAFT" || video.status === "CHANGES_REQUESTED") return true;
  return (video.status === "UPLOADING" || video.status === "PROCESSING") && !video.submittedAt;
}

/** A new version only exists for a video in Changes requested. */
export function canUploadNewVersion(video: VideoFacts): boolean {
  return !video.deletedAt && video.status === "CHANGES_REQUESTED";
}

/** Deleting is for drafts: a Draft, a video ready to submit, and a first upload that didn't finish. */
export function canDelete(video: VideoFacts, now: Date): boolean {
  if (video.deletedAt) return false;
  const { key } = displayStatus(video, now);
  return key === "draft" || key === "ready-to-submit" || key === "upload-unfinished";
}

// ---- Submitting ------------------------------------------------------------------------------------------------------

export type Details = {
  title?: string | null;
  description?: string | null;
  proposedStage?: string | null;
  topic?: string | null;
  languageCode?: string | null;
};

export type ProblemField = "title" | "description" | "proposedStage" | "topic" | "languageCode" | "checklist" | "host" | "upload";
export type Problem = { field: ProblemField; message: string };

export type SubmitContext = {
  /** One boolean per checklist item, in order. */
  checklist: readonly boolean[];
  hostComplete: boolean;
  /** An upload was started for this video (a first upload, or a pending new version). */
  uploadStarted: boolean;
  /** A video in Changes requested already has a ready file, so details alone may be resubmitted. */
  hasReadyFile: boolean;
};

/** Everything missing before a video can be submitted, each in kind words. Empty means it can go. */
export function submitProblems(details: Details, context: SubmitContext): Problem[] {
  const problems: Problem[] = [];
  const title = details.title?.trim() ?? "";
  if (title.length === 0) problems.push({ field: "title", message: "Give your video a title." });
  else if (title.length > TITLE_MAX) problems.push({ field: "title", message: `Keep the title to ${TITLE_MAX} characters.` });
  const description = details.description?.trim() ?? "";
  if (description.length === 0) problems.push({ field: "description", message: "Add a short description for learners." });
  else if (description.length > DESCRIPTION_MAX) {
    problems.push({ field: "description", message: `Keep the description to ${DESCRIPTION_MAX} characters.` });
  }
  if (!details.proposedStage || !(stageSlugs as readonly string[]).includes(details.proposedStage)) {
    problems.push({ field: "proposedStage", message: "Choose the stage this video is for." });
  }
  if (!details.topic || !(topicSlugs as readonly string[]).includes(details.topic)) {
    problems.push({ field: "topic", message: "Choose a topic." });
  }
  const language = details.languageCode ? getLanguageByCode(details.languageCode) : undefined;
  if (!language || !isAvailable(language)) problems.push({ field: "languageCode", message: "Choose a language that is open to learners." });
  if (context.checklist.length !== CHECKLIST_ITEMS.length || !context.checklist.every(Boolean)) {
    problems.push({ field: "checklist", message: "Please tick every item in the list before you submit." });
  }
  if (!context.hostComplete) {
    problems.push({ field: "host", message: "Finish your host page first: a photo, your name in both scripts and a short story." });
  }
  if (!context.uploadStarted && !context.hasReadyFile) problems.push({ field: "upload", message: "Add your video file first." });
  return problems;
}
