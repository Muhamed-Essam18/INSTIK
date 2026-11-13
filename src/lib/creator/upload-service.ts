import { canUpload } from "./can-upload";
import { displayStatus, submitProblems, type Details, type Problem } from "./rules";
import { isDraftSlug, slugify, uniqueSlug } from "./slug";
import type { Actor } from "@/lib/roles/actor";
import type { ChangeResult, StatusActor } from "@/lib/content/status-service";
import type { VideoStatusName } from "@/lib/content/status";

// The creator's side of uploading (spec 9): starting an upload, saving a draft, submitting, and deleting a draft. All the rules
// are here; the database (`UploadStore`), the video host (`UploadHost`) and the status service are passed in, so it is tested
// without any of them. Every function checks `canUpload` first and works only on the acting creator's own, non-deleted videos.

export type VideoRecord = {
  id: string;
  hostId: string;
  languageCode: string;
  slug: string;
  title: string;
  description: string | null;
  proposedStage: string | null;
  topic: string | null;
  status: VideoStatusName;
  submittedAt: Date | null;
  assetReadyAt: Date | null;
  uploadStartedAt: Date | null;
  muxUploadId: string | null;
  muxAssetId: string | null;
  pendingUploadId: string | null;
  pendingAssetId: string | null;
  pendingReadyAt: Date | null;
  pendingStartedAt: Date | null;
};

export type HostRecord = { id: string; languageCode: string; complete: boolean };

export type DetailsInput = {
  title?: string | null;
  description?: string | null;
  proposedStage?: string | null;
  topic?: string | null;
};

export interface UploadStore {
  /** The acting creator's own host page, or null. */
  getHost(actorId: string): Promise<HostRecord | null>;
  /** The creator's own video that is not deleted, or null (another creator's looks exactly like a missing one). */
  getVideo(actorId: string, videoId: string): Promise<VideoRecord | null>;
  createDraft(host: HostRecord, details: DetailsInput): Promise<VideoRecord>;
  saveDetails(videoId: string, details: DetailsInput): Promise<void>;
  /** A new first upload: remembers the upload, the start time, and forgets any earlier file and submission. */
  setFirstUpload(videoId: string, upload: { uploadId: string; startedAt: Date }): Promise<void>;
  /** A new version while in Changes requested: remembers it as the pending file and clears the earlier failure. */
  setPendingUpload(videoId: string, upload: { uploadId: string; startedAt: Date }): Promise<void>;
  /** Forgets the pending file (it is being replaced). Returns the asset it had, if any, so it can be deleted. */
  clearPending(videoId: string): Promise<string | null>;
  slugTaken(languageCode: string, slug: string, exceptVideoId: string): Promise<boolean>;
  setSlug(videoId: string, slug: string): Promise<void>;
  markSubmitted(videoId: string, at: Date): Promise<void>;
  clearSubmitted(videoId: string): Promise<void>;
  /** Makes the ready pending file the current one. Returns the previous current asset (to delete), or "none" when there was no ready pending file. */
  swapPending(videoId: string): Promise<{ previousAssetId: string | null } | "none">;
  /** Soft delete: sets `deletedAt`, resets the slug, and returns the Mux assets that were attached. */
  softDelete(videoId: string, at: Date): Promise<{ assetIds: string[] }>;
}

export interface UploadHost {
  createDirectUpload(input: { corsOrigin: string; videoId: string }): Promise<{ id: string; url: string }>;
  deleteAsset(assetId: string): Promise<void>;
}

export type ChangeStatus = (input: { videoId: string; to: VideoStatusName; actor: StatusActor; note?: string | null }) => Promise<ChangeResult>;

export type Deps = {
  store: UploadStore;
  /** Null when uploads are not set up (the Mux settings are missing). */
  host: UploadHost | null;
  changeStatus: ChangeStatus;
  siteOrigin: () => string;
  now?: () => Date;
};

export type Failure =
  | { ok: false; reason: "not-allowed" | "not-found" | "not-set-up" | "wrong-status" | "host-error" }
  | { ok: false; reason: "invalid"; problems: Problem[] };

export type UploadResult = { ok: true; videoId: string; uploadUrl: string } | Failure;
export type SubmitResult = { ok: true; videoId: string; completed: boolean } | Failure;

const system: StatusActor = { kind: "system", label: "Instik" };
const asCreator = (actor: Actor): StatusActor => actor;

