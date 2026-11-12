import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { InviteRecord, InviteStore, InviteTx } from "./service";

// The Prisma side of the invitations. It touches only CreatorInvite, the creator role on User, and creator Host rows.

const asRecord = (row: InviteRecord): InviteRecord => ({
  id: row.id,
  name: row.name,
  email: row.email,
  tokenHash: row.tokenHash,
  invitedById: row.invitedById,
  createdAt: row.createdAt,
  expiresAt: row.expiresAt,
  usedAt: row.usedAt,
  usedById: row.usedById,
  revokedAt: row.revokedAt,
});

/** The pending condition used by every conditional write: not used, not revoked, not expired. */
const pending = (now: Date) => ({ usedAt: null, revokedAt: null, expiresAt: { gt: now } });

function txFor(p: Prisma.TransactionClient): InviteTx {
  return {
    async revokePendingForEmail(email, now) {
      await p.creatorInvite.updateMany({ where: { email, ...pending(now) }, data: { revokedAt: now } });
    },

    async createInvite(invite) {
      return asRecord(await p.creatorInvite.create({ data: invite }));
    },

    async revokeIfPending(inviteId, now) {
      const changed = await p.creatorInvite.updateMany({ where: { id: inviteId, ...pending(now) }, data: { revokedAt: now } });
      if (changed.count === 1) return "revoked";
      return (await p.creatorInvite.count({ where: { id: inviteId } })) === 0 ? "not-found" : "not-pending";
    },

    async findByTokenHash(tokenHash) {
      const row = await p.creatorInvite.findUnique({ where: { tokenHash } });
      return row ? asRecord(row) : null;
    },

    // The conditional update is the lock: of two people claiming one invitation, only one changes a row.
    async claim(inviteId, userId, now) {
      const changed = await p.creatorInvite.updateMany({
        where: { id: inviteId, ...pending(now) },
        data: { usedAt: now, usedById: userId },
      });
      return changed.count === 1;
    },

    async getUser(userId) {
      return p.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
    },

    // The only place the creator role is written (a test searches the source for any other).
    async makeCreator(userId) {
      const changed = await p.user.updateMany({ where: { id: userId, role: "LEARNER" }, data: { role: "CREATOR" } });
      return changed.count === 1;
    },

    async hostSlugsTaken(languageCode) {
      const rows = await p.host.findMany({ where: { languageCode }, select: { slug: true } });
      return new Set(rows.map((r) => r.slug));
    },

    async nextHostOrder(languageCode) {
      const top = await p.host.aggregate({ where: { languageCode }, _max: { order: true } });
      return (top._max.order ?? 0) + 1;
    },

    async createHost(host) {
      await p.host.create({ data: { ...host, nameArabic: null, story: "", topics: [], photo: null, sample: false } });
    },
  };
}

export const inviteStore: InviteStore = {
  transaction: (work) => db().$transaction((p) => work(txFor(p))),

  async list() {
    return (await db().creatorInvite.findMany({ orderBy: { createdAt: "desc" }, take: 500 })).map(asRecord);
  },

  countCreatedSince: (invitedById, since) =>
    db().creatorInvite.count({ where: { invitedById, createdAt: { gte: since } } }),

  async roleOfEmail(email) {
    const user = await db().user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { role: true } });
    return user?.role ?? null;
  },
};
