import "server-only";
import { db } from "@/lib/db";
import { getVideo } from "@/lib/content";
import { getLanguageByCode } from "@/lib/languages";
import type { Stage } from "@/lib/learner/profile-rules";
import { isValidTimeZone, mondayOf, todayIn } from "./days";
import { buildRhythm, weekStrip, type Rhythm, type StripDay } from "./rhythm";
import { moreHours, nextStage, stageProgress, stageStates } from "./stages";
import { hoursOf, todaySeconds, totalSeconds, videosToday } from "./totals";

// Reads learner hours. Every query filters by the learner's id; nothing here trusts the client.

/** A calendar day string as the Date Prisma stores for a date-only column. */
export const dayToDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);
/** The calendar day of a date-only column value. */
export const dateToDay = (date: Date): string => date.toISOString().slice(0, 10);

/** The learner's stored time zone, or UTC while it is unknown. */
export async function getTimeZone(userId: string): Promise<string> {
  const user = await db().user.findUnique({ where: { id: userId }, select: { timeZone: true } });
  return isValidTimeZone(user?.timeZone) ? user.timeZone : "UTC";
}

/** Total seconds for every language the learner has hours in (watched plus added). One grouped query each. */
export async function getHoursByLanguage(userId: string): Promise<Record<string, number>> {
  const [watched, added] = await Promise.all([
    db().watchSession.groupBy({ by: ["languageCode"], where: { userId }, _sum: { seconds: true } }),
    db().manualTime.groupBy({ by: ["languageCode"], where: { userId }, _sum: { minutes: true } }),
  ]);
  const out: Record<string, number> = {};
  for (const row of watched) out[row.languageCode] = row._sum.seconds ?? 0;
  for (const row of added) out[row.languageCode] = (out[row.languageCode] ?? 0) + (row._sum.minutes ?? 0) * 60;
  return out;
}

export type LanguageHours = {
  today: string;
  timeZone: string;
  watchedSeconds: number;
  addedMinutes: number;
  totalSeconds: number;
  todaySeconds: number;
  videosToday: number;
};

/** One language's totals and today's figures, with "today" decided in the learner's time zone. */
export async function getLanguageHours(userId: string, languageCode: string, nowMs = Date.now()): Promise<LanguageHours> {
  const timeZone = await getTimeZone(userId);
  const today = todayIn(timeZone, nowMs);
  const [watched, added, todayRows] = await Promise.all([
    db().watchSession.aggregate({ where: { userId, languageCode }, _sum: { seconds: true } }),
    db().manualTime.aggregate({ where: { userId, languageCode }, _sum: { minutes: true } }),
    db().watchSession.findMany({
      where: { userId, languageCode, day: dayToDate(today) },
      select: { videoSlug: true, seconds: true },
    }),
  ]);
  const rows = todayRows.map((r) => ({ videoSlug: r.videoSlug, day: today, seconds: r.seconds }));
  const watchedSeconds = watched._sum.seconds ?? 0;
  const addedMinutes = added._sum.minutes ?? 0;
  return {
    today,
    timeZone,
    watchedSeconds,
    addedMinutes,
    totalSeconds: totalSeconds(watchedSeconds, addedMinutes),
    todaySeconds: todaySeconds(rows, today),
    videosToday: videosToday(rows, today),
  };
}

/** Counted seconds per local day since `fromDay`, and the days with added time, for the rhythm and the week strip. */
export async function getRhythmSource(userId: string, languageCode: string, fromDay: string) {
  const [watched, added] = await Promise.all([
    db().watchSession.groupBy({
      by: ["day"],
      where: { userId, languageCode, day: { gte: dayToDate(fromDay) } },
      _sum: { seconds: true },
    }),
    db().manualTime.findMany({
      where: { userId, languageCode, day: { gte: dayToDate(fromDay) } },
      select: { day: true },
      distinct: ["day"],
    }),
  ]);
  const watchedByDay: Record<string, number> = {};
  for (const row of watched) watchedByDay[dateToDay(row.day)] = row._sum.seconds ?? 0;
  return { watchedByDay, addedDays: added.map((m) => dateToDay(m.day)) };
}

export type RoadmapView = LanguageHours & {
  languageName: string;
  stage: Stage;
  states: ReturnType<typeof stageStates>;
  progress: number;
  moreHours: number | null;
  nextStage: Stage | undefined;
  hasEstimates: boolean;
  rhythm: Rhythm;
  entries: Array<{ id: string; day: string; minutes: number }>;
  minutesPerDay: number;
  remindersOn: boolean;
  hourSound: boolean;
};

