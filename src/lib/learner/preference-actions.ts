"use server";

import { z } from "zod";
import { getVideos } from "@/lib/content";
import { languages } from "@/lib/languages";
import { mergeDeviceChoices } from "@/lib/player/device-import";
import { understoodSchema } from "@/lib/player/preferences";
import { settingsPath } from "@/lib/routes";
import { requireLearner } from "@/lib/session";
import { isVideoLocked } from "@/lib/billing/subscription";
import { accountState, applyImport, saveAnswer as storeAnswer, saveLayers as storeLayers } from "./preferences";

// Each action parses its input, takes the learner from the session (never from the input), and returns a small
// typed result instead of throwing for expected problems.

const layerName = z.enum(["script", "tashkeel", "transliteration", "english"]);
const layersInput = z.partialRecord(layerName, z.boolean());

export type SavePreferenceResult =
  | { ok: true }
  | { ok: false; code: "invalid" | "no-profile" | "unknown-video" };

export async function saveLayers(input: unknown): Promise<SavePreferenceResult> {
  const parsed = z.object({ languageCode: z.string().min(1).max(20), layers: layersInput }).safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const learner = await requireLearner(settingsPath());
  const result = await storeLayers(learner.id, parsed.data.languageCode, parsed.data.layers);
  return result === "ok" ? { ok: true } : { ok: false, code: result };
}

export async function saveAnswer(input: unknown): Promise<SavePreferenceResult> {
  const parsed = z
    .object({ languageCode: z.string().min(1).max(20), videoSlug: z.string().min(1).max(100), answer: understoodSchema })
    .safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const learner = await requireLearner(settingsPath());
  // No answer is stored for a full-access video the learner cannot watch.
  if (await isVideoLocked(learner.id, parsed.data.languageCode, parsed.data.videoSlug)) return { ok: false, code: "invalid" };
  const result = await storeAnswer(learner.id, parsed.data.languageCode, parsed.data.videoSlug, parsed.data.answer);
  return result === "ok" ? { ok: true } : { ok: false, code: result };
}

const MAX_ENTRIES = 2000;
const importInput = z.object({
  layers: z.record(z.string().max(20), z.record(z.string().max(30), z.boolean())),
  answers: z.record(z.string().max(20), z.record(z.string().max(100), understoodSchema)),
});

export type ImportResult =
  | {
      ok: true;
      imported: { layers: number; answers: number };
      /** Safe for the device to forget: moved, already on the account, or not valid. */
      remove: { layers: string[]; answers: { languageCode: string; videoSlug: string }[] };
    }
  | { ok: false; code: "invalid" };

/** Moves transcript choices and answers kept on a device to the account. Safe to run twice. */
export async function importDevicePreferences(input: unknown): Promise<ImportResult> {
  const parsed = importInput.safeParse(input);
  const count = (o: Record<string, Record<string, unknown>>) =>
    Object.values(o).reduce((n, inner) => n + Object.keys(inner).length, 0);
  if (!parsed.success || count(parsed.data.layers) + count(parsed.data.answers) > MAX_ENTRIES) {
    return { ok: false, code: "invalid" };
  }

  const learner = await requireLearner(settingsPath());
  const account = await accountState(learner.id);
  const videosByLanguage = await Promise.all(languages.map(async (l) => [l, (await getVideos(l.slug)).map((v) => v.slug)] as const));
  const merge = mergeDeviceChoices({
    device: parsed.data,
    ...account,
    languages: Object.fromEntries(videosByLanguage.map(([l, videos]) => [l.code, { layers: l.transcriptLayers, videos }])),
  });
  const imported = await applyImport(learner.id, merge);
  return { ok: true, imported, remove: merge.remove };
}
