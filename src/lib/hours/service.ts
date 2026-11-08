import "server-only";
import { db } from "@/lib/db";
import type { PrismaClient } from "@/generated/prisma/client";
import { getLanguageByCode } from "@/lib/languages";
import { isValidTimeZone, splitByLocalDay, todayIn } from "./days";
import { decideDone } from "./goal";
import { acceptInterval } from "./heartbeat";
import { canAddMore, validateManualTime } from "./manual-time";
import { dayToDate } from "./queries";
import { advanceStage } from "./stages";
import { hoursOf, todaySeconds, totalSeconds } from "./totals";
import { clampPosition, isWatched } from "./watched";
import { getVideo } from "@/lib/content";
import type { Stage } from "@/lib/learner/profile-rules";

// The database side of honest hours. Callers (the server actions) have already parsed the input and taken the
// learner from the session; every query here is filtered by that learner's id.

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

type LockedRow = {
  id: string;
  stage: Stage;
  countedUntil: Date | null;
  lateWindowStart: Date | null;
  lateSeconds: number;
  chimedHours: number;
  minutesPerDay: number;
};

async function lockProfile(tx: Tx, userId: string, languageCode: string): Promise<LockedRow | undefined> {
  const rows = await tx.$queryRaw<LockedRow[]>`
    SELECT "id", "stage", "countedUntil", "lateWindowStart", "lateSeconds", "chimedHours", "minutesPerDay"
    FROM "LearnerLanguage"
    WHERE "userId" = ${userId} AND "languageCode" = ${languageCode}
    FOR UPDATE`;
  return rows[0];
}

async function totalsIn(tx: Tx, userId: string, languageCode: string) {
  const [watched, added] = await Promise.all([
    tx.watchSession.aggregate({ where: { userId, languageCode }, _sum: { seconds: true } }),
    tx.manualTime.aggregate({ where: { userId, languageCode }, _sum: { minutes: true } }),
  ]);
  const watchedSeconds = watched._sum.seconds ?? 0;
  const addedMinutes = added._sum.minutes ?? 0;
  return { watchedSeconds, addedMinutes, totalSeconds: totalSeconds(watchedSeconds, addedMinutes) };
}

/** Counted watching today (added time never counts toward the daily goal). */
async function todaySecondsIn(tx: Tx, userId: string, languageCode: string, today: string): Promise<number> {
  const rows = await tx.watchSession.findMany({
    where: { userId, languageCode, day: dayToDate(today) },
    select: { videoSlug: true, seconds: true },
  });
  return todaySeconds(rows.map((r) => ({ videoSlug: r.videoSlug, day: today, seconds: r.seconds })), today);
}

/** Rounds fractional day parts to whole seconds that add up to exactly `total`. */
function wholeParts(parts: { day: string; seconds: number }[], total: number) {
  const out = parts.map((p) => ({ day: p.day, seconds: Math.round(p.seconds) }));
  const diff = total - out.reduce((n, p) => n + p.seconds, 0);
  if (out.length > 0) out[out.length - 1].seconds += diff;
  return out.filter((p) => p.seconds > 0);
}

async function storeTimeZone(tx: Tx, userId: string, timeZone: string) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { timeZone: true } });
  if (user && user.timeZone !== timeZone) await tx.user.update({ where: { id: userId }, data: { timeZone } });
}

export type HeartbeatInput = {
  userId: string;
  languageCode: string;
  videoSlug: string;
  seconds: number;
  spanSeconds: number;
  endedAgoSeconds: number;
  position: number;
  timeZone: string;
  nowMs?: number;
};

export type HeartbeatResult =
  | { ok: true; accepted: number; totalSeconds: number; todaySeconds: number; stage: Stage; chime: boolean }
  | { ok: false; code: "no-profile" | "unknown-video" | "rejected" };