/**
 * Everything the Roadmap shows for one language, computed here from rows; the screen only draws it.
 * Four queries in all: the learner (zone and settings), the profile, the counted time per day and video, and the
 * added entries. Totals, today, the rhythm and the stage all come from those rows.
 */
export async function getRoadmapView(userId: string, languageCode: string, nowMs = Date.now()): Promise<RoadmapView | null> {
  const language = getLanguageByCode(languageCode);
  if (!language) return null;
  const [user, profile, watchedRows, manualRows] = await Promise.all([
    db().user.findUnique({ where: { id: userId }, select: { timeZone: true, remindersOn: true, hourSound: true } }),
    db().learnerLanguage.findUnique({ where: { userId_languageCode: { userId, languageCode } }, select: { stage: true, minutesPerDay: true } }),
    db().watchSession.groupBy({ by: ["day", "videoSlug"], where: { userId, languageCode }, _sum: { seconds: true } }),
    db().manualTime.findMany({
      where: { userId, languageCode },
      orderBy: [{ day: "desc" }, { createdAt: "desc" }],
      select: { id: true, day: true, minutes: true },
    }),
  ]);
  if (!profile) return null;

  const timeZone = isValidTimeZone(user?.timeZone) ? user.timeZone : "UTC";
  const today = todayIn(timeZone, nowMs);
  const rows = watchedRows.map((r) => ({ videoSlug: r.videoSlug, day: dateToDay(r.day), seconds: r._sum.seconds ?? 0 }));
  const watchedSeconds = rows.reduce((n, r) => n + r.seconds, 0);
  const addedMinutes = manualRows.reduce((n, m) => n + m.minutes, 0);
  const totalSecondsNow = totalSeconds(watchedSeconds, addedMinutes);
  const totalHours = hoursOf(totalSecondsNow);
  const estimates = language.roadmap;

  const watchedByDay: Record<string, number> = {};
  for (const r of rows) watchedByDay[r.day] = (watchedByDay[r.day] ?? 0) + r.seconds;

  return {
    today,
    timeZone,
    watchedSeconds,
    addedMinutes,
    totalSeconds: totalSecondsNow,
    todaySeconds: todaySeconds(rows, today),
    videosToday: videosToday(rows, today),
    languageName: [language.variety, language.name].filter(Boolean).join(" "),
    stage: profile.stage,
    states: stageStates(profile.stage),
    progress: stageProgress(profile.stage, totalHours, estimates),
    moreHours: moreHours(profile.stage, totalHours, estimates),
    nextStage: nextStage(profile.stage),
    hasEstimates: estimates !== undefined,
    rhythm: buildRhythm({ today, watchedByDay, addedDays: manualRows.map((m) => dateToDay(m.day)) }),
    entries: manualRows.slice(0, 50).map((e) => ({ id: e.id, day: dateToDay(e.day), minutes: e.minutes })),
    minutesPerDay: profile.minutesPerDay,
    remindersOn: user?.remindersOn ?? false,
    hourSound: user?.hourSound ?? false,
  };
}

export type DoneView = {
  languageName: string;
  todaySeconds: number;
  videosToday: number;
  totalSeconds: number;
  strip: StripDay[];
};

export async function getDoneView(userId: string, languageCode: string, nowMs = Date.now()): Promise<DoneView | null> {
  const language = getLanguageByCode(languageCode);
  if (!language) return null;
  const hours = await getLanguageHours(userId, languageCode, nowMs);
  const source = await getRhythmSource(userId, languageCode, mondayOf(hours.today));
  return {
    languageName: [language.variety, language.name].filter(Boolean).join(" "),
    todaySeconds: hours.todaySeconds,
    videosToday: hours.videosToday,
    totalSeconds: hours.totalSeconds,
    strip: weekStrip({ today: hours.today, ...source }),
  };
}

/** The unfinished video to pick up and the videos already watched, for one learner and language. */
export async function getLibraryProgress(userId: string, languageCode: string) {
  const language = getLanguageByCode(languageCode);
  const rows = await db().videoProgress.findMany({
    where: { userId, languageCode },
    orderBy: { updatedAt: "desc" },
    select: { videoSlug: true, positionSeconds: true, watched: true },
  });
  const exists = (slug: string) => (language ? getVideo(language.slug, slug) !== undefined : false);
  const pickUp = rows.find((r) => !r.watched && r.positionSeconds > 0 && exists(r.videoSlug));
  return {
    pickUp: pickUp ? { videoSlug: pickUp.videoSlug, positionSeconds: pickUp.positionSeconds } : null,
    watchedSlugs: rows.filter((r) => r.watched && exists(r.videoSlug)).map((r) => r.videoSlug),
  };
}
