"use server";

import { z } from "zod";
import { languages } from "@/lib/languages";
import { addLanguagePath, onboardingFinishPath, settingsPath } from "@/lib/routes";
import { requireLearner } from "@/lib/session";
import { STAGES, canAddProfile, isValidMinutes } from "./profile-rules";
import { createProfile, listProfiles, updateProfile as saveProfile } from "./profiles";

// Each action parses its input, takes the learner from the session (never from the input), and returns a small
// typed result instead of throwing for expected problems.

export type ProfileResult = { ok: true } | { ok: false; code: "invalid" | "unavailable-language" | "exists" };

const profileInput = z.object({
  languageCode: z.string().min(1).max(20),
  stage: z.enum(STAGES),
  minutesPerDay: z.number().refine(isValidMinutes),
});

const onboardingInput = profileInput.extend({ replaceExisting: z.boolean().optional() });

/** Turns the onboarding choices into the learner's profile. An existing profile is only replaced when asked. */
export async function completeOnboarding(input: unknown): Promise<ProfileResult> {
  const parsed = onboardingInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const { replaceExisting, ...profile } = parsed.data;

  const learner = await requireLearner(onboardingFinishPath());
  const existing = await listProfiles(learner.id);
  const check = canAddProfile(existing, profile.languageCode, languages);

  if (!check.ok && check.reason === "exists") {
    if (!replaceExisting) return { ok: false, code: "exists" };
    await saveProfile(learner.id, profile);
    return { ok: true };
  }
  if (!check.ok) return { ok: false, code: "unavailable-language" };

  return (await createProfile(learner.id, profile)) === "created" ? { ok: true } : { ok: false, code: "exists" };
}

/** Adds a profile for another available language. A language the learner already has cannot be added twice. */
export async function addLanguage(input: unknown): Promise<ProfileResult> {
  const parsed = profileInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const learner = await requireLearner(addLanguagePath());
  const check = canAddProfile(await listProfiles(learner.id), parsed.data.languageCode, languages);
  if (!check.ok) return { ok: false, code: check.reason === "exists" ? "exists" : "unavailable-language" };

  return (await createProfile(learner.id, parsed.data)) === "created" ? { ok: true } : { ok: false, code: "exists" };
}

export type UpdateResult = { ok: true } | { ok: false; code: "invalid" | "not-found" };

const updateInput = z
  .object({
    languageCode: z.string().min(1).max(20),
    stage: z.enum(STAGES).optional(),
    minutesPerDay: z.number().refine(isValidMinutes).optional(),
  })
  .refine((v) => v.stage !== undefined || v.minutesPerDay !== undefined);

/** Changes the stage and/or minutes of one of the signed-in learner's profiles. No other profile is touched. */
export async function updateProfile(input: unknown): Promise<UpdateResult> {
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const learner = await requireLearner(settingsPath());
  return (await saveProfile(learner.id, parsed.data)) ? { ok: true } : { ok: false, code: "not-found" };
}
