import "server-only";
import { db } from "@/lib/db";
import type { Profile } from "./profile-rules";

// Every query here is filtered by the signed-in learner's id, which callers take from the session
// (`requireLearner`) and never from the client.

const toProfile = (row: { languageCode: string; stage: Profile["stage"]; minutesPerDay: number }): Profile => ({
  languageCode: row.languageCode,
  stage: row.stage,
  minutesPerDay: row.minutesPerDay,
});

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";

export async function listProfiles(userId: string): Promise<Profile[]> {
  const rows = await db().learnerLanguage.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return rows.map(toProfile);
}

/** The learner's own time zone setting, or null when they have not set one. */
export async function getTimeZone(userId: string): Promise<string | null> {
  const row = await db().user.findUnique({ where: { id: userId }, select: { timeZone: true } });
  return row?.timeZone ?? null;
}

export async function getProfile(userId: string, languageCode: string): Promise<Profile | undefined> {
  const row = await db().learnerLanguage.findUnique({ where: { userId_languageCode: { userId, languageCode } } });
  return row ? toProfile(row) : undefined;
}

/** Creates a profile. The database's unique key (user, language) is the backstop against adding one twice. */
export async function createProfile(userId: string, profile: Profile): Promise<"created" | "exists"> {
  try {
    await db().learnerLanguage.create({ data: { userId, ...profile } });
    return "created";
  } catch (error) {
    if (isUniqueViolation(error)) return "exists";
    throw error;
  }
}

/** Changes only the learner's profile for that language. Returns false when they have none. */
export async function updateProfile(
  userId: string,
  change: { languageCode: string; stage?: Profile["stage"]; minutesPerDay?: number },
): Promise<boolean> {
  const { languageCode, ...fields } = change;
  const result = await db().learnerLanguage.updateMany({ where: { userId, languageCode }, data: fields });
  return result.count > 0;
}
