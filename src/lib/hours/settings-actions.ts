"use server";

import { z } from "zod";
import { saveSessionSettings as save } from "./service";
import { settingsPath } from "@/lib/routes";
import { requireLearner } from "@/lib/session";

const input = z
  .object({ remindersOn: z.boolean().optional(), hourSound: z.boolean().optional() })
  .strict()
  .refine((v) => v.remindersOn !== undefined || v.hourSound !== undefined);

/**
 * Saves the learner's session settings. Reminders only store the choice: nothing in this release sends or
 * schedules anything.
 */
export async function saveSessionSettings(raw: unknown): Promise<{ ok: true } | { ok: false; code: "invalid" }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const learner = await requireLearner(settingsPath());
  await save(learner.id, parsed.data);
  return { ok: true };
}
