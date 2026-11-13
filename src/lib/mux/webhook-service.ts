import type { StatusActor, ChangeResult } from "@/lib/content/status-service";
import { TOO_LONG_NOTE, type VideoStatusName } from "@/lib/content/status";
import type { Actor } from "@/lib/roles/actor";
import { planFor, type MuxEvent, type Plan, type Target, type VideoFiles } from "./events";

// What a verified Mux notice does to a video (contracts/mux-webhook.md). The database (`WebhookStore`), the video host and the status
// service are passed in, so the whole thing is tested with an in-memory store. Every write is conditional on the video's current state
// and every status move goes through the status service, so a repeated or out-of-order notice changes nothing twice.

/** A plan that does something (every one but "ignore" names the file it is about). */
type Acting = Exclude<Plan, { do: "ignore" }>;

export const NEW_VERSION_FAILED_MESSAGE = "The new version didn't work. Please try again.";

export type WebhookVideo = VideoFiles & {
  id: string;
  status: VideoStatusName;
  submittedAt: Date | null;
  assetReadyAt: Date | null;
  pendingReadyAt: Date | null;
  /** The video's creator (the host page's user), for the moves that are theirs. Null for a host with no account. */
  creator: { id: string; email: string; name: string | null } | null;
};

export interface WebhookStore {
  findByUploadId(uploadId: string): Promise<WebhookVideo | null>;
  findByAssetId(assetId: string): Promise<WebhookVideo | null>;
  storeAsset(videoId: string, target: Target, assetId: string): Promise<void>;
  /** Records a ready file. For the current file this is a no-op when it was already recorded. */
  markReady(videoId: string, target: Target, ready: { assetId: string; durationSeconds: number; playbackId: string | null; at: Date }): Promise<void>;
  /** Forgets the pending file, records why, forgets the submission, and returns the pending asset (to delete). */
  failPending(videoId: string, message: string): Promise<string | null>;
  /** Makes the ready pending file the current one; returns the previous current asset, or "none" when there was nothing ready to swap. */
  swapPending(videoId: string): Promise<{ previousAssetId: string | null } | "none">;
  clearSubmitted(videoId: string): Promise<void>;
}

export interface WebhookHost {
  deleteAsset(assetId: string): Promise<void>;
}

export type Deps = {
  store: WebhookStore;
  host: WebhookHost | null;
  changeStatus: (input: { videoId: string; to: VideoStatusName; actor: StatusActor; note?: string | null }) => Promise<ChangeResult>;
  now?: () => Date;
};

const system: StatusActor = { kind: "system", label: "Instik" };

export function createWebhookService(deps: Deps) {
  const now = () => (deps.now ? deps.now() : new Date());

  const deleteAssetQuietly = async (assetId: string | null | undefined) => {
    if (!assetId || !deps.host) return;
    try {
      await deps.host.deleteAsset(assetId);
    } catch {
      console.error("[mux] could not delete an asset", { asset: assetId });
    }
  };

  const creatorOf = (video: WebhookVideo): Actor | null =>
    video.creator ? { id: video.creator.id, email: video.creator.email, name: video.creator.name, role: "creator" } : null;

  async function find(event: MuxEvent): Promise<WebhookVideo | null> {
    if ("uploadId" in event && event.uploadId) {
      const byUpload = await deps.store.findByUploadId(event.uploadId);
      if (byUpload) return byUpload;
    }
    return "assetId" in event ? deps.store.findByAssetId(event.assetId) : null;
  }

  /** Both the file and the submission are in: the video goes to review as its creator's submission. */
  async function completeSubmission(video: WebhookVideo, swap: boolean): Promise<void> {
    const creator = creatorOf(video);
    if (!creator) return;
    let previous: string | null = null;
    if (swap) {
      const swapped = await deps.store.swapPending(video.id);
      if (swapped === "none") return;
      previous = swapped.previousAssetId;
    }
    const moved = await deps.changeStatus({ videoId: video.id, to: "IN_REVIEW", actor: creator });
    if (moved.ok) await deps.store.clearSubmitted(video.id);
    await deleteAssetQuietly(previous);
  }

  async function applyCurrent(video: WebhookVideo, plan: Acting): Promise<void> {
    const inFlight = video.status === "UPLOADING" || video.status === "PROCESSING";
    if (plan.do === "store-asset") {
      await deps.store.storeAsset(video.id, "current", plan.assetId);
      if (video.status === "UPLOADING") await deps.changeStatus({ videoId: video.id, to: "PROCESSING", actor: system });
      return;
    }
    if (!inFlight) {
      // A file that is no longer waited on (the video was sent back to Draft, or has moved on). A too-long or errored file is still cleaned up.
      if (plan.do === "too-long") await deleteAssetQuietly(plan.assetId);
      return;
    }
    if (plan.do === "failed") {
      await deps.changeStatus({ videoId: video.id, to: "DRAFT", actor: system });
      return;
    }
    if (plan.do === "too-long") {
      await deps.changeStatus({ videoId: video.id, to: "DRAFT", actor: system, note: TOO_LONG_NOTE });
      await deleteAssetQuietly(plan.assetId);
      return;
    }
    // Ready. A notice that beat the "asset created" one is still welcome: the file is simply processing from now on.
    if (plan.do !== "ready") return;
    await deps.store.markReady(video.id, "current", { assetId: plan.assetId, durationSeconds: plan.durationSeconds, playbackId: plan.playbackId, at: now() });
    if (video.status === "UPLOADING") await deps.changeStatus({ videoId: video.id, to: "PROCESSING", actor: system });
    if (video.submittedAt) await completeSubmission(video, false);
  }

  async function applyPending(video: WebhookVideo, plan: Acting): Promise<void> {
    if (plan.do === "store-asset") {
      if (video.status === "CHANGES_REQUESTED") await deps.store.storeAsset(video.id, "pending", plan.assetId);
      return;
    }
    if (video.status !== "CHANGES_REQUESTED") {
      if (plan.do === "too-long") await deleteAssetQuietly(plan.assetId);
      return;
    }
    if (plan.do === "failed" || plan.do === "too-long") {
      const message = plan.do === "too-long" ? TOO_LONG_NOTE : NEW_VERSION_FAILED_MESSAGE;
      const pendingAsset = await deps.store.failPending(video.id, message);
      await deleteAssetQuietly(plan.do === "too-long" ? plan.assetId : pendingAsset);
      return;
    }
    if (plan.do !== "ready") return;
    await deps.store.markReady(video.id, "pending", { assetId: plan.assetId, durationSeconds: plan.durationSeconds, playbackId: plan.playbackId, at: now() });
    if (video.submittedAt) await completeSubmission(video, true);
  }

  /** Applies one verified notice. "ignored" means it was about nothing we know, or nothing was left to do. */
  async function handle(event: MuxEvent): Promise<"applied" | "ignored"> {
    const video = await find(event);
    if (!video) return "ignored";
    const plan = planFor(event, video);
    if (plan.do === "ignore") return "ignored";
    if (plan.target === "current") await applyCurrent(video, plan);
    else await applyPending(video, plan);
    return "applied";
  }

  return { handle };
}
