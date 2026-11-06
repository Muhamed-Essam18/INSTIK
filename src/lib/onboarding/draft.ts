import { z } from "zod";
import {
  DEFAULT_LEVEL,
  DEFAULT_MINUTES,
  isLevel,
  isValidMinutes,
  stageForLevel,
  type Level,
  type Minutes,
  type Profile,
} from "@/lib/learner/profile-rules";

/** The choices made in onboarding before an account exists. Kept on the device until they become a profile. */
export type Step = 1 | 2 | 3 | 4;
export type Draft = { step: Step; language?: string; level?: Level; minutes?: Minutes };

export const EMPTY_DRAFT: Draft = { step: 1 };

// Anything of the wrong shape falls back to "not chosen" instead of failing.
export const draftSchema = z.object({
  step: z.number().int().min(1).max(4).catch(1),
  language: z.string().min(1).optional().catch(undefined),
  level: z.string().refine(isLevel).optional().catch(undefined),
  minutes: z.number().refine(isValidMinutes).optional().catch(undefined),
});

export const chooseLanguage = (draft: Draft, language: string): Draft => ({ ...draft, language });
export const chooseLevel = (draft: Draft, level: Level): Draft => ({ ...draft, level });
export const chooseMinutes = (draft: Draft, minutes: Minutes): Draft => ({ ...draft, minutes });

/** Continue on the level step saves the option shown, which is "None at all" if nothing was touched. */
export const confirmLevel = (draft: Draft): Draft => ({ ...draft, level: draft.level ?? DEFAULT_LEVEL });
/** Continue on the time step saves the option shown, which is 20 minutes if nothing was touched. */
export const confirmMinutes = (draft: Draft): Draft => ({ ...draft, minutes: draft.minutes ?? DEFAULT_MINUTES });

/** The first step whose answer is missing; 4 once the first three are answered. */
export function firstMissingStep(draft: Draft, preferredLanguage?: string): Step {
  if (!draft.language && !preferredLanguage) return 1;
  if (!draft.level) return 2;
  if (!draft.minutes) return 3;
  return 4;
}

/** A learner cannot be on a step past the first one that is still unanswered. */
export function clampStep(draft: Draft, requested: number, preferredLanguage?: string): Step {
  const wanted = Math.min(4, Math.max(1, Math.trunc(Number.isFinite(requested) ? requested : 1)));
  return Math.min(wanted, firstMissingStep(draft, preferredLanguage)) as Step;
}

/**
 * Cleans a stored draft. A draft for a language that is not on offer any more is thrown away
 * completely, so the flow restarts at step 1 instead of carrying a stale choice.
 */
export function normaliseDraft(draft: Draft, languageCodes: readonly string[]): Draft {
  if (draft.language && !languageCodes.includes(draft.language)) return EMPTY_DRAFT;
  return { ...draft, step: clampStep(draft, draft.step) };
}

export function parseDraft(raw: unknown, languageCodes: readonly string[]): Draft {
  const result = draftSchema.safeParse(raw);
  if (!result.success) return EMPTY_DRAFT;
  return normaliseDraft(result.data as Draft, languageCodes);
}

/** The profile this draft becomes once there is an account, or undefined while it is incomplete. */
export function toProfileInput(draft: Draft): Profile | undefined {
  if (!draft.language || !draft.level || !draft.minutes) return undefined;
  return { languageCode: draft.language, stage: stageForLevel(draft.level), minutesPerDay: draft.minutes };
}
