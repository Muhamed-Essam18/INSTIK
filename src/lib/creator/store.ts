import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { VideoStatusName } from "@/lib/content/status";
import { isHostComplete } from "@/lib/content/creator-reads";
import type { HostStore } from "./host-service";
import { draftSlug } from "./slug";
import type { DetailsInput, HostRecord, UploadStore, VideoRecord } from "./upload-service";

// The Prisma side of uploading (spec 9). Every query is scoped to the acting creator's own host page and leaves out deleted videos,
// so another creator's video looks exactly like a missing one. Nothing here decides anything; the rules are in upload-service.ts.

const videoSelect = {
  id: true,
  hostId: true,
  languageCode: true,
  slug: true,
  title: true,
  description: true,
  proposedStage: true,
  topic: true,
  status: true,
  submittedAt: true,
  assetReadyAt: true,
  uploadStartedAt: true,
  muxUploadId: true,
  muxAssetId: true,
  pendingUploadId: true,
  pendingAssetId: true,
  pendingReadyAt: true,
  pendingStartedAt: true,
} as const;

const toRecord = (row: { status: string } & Omit<VideoRecord, "status">): VideoRecord => ({ ...row, status: row.status as VideoStatusName });

const clearedPending = {
  pendingUploadId: null,
  pendingAssetId: null,
  pendingPlaybackId: null,
  pendingDurationSeconds: null,
  pendingReadyAt: null,
  pendingStartedAt: null,
} as const;

/** Makes a ready pending file the current one, in one transaction. Shared with the webhook store. */
export async function swapPendingFile(videoId: string): Promise<{ previousAssetId: string | null } | "none"> {
  return db().$transaction(async (tx) => {
    const video = await tx.video.findUnique({
      where: { id: videoId },
      select: { muxAssetId: true, pendingUploadId: true, pendingAssetId: true, pendingPlaybackId: true, pendingDurationSeconds: true, pendingReadyAt: true },
    });
    if (!video?.pendingReadyAt || !video.pendingAssetId) return "none";
    await tx.video.update({
      where: { id: videoId },
      data: {
        muxUploadId: video.pendingUploadId,
        muxAssetId: video.pendingAssetId,
        playbackId: video.pendingPlaybackId,
        durationSeconds: video.pendingDurationSeconds,
        assetReadyAt: video.pendingReadyAt,
        pendingFailure: null,
        ...clearedPending,
      },
    });
    return { previousAssetId: video.muxAssetId };
  });
}

export const prismaUploadStore: UploadStore = {
  async getHost(actorId): Promise<HostRecord | null> {
    const host = await db().host.findFirst({
      where: { userId: actorId },
      select: { id: true, languageCode: true, name: true, nameArabic: true, story: true, photo: true },
    });
    return host ? { id: host.id, languageCode: host.languageCode, complete: isHostComplete(host) } : null;
  },

  async getVideo(actorId, videoId) {
    const row = await db().video.findFirst({ where: { id: videoId, deletedAt: null, host: { userId: actorId } }, select: videoSelect });
    return row ? toRecord(row) : null;
  },

  async createDraft(host, details) {
    const id = randomUUID();
    const row = await db().video.create({
      data: {
        id,
        languageCode: host.languageCode,
        slug: draftSlug(id),
        hostId: host.id,
        title: details.title?.trim() ?? "",
        description: details.description?.trim() || null,
        proposedStage: details.proposedStage || null,
        topic: details.topic || null,
        status: "DRAFT",
      },
      select: videoSelect,
    });
    return toRecord(row);
  },

  async saveDetails(videoId, details: DetailsInput) {
    await db().video.update({
      where: { id: videoId },
      data: {
        ...(details.title !== undefined ? { title: details.title?.trim() ?? "" } : {}),
        ...(details.description !== undefined ? { description: details.description?.trim() || null } : {}),
        ...(details.proposedStage !== undefined ? { proposedStage: details.proposedStage || null } : {}),
        ...(details.topic !== undefined ? { topic: details.topic || null } : {}),
      },
    });
  },

  async setFirstUpload(videoId, upload) {
    await db().video.update({
      where: { id: videoId },
      data: {
        muxUploadId: upload.uploadId,
        uploadStartedAt: upload.startedAt,
        muxAssetId: null,
        playbackId: null,
        durationSeconds: null,
        assetReadyAt: null,
        submittedAt: null,
      },
    });
  },

  async setPendingUpload(videoId, upload) {
    await db().video.update({
      where: { id: videoId },
      data: { ...clearedPending, pendingUploadId: upload.uploadId, pendingStartedAt: upload.startedAt, pendingFailure: null, submittedAt: null },
    });
  },

  async clearPending(videoId) {
    return db().$transaction(async (tx) => {
      const video = await tx.video.findUnique({ where: { id: videoId }, select: { pendingAssetId: true } });
      await tx.video.update({ where: { id: videoId }, data: clearedPending });
      return video?.pendingAssetId ?? null;
    });
  },

  async slugTaken(languageCode, slug, exceptVideoId) {
    const found = await db().video.findFirst({ where: { languageCode, slug, NOT: { id: exceptVideoId } }, select: { id: true } });
    return found !== null;
  },

  async setSlug(videoId, slug) {
    await db().video.update({ where: { id: videoId }, data: { slug } });
  },

  async markSubmitted(videoId, at) {
    await db().video.update({ where: { id: videoId }, data: { submittedAt: at, checklistAcceptedAt: at } });
  },

  async clearSubmitted(videoId) {
    await db().video.update({ where: { id: videoId }, data: { submittedAt: null } });
  },

  swapPending: swapPendingFile,

  async softDelete(videoId, at) {
    return db().$transaction(async (tx) => {
      const video = await tx.video.findUnique({ where: { id: videoId }, select: { muxAssetId: true, pendingAssetId: true } });
      // The slug goes back to the placeholder so one assigned at an earlier submit is free for a new video. History is kept.
      await tx.video.update({ where: { id: videoId }, data: { deletedAt: at, slug: draftSlug(videoId) } });
      return { assetIds: [video?.muxAssetId, video?.pendingAssetId].filter((id): id is string => Boolean(id)) };
    });
  },
};

/** The Prisma side of host page edits: only the acting creator's own host row is ever read or changed. */
export const prismaHostStore: HostStore = {
  async getOwnHost(actorId) {
    return db().host.findFirst({ where: { userId: actorId }, select: { id: true, photo: true } });
  },
  async saveHost(hostId, value) {
    // The address (slug) never changes: a name change must not break links to the page.
    await db().host.update({
      where: { id: hostId },
      data: { name: value.name, nameArabic: value.nameArabic, story: value.story, topics: value.topics },
    });
  },
  async setPhoto(hostId, url) {
    await db().host.update({ where: { id: hostId }, data: { photo: url } });
  },
};
