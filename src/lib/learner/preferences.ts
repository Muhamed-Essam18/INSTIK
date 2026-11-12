import "server-only";
import type { Understood as UnderstoodRow } from "@/generated/prisma/enums";
import { getVideos } from "@/lib/content";
import { db } from "@/lib/db";
import { getLanguageByCode } from "@/lib/languages";
import { DEFAULT_LAYERS, type Layers, type Understood } from "@/lib/player/preferences";
import type { MergeResult } from "@/lib/player/device-import";

// Every query is filtered by the signed-in learner's id, taken from the session by the caller.

const toRow: Record<Understood, UnderstoodRow> = { mostly: "MOSTLY", some: "SOME", "not-yet": "NOT_YET" };
const fromRow: Record<UnderstoodRow, Understood> = { MOSTLY: "mostly", SOME: "some", NOT_YET: "not-yet" };

const profileFor = (userId: string, languageCode: string) =>
  db().learnerLanguage.findUnique({ where: { userId_languageCode: { userId, languageCode } } });

/** The language's allowed layer names that are stored in `value`, as booleans. */
function readLayers(value: unknown, allowed: readonly string[]): Partial<Layers> {
  if (typeof value !== "object" || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([name, v]) => allowed.includes(name) && typeof v === "boolean"),
  ) as Partial<Layers>;
}

/** The learner's transcript layers for a language: their saved choices over the defaults. */
export async function getLayers(userId: string, languageCode: string): Promise<Layers> {
  const profile = await profileFor(userId, languageCode);
  const language = getLanguageByCode(languageCode);
  if (!profile || !language) return DEFAULT_LAYERS;
  const row = await db().preference.findUnique({ where: { learnerLanguageId: profile.id } });
  return { ...DEFAULT_LAYERS, ...readLayers(row?.layers, language.transcriptLayers) };
}

export type SaveResult = "ok" | "no-profile" | "invalid";

/** Saves the learner's layers for a language. Keys the language does not use are refused. */
export async function saveLayers(userId: string, languageCode: string, layers: Partial<Layers>): Promise<SaveResult> {
  const language = getLanguageByCode(languageCode);
  if (!language) return "invalid";
  if (Object.keys(layers).some((name) => !language.transcriptLayers.includes(name as never))) return "invalid";
  const profile = await profileFor(userId, languageCode);
  if (!profile) return "no-profile";
  await db().preference.upsert({
    where: { learnerLanguageId: profile.id },
    create: { learnerLanguageId: profile.id, layers },
    update: { layers },
  });
  return "ok";
}

/** The learner's answer for one video, if they gave one. */
export async function getAnswer(userId: string, languageCode: string, videoSlug: string): Promise<Understood | undefined> {
  const row = await db().comprehensionAnswer.findMany({
    where: { userId, languageCode, videoSlug },
    take: 1,
  });
  return row[0] ? fromRow[row[0].answer] : undefined;
}

/** Saves the one current answer for a video, replacing the old one. */
export async function saveAnswer(
  userId: string,
  languageCode: string,
  videoSlug: string,
  answer: Understood,
): Promise<SaveResult | "unknown-video"> {
  const language = getLanguageByCode(languageCode);
  if (!language) return "invalid";
  if (!(await getVideos(language.slug)).some((v) => v.slug === videoSlug)) return "unknown-video";
  if (!(await profileFor(userId, languageCode))) return "no-profile";
  await db().comprehensionAnswer.upsert({
    where: { userId_languageCode_videoSlug: { userId, languageCode, videoSlug } },
    create: { userId, languageCode, videoSlug, answer: toRow[answer] },
    update: { answer: toRow[answer] },
  });
  return "ok";
}

/** What the account already holds, in the shape the device merge needs. */
export async function accountState(userId: string) {
  const [profiles, answers] = await Promise.all([
    db().learnerLanguage.findMany({ where: { userId }, include: { preference: true } }),
    db().comprehensionAnswer.findMany({ where: { userId } }),
  ]);
  return {
    profiles: profiles.map((p) => p.languageCode),
    accountLayers: new Set(profiles.filter((p) => p.preference).map((p) => p.languageCode)),
    accountAnswers: new Set(answers.map((a) => `${a.languageCode}:${a.videoSlug}`)),
  };
}

/** Writes what the merge decided to save. Existing account choices were already left out by the merge. */
export async function applyImport(userId: string, merge: MergeResult): Promise<{ layers: number; answers: number }> {
  let layers = 0;
  for (const [languageCode, value] of Object.entries(merge.save.layers)) {
    if ((await saveLayers(userId, languageCode, value)) === "ok") layers++;
  }
  let answers = 0;
  for (const { languageCode, videoSlug, answer } of merge.save.answers) {
    if ((await saveAnswer(userId, languageCode, videoSlug, answer)) === "ok") answers++;
  }
  return { layers, answers };
}
