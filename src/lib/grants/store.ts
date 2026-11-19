import "server-only";
import { db } from "@/lib/db";
import type { ActiveGrant, GrantEventRecord, GrantsStore, GrantsTx } from "./service";

// The Prisma side of manual access (spec 11 User Story 5). It writes `User.manualAccessAt` and the append-only `AccessGrantEvent`, and nothing else:
// it never reads or writes a subscription. A database trigger refuses any UPDATE or DELETE of an event (except what deleting an account causes).

const label = (user: { name: string | null; email: string } | null | undefined) => user?.name?.trim() || user?.email || null;

export const prismaGrantsStore: GrantsStore = {
  transaction: (work) =>
    db().$transaction(async (p) => {
      const tx: GrantsTx = {
        async lockAccount(email) {
          // The row lock: two owners granting the same account at once cannot both write an event.
          await p.$queryRaw`SELECT "id" FROM "User" WHERE lower("email") = ${email} FOR UPDATE`;
          return p.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, email: true, name: true, manualAccessAt: true } });
        },
        async latestGrantReason(userId) {
          const row = await p.accessGrantEvent.findFirst({ where: { userId, kind: "GRANTED" }, orderBy: { at: "desc" }, select: { reason: true } });
          return row?.reason ?? null;
        },
        async setManualAccess(userId, at) {
          await p.user.update({ where: { id: userId }, data: { manualAccessAt: at } });
        },
        async appendEvent(event) {
          await p.accessGrantEvent.create({ data: event });
        },
      };
      return work(tx);
    }),

  async active(): Promise<ActiveGrant[]> {
    const users = await db().user.findMany({
      where: { manualAccessAt: { not: null } },
      orderBy: { manualAccessAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        manualAccessAt: true,
        accessEvents: { where: { kind: "GRANTED" }, orderBy: { at: "desc" }, take: 1, select: { reason: true, note: true, by: { select: { name: true, email: true } } } },
      },
    });
    return users.map((u) => ({
      userId: u.id,
      email: u.email,
      name: u.name,
      since: u.manualAccessAt as Date,
      reason: u.accessEvents[0]?.reason ?? null,
      note: u.accessEvents[0]?.note ?? null,
      byName: label(u.accessEvents[0]?.by),
    }));
  },

  async events(limit): Promise<GrantEventRecord[]> {
    const rows = await db().accessGrantEvent.findMany({
      orderBy: { at: "desc" },
      take: limit,
      select: { id: true, userId: true, kind: true, reason: true, note: true, at: true, user: { select: { email: true, name: true } }, by: { select: { name: true, email: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      email: r.user.email,
      accountName: r.user.name,
      kind: r.kind,
      reason: r.reason,
      note: r.note,
      byName: label(r.by),
      at: r.at,
    }));
  },
};
