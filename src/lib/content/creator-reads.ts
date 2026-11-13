import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/roles/actor";
import { ForbiddenError } from "@/lib/roles/forbidden";
import type { VideoStatusName } from "./status";

// What creators and owners may read about videos, whatever their status. Every function takes the acting user and builds
// its query from it: a creator's query always carries their own id, and no function takes a user id or a status to read
// "someone else's" data. Learners get nothing from here. (The learner site reads through index.ts, Approved only.)
// Soft-deleted videos are in none of these reads. Mux ids never leave this module: the browser only learns that a file exists.

/** The `where` for videos this actor may see: a creator's own, all of them for an owner, never a deleted one. A learner may see none. */
function visibleVideos(actor: Actor): Prisma.VideoWhereInput {
  if (actor.role === "owner") return { deletedAt: null };
  if (actor.role === "creator") return { host: { userId: actor.id }, deletedAt: null };
  throw new ForbiddenError();
}

export type CreatorVideo = {
  id: string;
  languageCode: string;
  slug: string;
  title: string;
  /** The final stage, set by the owner in review. Null until then. */
  stage: string | null;
  /** The stage the creator proposed. */
  proposedStage: string | null;
  topic: string | null;
  description: string | null;
  access: "FREE" | "FULL";
  status: VideoStatusName;
  durationSeconds: number | null;
  hostSlug: string;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  assetReadyAt: Date | null;
  uploadStartedAt: Date | null;
  /** Whether the current file has an asset at the video host, and whether a signed playback id exists. */
  hasAsset: boolean;
  hasPlayback: boolean;
  hasPendingUpload: boolean;
  hasPendingAsset: boolean;
  pendingReadyAt: Date | null;
  pendingStartedAt: Date | null;
  pendingFailure: string | null;
  /** The note of the video's newest history entry, or null when that entry has none. */
  latestNote: string | null;
};

const videoSelect = {
  id: true,
  languageCode: true,
  slug: true,
  title: true,
  stage: true,
  proposedStage: true,
  topic: true,
  description: true,
  access: true,
  status: true,
  durationSeconds: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  assetReadyAt: true,
  uploadStartedAt: true,
  muxAssetId: true,
  playbackId: true,
  pendingUploadId: true,
  pendingAssetId: true,
  pendingReadyAt: true,
  pendingStartedAt: true,
  pendingFailure: true,
  host: { select: { slug: true } },
  // One query for every row's latest note: the newest history entry only.
  events: { orderBy: { createdAt: "desc" }, take: 1, select: { note: true } },
} satisfies Prisma.VideoSelect;

type VideoRow = Prisma.VideoGetPayload<{ select: typeof videoSelect }>;

// Built field by field (not spread) so nothing else on a row, such as a Mux id, can ever slip into what the browser gets.
const toCreatorVideo = (row: VideoRow): CreatorVideo => ({
  id: row.id,
  languageCode: row.languageCode,
  slug: row.slug,
  title: row.title,
  stage: row.stage,
  proposedStage: row.proposedStage,
  topic: row.topic,
  description: row.description,
  access: row.access,
  status: row.status as VideoStatusName,
  durationSeconds: row.durationSeconds,
  hostSlug: row.host.slug,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  submittedAt: row.submittedAt,
  assetReadyAt: row.assetReadyAt,
  uploadStartedAt: row.uploadStartedAt,
  hasAsset: row.muxAssetId !== null,
  hasPlayback: row.playbackId !== null,
  hasPendingUpload: row.pendingUploadId !== null,
  hasPendingAsset: row.pendingAssetId !== null,
  pendingReadyAt: row.pendingReadyAt,
  pendingStartedAt: row.pendingStartedAt,
  pendingFailure: row.pendingFailure,
  latestNote: row.events[0]?.note?.trim() || null,
});

/** A creator's own videos in any status (an owner sees all of them), most recently updated first. */
export async function listOwnVideos(actor: Actor): Promise<CreatorVideo[]> {
  const rows = await db().video.findMany({ where: visibleVideos(actor), select: videoSelect, orderBy: { updatedAt: "desc" } });
  return rows.map(toCreatorVideo).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/** One video this actor may see, or null. Another creator's video looks exactly like one that does not exist. */
export async function getOwnVideo(actor: Actor, videoId: string): Promise<CreatorVideo | null> {
  const row = await db().video.findFirst({ where: { id: videoId, ...visibleVideos(actor) }, select: videoSelect });
  return row ? toCreatorVideo(row) : null;
}

export type StatusHistoryEntry = {
  fromStatus: VideoStatusName | null;
  toStatus: VideoStatusName;
  actorLabel: string;
  /** Whether the person asking made this change themselves (shown as "You"); the id itself is never handed out. */
  byYou: boolean;
  note: string | null;
  createdAt: Date;
};

/** The history of a video this actor may see, oldest first, or null when they may not see the video. */
export async function listStatusHistory(actor: Actor, videoId: string): Promise<StatusHistoryEntry[] | null> {
  const scope = visibleVideos(actor);
  const events = await db().videoStatusEvent.findMany({
    where: { videoId, video: scope },
    orderBy: { createdAt: "asc" },
    select: { fromStatus: true, toStatus: true, actorId: true, actorLabel: true, note: true, createdAt: true },
  });
  if (events.length > 0) {
    return events.map(({ actorId, ...event }) => ({ ...event, fromStatus: event.fromStatus as VideoStatusName | null, toStatus: event.toStatus as VideoStatusName, byYou: actorId === actor.id }));
  }
  // No events can mean "no such video" or "a video with no history"; only say the second to someone who may see the video.
  return (await getOwnVideo(actor, videoId)) ? [] : null;
}

/** What the status page needs to show the creator a preview of their own video: the signed playback id of its current file. */
export async function getOwnPlayback(
  actor: Actor,
  videoId: string,
): Promise<{ playbackId: string; access: "FREE" | "FULL"; durationSeconds: number | null } | null> {
  const row = await db().video.findFirst({
    where: { id: videoId, ...visibleVideos(actor) },
    select: { playbackId: true, access: true, durationSeconds: true },
  });
  return row?.playbackId ? { playbackId: row.playbackId, access: row.access, durationSeconds: row.durationSeconds } : null;
}

/** Every video, whatever its creator or status. Owners only. */
export async function listAllVideos(actor: Actor): Promise<CreatorVideo[]> {
  if (actor.role !== "owner") throw new ForbiddenError();
  return listOwnVideos(actor);
}

export type CreatorProfile = {
  slug: string;
  languageCode: string;
  name: string;
  nameArabic: string | null;
  story: string;
  topics: string[];
  photo: string | null;
  /** A photo, both names and a story: what submitting a video needs. */
  complete: boolean;
};

/** Whether a host page has what a video needs before it can be submitted. */
export const isHostComplete = (host: { name: string; nameArabic: string | null; story: string; photo: string | null }): boolean =>
  Boolean(host.photo && host.name.trim() && host.nameArabic?.trim() && host.story.trim());

/** The creator's own profile (their public host page). Owners have none; learners may not ask. */
export async function getOwnProfile(actor: Actor): Promise<CreatorProfile | null> {
  if (actor.role === "owner") return null;
  if (actor.role !== "creator") throw new ForbiddenError();
  const row = await db().host.findFirst({
    where: { userId: actor.id },
    select: { slug: true, languageCode: true, name: true, nameArabic: true, story: true, topics: true, photo: true },
  });
  return row ? { ...row, complete: isHostComplete(row) } : null;
}
