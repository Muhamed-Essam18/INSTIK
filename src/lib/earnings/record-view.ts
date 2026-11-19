import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { monthKeyOf, warsawDayOf } from "@/lib/time/warsaw";
import { countsAsView, crossesThreshold } from "./counting";

// Records counted views AFTER a heartbeat has committed (spec 11, research.md section 1). It has its own queries and its own
// try/catch: a failure here is logged and swallowed, so counting can never affect a learner's Hours (constitution III).

export type Crossing = {
  userId: string;
  languageCode: string;
  videoSlug: string;
  /** The learner's day, "YYYY-MM-DD" (the same day the WatchSession row uses). */
  day: string;
  secondsBefore: number;
  secondsAfter: number;
};

export type CountingClient = Pick<PrismaClient, "video" | "subscription" | "user" | "countedView">;

const dayToDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

/**
 * For each crossing (the day's seconds went from below 30 to 30 or more), checks the video, the learner's access and the creator,
 * and stores one counted view. The insert ignores a duplicate, so a repeat or a second device is harmless.
 * Never throws: an error is logged by name and code only (no learner id, no query text) and the function returns.
 */
export async function recordCountedViewIfCrossed(crossings: readonly Crossing[], nowMs: number, client: CountingClient = db()): Promise<void> {
  try {
    const now = new Date(nowMs);
    for (const crossing of crossings) {
      if (!crossesThreshold(crossing.secondsBefore, crossing.secondsAfter - crossing.secondsBefore)) continue;

      const video = await client.video.findUnique({
        where: { languageCode_slug: { languageCode: crossing.languageCode, slug: crossing.videoSlug } },
        select: { id: true, host: { select: { userId: true } } },
      });
      if (!video) continue;

      const [subscription, learner] = await Promise.all([
        client.subscription.findUnique({
          where: { userId: crossing.userId },
          select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
        }),
        client.user.findUnique({ where: { id: crossing.userId }, select: { manualAccessAt: true } }),
      ]);

      const creatorId = video.host.userId;
      if (!countsAsView({ learnerId: crossing.userId, creatorId, subscription, manual: learner?.manualAccessAt != null, now })) continue;

      await client.countedView.createMany({
        data: [
          {
            userId: crossing.userId,
            videoId: video.id,
            creatorId,
            day: dayToDate(crossing.day),
            countedAt: now,
            monthKey: monthKeyOf(now),
            warsawDay: dayToDate(warsawDayOf(now)),
          },
        ],
        skipDuplicates: true,
      });
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    const code = (error as { code?: unknown } | null)?.code;
    console.error(`Counting a view was skipped: ${name}${typeof code === "string" ? ` (${code})` : ""}`);
  }
}
