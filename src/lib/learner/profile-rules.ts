import { isAvailable } from "@/lib/languages";
import type { Language } from "@/lib/languages.schema";

export const STAGES = ["HEAR_IT", "FOLLOW_IT", "UNDERSTAND_IT", "JOIN_IN"] as const;
export type Stage = (typeof STAGES)[number];

/** Learner-facing stage names. Internal content levels never appear in learner copy. */
export const STAGE_NAMES: Record<Stage, string> = {
  HEAR_IT: "Hear it",
  FOLLOW_IT: "Follow it",
  UNDERSTAND_IT: "Understand it",
  JOIN_IN: "Join in",
};

export const MINUTES = [10, 20, 30, 60] as const;
export type Minutes = (typeof MINUTES)[number];

export const DEFAULT_MINUTES: Minutes = 20;
export const DEFAULT_LEVEL = "none";

/** What the learner says they know in onboarding, and the stage each answer starts them at. */
export const LEVELS = [
  { id: "none", stage: "HEAR_IT" },
  { id: "few", stage: "HEAR_IT" },
  { id: "slow", stage: "FOLLOW_IT" },
  { id: "most", stage: "UNDERSTAND_IT" },
] as const satisfies ReadonlyArray<{ id: string; stage: Stage }>;
export type Level = (typeof LEVELS)[number]["id"];

export type Profile = { languageCode: string; stage: Stage; minutesPerDay: number };

export function stageForLevel(level: Level): Stage {
  return LEVELS.find((l) => l.id === level)!.stage;
}

export function isLevel(value: unknown): value is Level {
  return LEVELS.some((l) => l.id === value);
}

export function isValidMinutes(value: unknown): value is Minutes {
  return MINUTES.some((m) => m === value);
}

export function isValidStage(value: unknown): value is Stage {
  return STAGES.some((s) => s === value);
}

export type AddCheck = { ok: true } | { ok: false; reason: "unknown" | "unavailable" | "exists" };

/** A learner can add a language that exists, is available, and is not already one of their profiles. */
export function canAddProfile(
  profiles: readonly Pick<Profile, "languageCode">[],
  languageCode: string,
  languages: readonly Language[],
): AddCheck {
  const language = languages.find((l) => l.code === languageCode);
  if (!language) return { ok: false, reason: "unknown" };
  if (!isAvailable(language)) return { ok: false, reason: "unavailable" };
  if (profiles.some((p) => p.languageCode === languageCode)) return { ok: false, reason: "exists" };
  return { ok: true };
}

/** Changes one profile; every other profile is returned untouched (same object). */
export function applyProfileChange(
  profiles: readonly Profile[],
  change: { languageCode: string; stage?: Stage; minutesPerDay?: number },
): Profile[] {
  return profiles.map((p) =>
    p.languageCode === change.languageCode
      ? {
          ...p,
          ...(change.stage !== undefined ? { stage: change.stage } : {}),
          ...(change.minutesPerDay !== undefined ? { minutesPerDay: change.minutesPerDay } : {}),
        }
      : p,
  );
}

export type OfferState = "available" | "added" | "waitlist";

/** The language list for onboarding step 1 and "Add a language". */
export function languagesToOffer(
  languages: readonly Language[],
  profiles: readonly Pick<Profile, "languageCode">[],
): { language: Language; state: OfferState }[] {
  return languages.map((language) => ({
    language,
    state: profiles.some((p) => p.languageCode === language.code)
      ? "added"
      : isAvailable(language)
        ? "available"
        : "waitlist",
  }));
}

export type WatchAccess = "ok" | "no-profile" | "language-unavailable";

/** Whether a learner may watch in a language: they need a profile, and the language must still be available. */
export function watchAccess({ language, profile }: { language: Language; profile: Profile | undefined }): WatchAccess {
  if (!profile) return "no-profile";
  return isAvailable(language) ? "ok" : "language-unavailable";
}
