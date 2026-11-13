import "server-only";
import { db } from "@/lib/db";
import type { VideoStatusName } from "@/lib/content/status";
import { swapPendingFile } from "@/lib/creator/store";
import type { WebhookStore, WebhookVideo } from "./webhook-service";

// The Prisma side of the Mux webhook (spec 9). Every write is conditional on what is already stored, so a repeated notice writes
// nothing new. Deleted videos are never found.

const select = {
  id: true,
  status: true,
  submittedAt: true,
  assetReadyAt: true,
  pendingReadyAt: true,
  muxUploadId: true,
  muxAssetId: true,
  pendingUploadId: true,
  pendingAssetId: true,
  host: { select: { user: { select: { id: true, email: true, name: true } } } },
} as const;

type Row = Awaited<ReturnType<typeof read>>;
const read = (where: object) => db().video.findFirst({ where: { deletedAt: null, ...where }, select });

const toVideo = (row: NonNullable<Row>): WebhookVideo => ({
  id: row.id,
  status: row.status as VideoStatusName,
  submittedAt: row.submittedAt,
  assetReadyAt: row.assetReadyAt,
  pendingReadyAt: row.pendingReadyAt,
  muxUploadId: row.muxUploadId,
  muxAssetId: row.muxAssetId,
  pendingUploadId: row.pendingUploadId,
  pendingAssetId: row.pendingAssetId,
  creator: row.host.user,
});

export const prismaWebhookStore: WebhookStore = {
  async findByUploadId(uploadId) {
    const row = await read({ OR: [{ muxUploadId: uploadId }, { pendingUploadId: uploadId }] });
    return row ? toVideo(row) : null;
  },

  async findByAssetId(assetId) {
    const row = await read({ OR: [{ muxAssetId: assetId }, { pendingAssetId: assetId }] });
    return row ? toVideo(row) : null;
  },

  async storeAsset(videoId, target, assetId) {
    if (target === "current") {
      await db().video.updateMany({ where: { id: videoId, OR: [{ muxAssetId: null }, { muxAssetId: assetId }] }, data: { muxAssetId: assetId } });
    } else {
      await db().video.updateMany({ where: { id: videoId, OR: [{ pendingAssetId: null }, { pendingAssetId: assetId }] }, data: { pendingAssetId: assetId } });
    }
  },

  async markReady(videoId, target, ready) {
    if (target === "current") {
      // Only the first ready notice writes; a repeat finds assetReadyAt already set.
      await db().video.updateMany({
        where: { id: videoId, assetReadyAt: null, OR: [{ muxAssetId: null }, { muxAssetId: ready.assetId }] },
        data: { muxAssetId: ready.assetId, assetReadyAt: ready.at, durationSeconds: ready.durationSeconds, playbackId: ready.playbackId },
      });
    } else {
      await db().video.updateMany({
        where: { id: videoId, pendingReadyAt: null, pendingUploadId: { not: null }, OR: [{ pendingAssetId: null }, { pendingAssetId: ready.assetId }] },
        data: { pendingAssetId: ready.assetId, pendingReadyAt: ready.at, pendingDurationSeconds: ready.durationSeconds, pendingPlaybackId: ready.playbackId },
      });
    }
  },

  async failPending(videoId, message) {
    return db().$transaction(async (tx) => {
      const video = await tx.video.findUnique({ where: { id: videoId }, select: { pendingAssetId: true } });
      await tx.video.update({
        where: { id: videoId },
        data: {
          pendingUploadId: null,
          pendingAssetId: null,
          pendingPlaybackId: null,
          pendingDurationSeconds: null,
          pendingReadyAt: null,
          pendingStartedAt: null,
          pendingFailure: message.slice(0, 200),
          submittedAt: null,
        },
      });
      return video?.pendingAssetId ?? null;
    });
  },

  swapPending: swapPendingFile,

  async clearSubmitted(videoId) {
    await db().video.update({ where: { id: videoId }, data: { submittedAt: null } });
  },
};
