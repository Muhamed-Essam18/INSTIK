import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { MappedSubscription } from "./status";
import type { StoredSubscription, SyncStore } from "./sync";

// The Prisma side of the sync. It touches only User.stripeCustomerId, Subscription and StripeEvent.

const fields = (mapped: MappedSubscription, startedAt: Date) => ({
  stripeSubscriptionId: mapped.stripeSubscriptionId,
  status: mapped.status,
  plan: mapped.plan,
  currentPeriodEnd: mapped.currentPeriodEnd,
  cancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
  stripeCreatedAt: mapped.stripeCreatedAt,
  syncedAt: startedAt,
});

export const syncStore: SyncStore = {
  async findUserIdByCustomer(customerId) {
    const user = await db().user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
    return user?.id ?? null;
  },

  async userExists(userId) {
    return (await db().user.count({ where: { id: userId } })) > 0;
  },

  async linkCustomer(userId, customerId) {
    // Only when unset, and ignoring a clash with another learner's customer id.
    await db()
      .user.updateMany({ where: { id: userId, stripeCustomerId: null }, data: { stripeCustomerId: customerId } })
      .catch(() => undefined);
  },

  async getByUserId(userId): Promise<StoredSubscription | null> {
    return db().subscription.findUnique({
      where: { userId },
      select: { stripeSubscriptionId: true, status: true, stripeCreatedAt: true, syncedAt: true },
    });
  },

  async insert(userId, mapped, startedAt) {
    try {
      await db().subscription.create({ data: { userId, ...fields(mapped, startedAt) } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
      throw error;
    }
  },

  async replaceIf(userId, expectedSyncedAt, mapped, startedAt) {
    const result = await db().subscription.updateMany({
      where: { userId, syncedAt: expectedSyncedAt },
      data: fields(mapped, startedAt),
    });
    return result.count === 1;
  },
};

export type EventRecord = {
  id: string;
  type: string;
  outcome: "RECEIVED" | "PROCESSED" | "IGNORED" | "UNMATCHED";
  stripeObjectId?: string | null;
};

/** Records a delivery as received. False when this event id was already seen. */
export async function receiveEvent(id: string, type: string): Promise<{ firstTime: boolean; processed: boolean }> {
  try {
    await db().stripeEvent.create({ data: { id, type, outcome: "RECEIVED" } });
    return { firstTime: true, processed: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db().stripeEvent.findUnique({ where: { id }, select: { outcome: true } });
      return { firstTime: false, processed: existing ? existing.outcome !== "RECEIVED" : false };
    }
    throw error;
  }
}

/** Marks a received event as handled, with how it ended. */
export async function finishEvent(id: string, outcome: "PROCESSED" | "IGNORED" | "UNMATCHED", objectId?: string) {
  await db().stripeEvent.update({
    where: { id },
    data: { outcome, stripeObjectId: objectId ?? null, processedAt: new Date() },
  });
}