export async function recordHeartbeat(input: HeartbeatInput): Promise<HeartbeatResult> {
  const language = getLanguageByCode(input.languageCode);
  const video = language && getVideo(language.slug, input.videoSlug);
  if (!language || !video) return { ok: false, code: "unknown-video" };
  const now = input.nowMs ?? Date.now();

  return db().$transaction(async (tx): Promise<HeartbeatResult> => {
    const row = await lockProfile(tx, input.userId, input.languageCode);
    if (!row) return { ok: false, code: "no-profile" };

    const decision = acceptInterval({
      seconds: input.seconds,
      spanSeconds: input.spanSeconds,
      endedAgoSeconds: input.endedAgoSeconds,
      now,
      countedUntil: row.countedUntil?.getTime() ?? null,
      lateWindowStart: row.lateWindowStart?.getTime() ?? null,
      lateSeconds: row.lateSeconds,
    });
    if (!decision.ok) return { ok: false, code: "rejected" };

    await storeTimeZone(tx, input.userId, input.timeZone);

    const accepted = Math.floor(decision.accepted);
    for (const part of wholeParts(splitByLocalDay(decision.startMs, accepted, input.timeZone), accepted)) {
      await tx.watchSession.upsert({
        where: {
          userId_languageCode_videoSlug_day: {
            userId: input.userId,
            languageCode: input.languageCode,
            videoSlug: input.videoSlug,
            day: dayToDate(part.day),
          },
        },
        create: {
          userId: input.userId,
          languageCode: input.languageCode,
          videoSlug: input.videoSlug,
          day: dayToDate(part.day),
          seconds: part.seconds,
        },
        update: { seconds: { increment: part.seconds } },
      });
    }

    // Where the learner is: the server trusts the video's real length, not the client's.
    const position = clampPosition(input.position, video.durationSeconds);
    const key = { userId_languageCode_videoSlug: { userId: input.userId, languageCode: input.languageCode, videoSlug: input.videoSlug } };
    const existing = await tx.videoProgress.findUnique({ where: key, select: { watched: true } });
    const watched = isWatched(position, video.durationSeconds, existing?.watched ?? false);
    await tx.videoProgress.upsert({
      where: key,
      create: { userId: input.userId, languageCode: input.languageCode, videoSlug: input.videoSlug, positionSeconds: position, watched },
      update: { positionSeconds: position, watched },
    });

    const totals = await totalsIn(tx, input.userId, input.languageCode);
    const hours = hoursOf(totals.totalSeconds);
    const stage = advanceStage(row.stage, hours, language.roadmap);
    const wholeHours = Math.floor(hours);
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { hourSound: true } });
    const crossed = wholeHours > row.chimedHours;

    await tx.learnerLanguage.update({
      where: { id: row.id },
      data: {
        countedUntil: new Date(decision.countedUntil),
        lateWindowStart: decision.lateWindowStart === null ? null : new Date(decision.lateWindowStart),
        lateSeconds: decision.lateSeconds,
        ...(stage !== row.stage ? { stage } : {}),
        ...(crossed ? { chimedHours: wholeHours } : {}),
      },
    });

    const today = todayIn(input.timeZone, now);
    return {
      ok: true,
      accepted,
      totalSeconds: totals.totalSeconds,
      todaySeconds: await todaySecondsIn(tx, input.userId, input.languageCode, today),
      stage,
      chime: crossed && (user?.hourSound ?? false),
    };
  });
}

export type EndOfVideoResult = { ok: true; showDone: boolean } | { ok: false; code: "no-profile" | "unknown-video" };

