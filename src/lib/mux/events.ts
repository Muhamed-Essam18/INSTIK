import { z } from "zod";
import { MAX_DURATION_SECONDS } from "@/lib/creator/limits";

// The Mux notices we act on (contracts/mux-webhook.md). `parseMuxEvent` reads only the fields we use, with zod, from an event whose
// signature has already been verified; `planFor` decides, with no database, what a notice means for one video. Pure.

const assetData = z.object({
  id: z.string().min(1),
  upload_id: z.string().min(1).optional(),
  duration: z.number().nonnegative().optional(),
  playback_ids: z.array(z.object({ id: z.string().min(1), policy: z.string() })).optional(),
});

const uploadAssetCreatedData = z.object({ id: z.string().min(1), asset_id: z.string().min(1).optional() });
const uploadEndedData = z.object({ id: z.string().min(1) });

export type MuxEvent =
  | { kind: "upload-asset-created"; uploadId: string; assetId: string }
  | { kind: "asset-ready"; assetId: string; uploadId?: string; durationSeconds: number; playbackId: string | null }
  | { kind: "asset-errored"; assetId: string; uploadId?: string }
  | { kind: "upload-ended"; uploadId: string };

/** Reads a verified event. Null means "not one we act on" (an unknown type, or fields we cannot read): answer 200 and do nothing. */
export function parseMuxEvent(raw: unknown): MuxEvent | null {
  const envelope = z.object({ type: z.string(), data: z.unknown() }).safeParse(raw);
  if (!envelope.success) return null;
  const { type, data } = envelope.data;
  switch (type) {
    case "video.upload.asset_created": {
      const parsed = uploadAssetCreatedData.safeParse(data);
      return parsed.success && parsed.data.asset_id ? { kind: "upload-asset-created", uploadId: parsed.data.id, assetId: parsed.data.asset_id } : null;
    }
    case "video.asset.created": {
      const parsed = assetData.safeParse(data);
      return parsed.success && parsed.data.upload_id
        ? { kind: "upload-asset-created", uploadId: parsed.data.upload_id, assetId: parsed.data.id }
        : null;
    }
    case "video.asset.ready": {
      const parsed = assetData.safeParse(data);
      if (!parsed.success) return null;
      const signed = parsed.data.playback_ids?.find((p) => p.policy === "signed");
      return {
        kind: "asset-ready",
        assetId: parsed.data.id,
        ...(parsed.data.upload_id ? { uploadId: parsed.data.upload_id } : {}),
        durationSeconds: parsed.data.duration ?? 0,
        playbackId: signed?.id ?? null,
      };
    }
    case "video.asset.errored": {
      const parsed = assetData.safeParse(data);
      return parsed.success
        ? { kind: "asset-errored", assetId: parsed.data.id, ...(parsed.data.upload_id ? { uploadId: parsed.data.upload_id } : {}) }
        : null;
    }
    case "video.upload.errored":
    case "video.upload.cancelled": {
      const parsed = uploadEndedData.safeParse(data);
      return parsed.success ? { kind: "upload-ended", uploadId: parsed.data.id } : null;
    }
    default:
      return null;
  }
}

/** The video's files as the webhook sees them. */
export type VideoFiles = {
  muxUploadId: string | null;
  muxAssetId: string | null;
  pendingUploadId: string | null;
  pendingAssetId: string | null;
};

/** Which of the video's two files a notice is about: the current one, or a new version waiting in Changes requested. */
export type Target = "current" | "pending";

export type Plan =
  | { do: "ignore" }
  | { do: "store-asset"; target: Target; assetId: string }
  | { do: "ready"; target: Target; assetId: string; durationSeconds: number; playbackId: string | null }
  | { do: "too-long"; target: Target; assetId: string }
  | { do: "failed"; target: Target };

/** The upload id decides first (it never changes); the asset id is the fallback. */
function targetOf(video: VideoFiles, ids: { uploadId?: string; assetId?: string }): Target | null {
  if (ids.uploadId) {
    if (ids.uploadId === video.muxUploadId) return "current";
    if (ids.uploadId === video.pendingUploadId) return "pending";
  }
  if (ids.assetId) {
    if (ids.assetId === video.muxAssetId) return "current";
    if (ids.assetId === video.pendingAssetId) return "pending";
  }
  return null;
}

/** What a notice means for a video. A notice about a file that is no longer the video's current or pending file means nothing. */
export function planFor(event: MuxEvent, video: VideoFiles): Plan {
  const assetOf = (t: Target) => (t === "current" ? video.muxAssetId : video.pendingAssetId);
  switch (event.kind) {
    case "upload-asset-created": {
      const target = targetOf(video, { uploadId: event.uploadId });
      if (!target) return { do: "ignore" };
      const known = assetOf(target);
      return known && known !== event.assetId ? { do: "ignore" } : { do: "store-asset", target, assetId: event.assetId };
    }
    case "asset-ready": {
      const target = targetOf(video, { uploadId: event.uploadId, assetId: event.assetId });
      if (!target) return { do: "ignore" };
      const known = assetOf(target);
      if (known && known !== event.assetId) return { do: "ignore" };
      if (event.durationSeconds > MAX_DURATION_SECONDS) return { do: "too-long", target, assetId: event.assetId };
      return {
        do: "ready",
        target,
        assetId: event.assetId,
        durationSeconds: Math.max(1, Math.ceil(event.durationSeconds)),
        playbackId: event.playbackId,
      };
    }
    case "asset-errored": {
      const target = targetOf(video, { uploadId: event.uploadId, assetId: event.assetId });
      if (!target) return { do: "ignore" };
      const known = assetOf(target);
      return known && known !== event.assetId ? { do: "ignore" } : { do: "failed", target };
    }
    case "upload-ended": {
      const target = targetOf(video, { uploadId: event.uploadId });
      return target ? { do: "failed", target } : { do: "ignore" };
    }
  }
}
