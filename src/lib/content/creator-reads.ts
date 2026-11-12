import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/roles/actor";
import { ForbiddenError } from "@/lib/roles/forbidden";
import type { VideoStatusName } from "./status";

// What creators and owners may read about videos, whatever their status. Every function takes the acting user and builds
// its query from it: a creator's query always carries their own id, and no function takes a user id or a status to read
// "someone else's" data. Learners get nothing from here. (The learner site reads through index.ts, Approved only.)

/** The `where` for videos this actor may see: a creator's own, all of them for an owner. A learner may see none. */
function visibleVideos(actor: Actor): Prisma.VideoWhereInput {
  if (actor.role === "owner") return {};
  if (actor.role === "creator") return { host: { userId: actor.id } };
  throw new ForbiddenError();
}

export type CreatorVideo = {
  id: string;
  languageCode: string;
  slug: string;
  title: string;
  stage: string;
  topic: string;
  access: "FREE" | "FULL";
  status: VideoStatusName;
  durationSeconds: number;
  hostSlug: string;
};

const videoSelect = {
  id: true,
  languageCode: true,
  slug: true,
  title: true,
  stage: true,
  topic: true,
  access: true,
  status: true,
  durationSeconds: true,
  host: { select: { slug: true } },
} as const;

type VideoRow = Prisma.VideoGetPayload<{ select: typeof videoSelect }>;

const toCreatorVideo = ({ host, ...row }: VideoRow): CreatorVideo => ({ ...row, hostSlug: host.slug });

/** A creator's own videos in any status (an owner sees all of them). */
export async function listOwnVideos(actor: Actor): Promise<CreatorVideo[]> {
  const rows = await db().video.findMany({ where: visibleVideos(actor), select: videoSelect, orderBy: { createdAt: "desc" } });
  return rows.map(toCreatorVideo);
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
  note: string | null;
  createdAt: Date;
};

/** The history of a video this actor may see, oldest first, or null when they may not see the video. */
export async function listStatusHistory(actor: Actor, videoId: string): Promise<StatusHistoryEntry[] | null> {
  const scope = visibleVideos(actor);
  const events = await db().videoStatusEvent.findMany({
    where: { videoId, video: scope },
    orderBy: { createdAt: "asc" },
    select: { fromStatus: true, toStatus: true, actorLabel: true, note: true, createdAt: true },
  });
  if (events.length > 0) return events;
  // No events can mean "no such video" or "a video with no history"; only say the second to someone who may see the video.
  return (await getOwnVideo(actor, videoId)) ? [] : null;
}

/** Every video, whatever its creator or status. Owners only. */
export async function listAllVideos(actor: Actor): Promise<CreatorVideo[]> {
  if (actor.role !== "owner") throw new ForbiddenError();
  return listOwnVideos(actor);
}

export type CreatorProfile = { slug: string; languageCode: string; name: string; nameArabic: string | null; story: string; topics: string[] };

/** The creator's own profile (their public host page). Owners have none; learners may not ask. */
export async function getOwnProfile(actor: Actor): Promise<CreatorProfile | null> {
  if (actor.role === "owner") return null;
  if (actor.role !== "creator") throw new ForbiddenError();
  const row = await db().host.findFirst({
    where: { userId: actor.id },
    select: { slug: true, languageCode: true, name: true, nameArabic: true, story: true, topics: true },
  });
  return row;
}