/** Decides whether Done for today follows the video that just ended, and records the block when it does. */
export async function endOfVideo(input: { userId: string; languageCode: string; videoSlug: string; nowMs?: number }): Promise<EndOfVideoResult> {
  const language = getLanguageByCode(input.languageCode);
  const video = language && getVideo(language.slug, input.videoSlug);
  if (!language || !video) return { ok: false, code: "unknown-video" };
  const now = input.nowMs ?? Date.now();

  return db().$transaction(async (tx): Promise<EndOfVideoResult> => {
    const row = await lockProfile(tx, input.userId, input.languageCode);
    if (!row) return { ok: false, code: "no-profile" };
    const profile = await tx.learnerLanguage.findUnique({ where: { id: row.id }, select: { doneDay: true, doneBlocks: true } });
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { timeZone: true } });
    const timeZone = isValidTimeZone(user?.timeZone) ? user.timeZone : "UTC";
    const today = todayIn(timeZone, now);
    const progress = await tx.videoProgress.findUnique({
      where: { userId_languageCode_videoSlug: { userId: input.userId, languageCode: input.languageCode, videoSlug: input.videoSlug } },
      select: { positionSeconds: true },
    });

    const decision = decideDone({
      position: progress?.positionSeconds ?? 0,
      duration: video.durationSeconds,
      todaySeconds: await todaySecondsIn(tx, input.userId, input.languageCode, today),
      goalSeconds: row.minutesPerDay * 60,
      doneDay: profile?.doneDay ? profile.doneDay.toISOString().slice(0, 10) : null,
      doneBlocks: profile?.doneBlocks ?? 0,
      today,
    });
    if (decision.show) {
      await tx.learnerLanguage.update({ where: { id: row.id }, data: { doneDay: dayToDate(today), doneBlocks: decision.doneBlocks } });
    }
    return { ok: true, showDone: decision.show };
  });
}

export type ManualInput = { userId: string; languageCode: string; minutes: number; day: string; timeZone: string; nowMs?: number };
export type ManualResult =
  | { ok: true; totalSeconds: number; stage: Stage }
  | { ok: false; code: "invalid-minutes" | "invalid-date" | "too-many" | "no-profile" };

export async function addManualTime(input: ManualInput): Promise<ManualResult> {
  const language = getLanguageByCode(input.languageCode);
  if (!language) return { ok: false, code: "no-profile" };
  const today = todayIn(input.timeZone, input.nowMs ?? Date.now());
  const check = validateManualTime({ minutes: input.minutes, day: input.day, today });
  if (!check.ok) return { ok: false, code: check.field === "minutes" ? "invalid-minutes" : "invalid-date" };

  return db().$transaction(async (tx): Promise<ManualResult> => {
    const row = await lockProfile(tx, input.userId, input.languageCode);
    if (!row) return { ok: false, code: "no-profile" };
    const onDay = await tx.manualTime.count({
      where: { userId: input.userId, languageCode: input.languageCode, day: dayToDate(input.day) },
    });
    if (!canAddMore(onDay)) return { ok: false, code: "too-many" };

    await storeTimeZone(tx, input.userId, input.timeZone);
    await tx.manualTime.create({
      data: { userId: input.userId, languageCode: input.languageCode, day: dayToDate(input.day), minutes: input.minutes },
    });
    const totals = await totalsIn(tx, input.userId, input.languageCode);
    const stage = advanceStage(row.stage, hoursOf(totals.totalSeconds), language.roadmap);
    if (stage !== row.stage) await tx.learnerLanguage.update({ where: { id: row.id }, data: { stage } });
    return { ok: true, totalSeconds: totals.totalSeconds, stage };
  });
}

export type RemoveResult = { ok: true; totalSeconds: number; languageCode: string } | { ok: false; code: "not-found" };

/** Removes one of the learner's own added entries. The stage and the chimed hours are left exactly as they are. */
export async function removeManualTime(input: { userId: string; id: string }): Promise<RemoveResult> {
  return db().$transaction(async (tx): Promise<RemoveResult> => {
    const entry = await tx.manualTime.findFirst({ where: { id: input.id, userId: input.userId } });
    if (!entry) return { ok: false, code: "not-found" };
    await tx.manualTime.delete({ where: { id: entry.id } });
    const totals = await totalsIn(tx, input.userId, entry.languageCode);
    return { ok: true, totalSeconds: totals.totalSeconds, languageCode: entry.languageCode };
  });
}

/** Stores the learner's time zone; reports whether it changed. */
export async function syncTimeZone(userId: string, timeZone: string): Promise<{ changed: boolean }> {
  const user = await db().user.findUnique({ where: { id: userId }, select: { timeZone: true } });
  if (!user || user.timeZone === timeZone) return { changed: false };
  await db().user.update({ where: { id: userId }, data: { timeZone } });
  return { changed: true };
}

export async function saveSessionSettings(userId: string, settings: { remindersOn?: boolean; hourSound?: boolean }): Promise<void> {
  await db().user.update({ where: { id: userId }, data: settings });
}