export function createUploadService(deps: Deps) {
  const now = () => (deps.now ? deps.now() : new Date());

  const deleteAssetQuietly = async (assetId: string | null | undefined) => {
    if (!assetId || !deps.host) return;
    try {
      await deps.host.deleteAsset(assetId);
    } catch {
      console.error("[uploads] could not delete a video host asset", { asset: assetId });
    }
  };

  /** Whether a first upload has run past its link lifetime and grace period without an asset. */
  const expired = (video: VideoRecord): boolean =>
    displayStatus(
      { status: video.status, uploadStartedAt: video.uploadStartedAt, hasAsset: video.muxAssetId !== null },
      now(),
    ).key === "upload-unfinished";

  async function createUpload(
    actor: Actor | null,
    input: { videoId?: string; kind: "first" | "newVersion"; details?: DetailsInput },
  ): Promise<UploadResult> {
    if (!actor || !canUpload(actor)) return { ok: false, reason: "not-allowed" };
    if (!deps.host) return { ok: false, reason: "not-set-up" };
    const host = await deps.store.getHost(actor.id);
    if (!host) return { ok: false, reason: "not-allowed" };

    if (input.kind === "newVersion") {
      if (!input.videoId) return { ok: false, reason: "not-found" };
      const video = await deps.store.getVideo(actor.id, input.videoId);
      if (!video) return { ok: false, reason: "not-found" };
      if (video.status !== "CHANGES_REQUESTED") return { ok: false, reason: "wrong-status" };
      let upload;
      try {
        upload = await deps.host.createDirectUpload({ corsOrigin: deps.siteOrigin(), videoId: video.id });
      } catch {
        return { ok: false, reason: "host-error" };
      }
      // A new version replaces any new version already on the way; its asset is not needed any more.
      const replaced = await deps.store.clearPending(video.id);
      await deps.store.setPendingUpload(video.id, { uploadId: upload.id, startedAt: now() });
      await deleteAssetQuietly(replaced);
      return { ok: true, videoId: video.id, uploadUrl: upload.url };
    }

    // A first upload: start from a draft (made now if there is none), or from an upload that did not finish.
    let video = input.videoId ? await deps.store.getVideo(actor.id, input.videoId) : await deps.store.createDraft(host, input.details ?? {});
    if (!video) return { ok: false, reason: "not-found" };
    if (video.status === "UPLOADING" && expired(video)) {
      const reset = await deps.changeStatus({ videoId: video.id, to: "DRAFT", actor: system });
      if (!reset.ok) return { ok: false, reason: "wrong-status" };
      video = { ...video, status: "DRAFT" };
    }
    if (video.status !== "DRAFT") return { ok: false, reason: "wrong-status" };

    // Only one of two clicks wins this move; the loser goes no further and makes no upload.
    const started = await deps.changeStatus({ videoId: video.id, to: "UPLOADING", actor: asCreator(actor) });
    if (!started.ok) return { ok: false, reason: "wrong-status" };
    try {
      const upload = await deps.host.createDirectUpload({ corsOrigin: deps.siteOrigin(), videoId: video.id });
      await deps.store.setFirstUpload(video.id, { uploadId: upload.id, startedAt: now() });
      return { ok: true, videoId: video.id, uploadUrl: upload.url };
    } catch {
      // The host would not make a link: put the video back as it was, and say so.
      await deps.changeStatus({ videoId: video.id, to: "DRAFT", actor: system });
      return { ok: false, reason: "host-error" };
    }
  }

  async function saveDraft(actor: Actor | null, input: { videoId?: string; details: DetailsInput }): Promise<{ ok: true; videoId: string } | Failure> {
    if (!actor || !canUpload(actor)) return { ok: false, reason: "not-allowed" };
    const host = await deps.store.getHost(actor.id);
    if (!host) return { ok: false, reason: "not-allowed" };
    if (!input.videoId) {
      const created = await deps.store.createDraft(host, input.details);
      return { ok: true, videoId: created.id };
    }
    const video = await deps.store.getVideo(actor.id, input.videoId);
    if (!video) return { ok: false, reason: "not-found" };
    if (!(["DRAFT", "UPLOADING", "PROCESSING", "CHANGES_REQUESTED"] as VideoStatusName[]).includes(video.status) || (video.submittedAt && video.status !== "CHANGES_REQUESTED")) {
      return { ok: false, reason: "wrong-status" };
    }
    await deps.store.saveDetails(video.id, input.details);
    return { ok: true, videoId: video.id };
  }

  async function submitVideo(
    actor: Actor | null,
    input: { videoId: string; details: Details; checklist: readonly boolean[] },
  ): Promise<SubmitResult> {
    if (!actor || !canUpload(actor)) return { ok: false, reason: "not-allowed" };
    const host = await deps.store.getHost(actor.id);
    const video = await deps.store.getVideo(actor.id, input.videoId);
    if (!host || !video) return { ok: false, reason: video ? "not-allowed" : "not-found" };

    // Sent twice (a double click, or two tabs): the second one finds it already submitted and changes nothing.
    if (video.status === "IN_REVIEW") return { ok: true, videoId: video.id, completed: true };
    if (video.submittedAt && (video.status === "UPLOADING" || video.status === "PROCESSING" || video.status === "CHANGES_REQUESTED")) {
      return { ok: true, videoId: video.id, completed: false };
    }
    // A Draft has no file in flight, so it is told to add one below; REJECTED and APPROVED cannot be submitted at all.
    if (!(["DRAFT", "UPLOADING", "PROCESSING", "CHANGES_REQUESTED"] as VideoStatusName[]).includes(video.status)) {
      return { ok: false, reason: "wrong-status" };
    }

    const uploadStarted =
      (video.status === "UPLOADING" && !expired(video)) ||
      video.status === "PROCESSING" ||
      (video.status === "CHANGES_REQUESTED" && video.pendingUploadId !== null);
    const problems = submitProblems(
      { ...input.details, languageCode: host.languageCode },
      {
        checklist: input.checklist,
        hostComplete: host.complete,
        uploadStarted,
        hasReadyFile: video.status === "CHANGES_REQUESTED" && video.assetReadyAt !== null,
      },
    );
    if (problems.length > 0) return { ok: false, reason: "invalid", problems };

    await deps.store.saveDetails(video.id, {
      title: input.details.title?.trim(),
      description: input.details.description?.trim(),
      proposedStage: input.details.proposedStage,
      topic: input.details.topic,
    });
    if (isDraftSlug(video.slug)) {
      const slug = await uniqueSlug(slugify(input.details.title ?? ""), (s) => deps.store.slugTaken(video.languageCode, s, video.id));
      await deps.store.setSlug(video.id, slug);
    }
    await deps.store.markSubmitted(video.id, now());

    // Complete it now when the file is already ready; otherwise the notice that it is ready completes it.
    if (video.status === "PROCESSING" && video.assetReadyAt) {
      const moved = await deps.changeStatus({ videoId: video.id, to: "IN_REVIEW", actor: asCreator(actor) });
      if (moved.ok) await deps.store.clearSubmitted(video.id);
      return { ok: true, videoId: video.id, completed: moved.ok };
    }
    if (video.status === "CHANGES_REQUESTED") {
      if (video.pendingUploadId === null) {
        const moved = await deps.changeStatus({ videoId: video.id, to: "IN_REVIEW", actor: asCreator(actor) });
        if (moved.ok) await deps.store.clearSubmitted(video.id);
        return { ok: true, videoId: video.id, completed: moved.ok };
      }
      if (video.pendingReadyAt) {
        // The swap comes first: if the status move then loses a race, a retry sees a ready current file and no pending one.
        const swapped = await deps.store.swapPending(video.id);
        if (swapped === "none") return { ok: true, videoId: video.id, completed: false };
        const moved = await deps.changeStatus({ videoId: video.id, to: "IN_REVIEW", actor: asCreator(actor) });
        if (moved.ok) await deps.store.clearSubmitted(video.id);
        await deleteAssetQuietly(swapped.previousAssetId);
        return { ok: true, videoId: video.id, completed: moved.ok };
      }
    }
    return { ok: true, videoId: video.id, completed: false };
  }

  async function deleteDraft(actor: Actor | null, videoId: string): Promise<{ ok: true } | Failure> {
    if (!actor || !canUpload(actor)) return { ok: false, reason: "not-allowed" };
    const video = await deps.store.getVideo(actor.id, videoId);
    if (!video) return { ok: false, reason: "not-found" };
    const { key } = displayStatus(
      { status: video.status, submittedAt: video.submittedAt, assetReadyAt: video.assetReadyAt, uploadStartedAt: video.uploadStartedAt, hasAsset: video.muxAssetId !== null },
      now(),
    );
    if (key !== "draft" && key !== "ready-to-submit" && key !== "upload-unfinished") return { ok: false, reason: "wrong-status" };
    // The video is hidden (the row and its history stay), then its files at the video host are deleted.
    const { assetIds } = await deps.store.softDelete(video.id, now());
    for (const assetId of assetIds) await deleteAssetQuietly(assetId);
    return { ok: true };
  }

  return { createUpload, saveDraft, submitVideo, deleteDraft };
}

