import "server-only";
import type { VideoStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { CreatorData } from "./rules";
import type { CreatorsStore, CreatorsTx, StatusCounts } from "./service";

// The Prisma side of the owner's creator management. It reads creators, their hosts, their videos' counts and the invitations,
// and writes only `User.pausedAt` and the append-only `CreatorPauseEvent`. It never writes the role (that is the invitation store's job).

// A filter on the creator role, not a write of it: a test makes sure only the invitation store ever sets that role.
const creatorRole = "CREATOR" as const;

const group = (rows: { status: VideoStatus; _count: { _all: number } }[]): StatusCounts => {
  const n = (...statuses: VideoStatus[]) => rows.filter((r) => statuses.includes(r.status)).reduce((sum, r) => sum + r._count._all, 0);
  return { live: n("APPROVED"), inReview: n("IN_REVIEW"), changes: n("CHANGES_REQUESTED"), rejected: n("REJECTED"), drafts: n("DRAFT", "UPLOADING", "PROCESSING") };
};

export const prismaCreatorsStore: CreatorsStore = {
  transaction: (work) =>
    db().$transaction(async (p) => {
      const tx: CreatorsTx = {
        async lockUser(userId) {
          // The row lock: two owners pausing the same creator at once cannot both write an event.
          await p.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
          return p.user.findUnique({ where: { id: userId }, select: { id: true, role: true, email: true, pausedAt: true } });
        },
        async setPaused(userId, pausedAt) {
          await p.user.update({ where: { id: userId }, data: { pausedAt } });
        },
        async appendPauseEvent(event) {
          await p.creatorPauseEvent.create({ data: event });
        },
      };
      return work(tx);
    }),

  async creators(languageCode) {
    // The table covers one language for now (the default). When more languages are open this becomes a filter on the page.
    const users = await db().user.findMany({
      where: { role: creatorRole, host: { is: { languageCode } } },
      select: { id: true, email: true, name: true, pausedAt: true, host: { select: { id: true, name: true } } },
    });
    const grouped = await db().video.groupBy({
      by: ["hostId", "status"],
      where: { deletedAt: null, hostId: { in: users.flatMap((u) => (u.host ? [u.host.id] : [])) } },
      _count: { _all: true },
    });
    return users.map<CreatorData>((u) => {
      const counts = group(grouped.filter((g) => g.hostId === u.host?.id));
      return {
        id: u.id,
        email: u.email,
        name: u.host?.name.trim() || u.name?.trim() || u.email,
        pausedAt: u.pausedAt,
        counts: { live: counts.live, inReview: counts.inReview, changes: counts.changes },
      };
    });
  },

  async invites() {
    return db().creatorInvite.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, name: true, email: true, createdAt: true, expiresAt: true, usedAt: true, revokedAt: true },
    });
  },

  async profile(creatorId) {
    const user = await db().user.findUnique({
      where: { id: creatorId },
      select: { id: true, role: true, email: true, name: true, pausedAt: true, createdAt: true, host: { select: { name: true } }, invitesUsed: { orderBy: { usedAt: "desc" }, take: 1, select: { usedAt: true } } },
    });
    if (!user) return null;
    return {
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.host?.name.trim() || user.name?.trim() || user.email,
      pausedAt: user.pausedAt,
      // When they accepted their invitation, else when the account was made.
      joinedAt: user.invitesUsed[0]?.usedAt ?? user.createdAt,
    };
  },

  async counts(creatorId) {
    const rows = await db().video.groupBy({ by: ["status"], where: { deletedAt: null, host: { userId: creatorId } }, _count: { _all: true } });
    return group(rows);
  },

  approvedSince(creatorId, since) {
    return db().videoStatusEvent.count({ where: { toStatus: "APPROVED", createdAt: { gte: since }, video: { deletedAt: null, host: { userId: creatorId } } } });
  },

  async lastUploadAt(creatorId) {
    const top = await db().video.aggregate({ where: { deletedAt: null, host: { userId: creatorId } }, _max: { uploadStartedAt: true } });
    return top._max.uploadStartedAt ?? null;
  },
};
