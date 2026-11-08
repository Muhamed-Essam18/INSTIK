"use server";

import { z } from "zod";
import { isValidTimeZone } from "./days";
import { manualTimeSchema } from "./manual-time";
import * as service from "./service";
import { requireLearner } from "@/lib/session";
import { roadmapPath } from "@/lib/routes";
import { getLanguageByCode } from "@/lib/languages";

// Each action parses its input, takes the learner from the session (never from the input), and returns a small
// typed result instead of throwing for expected problems. See specs/005-honest-hours/contracts/server-actions.md.

const timeZone = z.string().refine(isValidTimeZone);

const heartbeatInput = z.object({
  languageCode: z.string().min(1).max(20),
  videoSlug: z.string().min(1).max(120),
  seconds: z.number().min(0).max(20),
  spanSeconds: z.number().min(0).max(20),
  endedAgoSeconds: z.number().min(0).max(86_400),
  position: z.number().min(0).max(1_000_000),
  duration: z.number().min(0).max(1_000_000),
  timeZone,
});

export type HeartbeatActionResult =
  | { ok: true; accepted: number; totalSeconds: number; todaySeconds: number; stage: string; chime: boolean }
  | { ok: false; code: "no-profile" | "unknown-video" | "invalid" | "rejected" };

/** Records one counted interval of watching. The server decides how much of it to accept. */
export async function recordHeartbeat(input: unknown): Promise<HeartbeatActionResult> {
  const parsed = heartbeatInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const language = getLanguageByCode(parsed.data.languageCode);
  const learner = await requireLearner(language ? roadmapPath(language.slug) : "/");
  const { duration: _clientDuration, ...rest } = parsed.data; // the server uses the video's real length
  void _clientDuration;
  return service.recordHeartbeat({ userId: learner.id, ...rest });
}

const endInput = z.object({ languageCode: z.string().min(1).max(20), videoSlug: z.string().min(1).max(120) });

export type EndOfVideoActionResult =
  | { ok: true; showDone: boolean }
  | { ok: false; code: "no-profile" | "unknown-video" | "invalid" };

/** Called after the last heartbeat when a video ends: should Done for today follow? */
export async function endOfVideo(input: unknown): Promise<EndOfVideoActionResult> {
  const parsed = endInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const language = getLanguageByCode(parsed.data.languageCode);
  const learner = await requireLearner(language ? roadmapPath(language.slug) : "/");
  return service.endOfVideo({ userId: learner.id, ...parsed.data });
}

export type ManualActionResult =
  | { ok: true; totalSeconds: number; stage: string }
  | { ok: false; code: "invalid-minutes" | "invalid-date" | "too-many" | "no-profile" | "invalid" };

/** Adds time spent outside Instik. It is stored as the learner's own entry and shown as "Added by you". */
export async function addManualTime(input: unknown): Promise<ManualActionResult> {
  const parsed = manualTimeSchema.safeParse(input);
  if (!parsed.success) {
    // Say which field was wrong so the form can put the message next to it.
    const issue = parsed.error.issues[0]?.path[0];
    if (issue === "minutes") return { ok: false, code: "invalid-minutes" };
    if (issue === "day") return { ok: false, code: "invalid-date" };
    return { ok: false, code: "invalid" };
  }
  if (!isValidTimeZone(parsed.data.timeZone)) return { ok: false, code: "invalid" };
  const language = getLanguageByCode(parsed.data.languageCode);
  const learner = await requireLearner(language ? roadmapPath(language.slug) : "/");
  return service.addManualTime({ userId: learner.id, ...parsed.data });
}

export type RemoveActionResult = { ok: true; totalSeconds: number; languageCode: string } | { ok: false; code: "not-found" | "invalid" };

/** Removes one of the learner's own added entries. Never moves the stage back. */
export async function removeManualTime(input: unknown): Promise<RemoveActionResult> {
  const parsed = z.object({ id: z.string().min(1).max(40) }).safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const learner = await requireLearner("/");
  return service.removeManualTime({ userId: learner.id, id: parsed.data.id });
}

/** Stores the browser's time zone so days are placed correctly. */
export async function syncTimeZone(input: unknown): Promise<{ ok: true; changed: boolean } | { ok: false; code: "invalid" }> {
  const parsed = z.object({ timeZone }).safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const learner = await requireLearner("/");
  const { changed } = await service.syncTimeZone(learner.id, parsed.data.timeZone);
  return { ok: true, changed };
}
