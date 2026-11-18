"use server";

import { z } from "zod";
import { ownerPath } from "@/lib/routes";
import { requireOwner } from "@/lib/session";
import type { GlossaryRow } from "./glossary";
import { reviewService } from "./instance";
import { INPUT_PROBLEM, decisionResult, refusal, type ReviewReason } from "./messages";
import { checkKeys } from "./rules";
import type { SegmentView } from "./service";

// The owner's review actions (contracts/routes-and-actions.md). Each one checks the owner role again on the server, validates its
// input with zod, and hands over to the review service. None of them returns a Mux id, a token or anyone's email address.

const id = z.string().min(1).max(64);
const seconds = z.number().finite().min(0).max(86_400);
const text = z.string().max(2_000);

type Failure = ReturnType<typeof refusal> | typeof INPUT_PROBLEM;
const fail = (reason: string): Failure => refusal((reason in refusal_reasons ? reason : "invalid") as ReviewReason);
const refusal_reasons: Record<ReviewReason, true> = {
  "not-found": true,
  "not-in-review": true,
  invalid: true,
  overlap: true,
  conflict: true,
  "too-many": true,
  checklist: true,
  "no-transcript": true,
  "not-ready": true,
  "no-stage": true,
  "note-required": true,
  "note-too-long": true,
  exists: true,
  "no-entry": true,
};

export async function setChecklist(input: unknown): Promise<{ ok: true } | Failure> {
  const parsed = z.object({ videoId: id, key: z.enum(checkKeys), checked: z.boolean() }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const actor = await requireOwner(ownerPath());
  const result = await reviewService().setChecklist(actor, parsed.data);
  return result.ok ? { ok: true } : fail(result.reason);
}

export async function setClassification(input: unknown): Promise<{ ok: true } | Failure> {
  const parsed = z.object({ videoId: id, stage: z.string().max(40), access: z.string().max(10) }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const actor = await requireOwner(ownerPath());
  const result = await reviewService().setClassification(actor, parsed.data);
  return result.ok ? { ok: true } : fail(result.reason);
}

export type SavedSegment = { ok: true; segment: SegmentView; entries: Record<string, GlossaryRow> };
export type SegmentFailure = Failure & { problems?: { field: string; message: string }[] };

export async function saveSegment(input: unknown): Promise<SavedSegment | SegmentFailure> {
  const parsed = z
    .object({
      videoId: id,
      segmentId: id.optional(),
      revision: z.int().min(0).optional(),
      start: seconds,
      end: seconds,
      script: text,
      transliteration: text,
      english: text,
    })
    .safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const actor = await requireOwner(ownerPath());
  const result = await reviewService().saveSegment(actor, parsed.data);
  if (result.ok) return result;
  return { ...fail(result.reason), ...("problems" in result ? { problems: [...result.problems] } : {}) };
}

export async function deleteSegment(input: unknown): Promise<{ ok: true } | Failure> {
  const parsed = z.object({ videoId: id, segmentId: id, revision: z.int().min(0) }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const actor = await requireOwner(ownerPath());
  const result = await reviewService().deleteSegment(actor, parsed.data);
  return result.ok ? { ok: true } : fail(result.reason);
}

const vttText = z.string().max(1024 * 1024 + 4096);

export type PreviewResult = { ok: true; count: number; first: number; last: number } | (Failure & { problems?: string[] });

export async function previewVtt(input: unknown): Promise<PreviewResult> {
  const parsed = z.object({ videoId: id, text: vttText }).safeParse(input);
  if (!parsed.success) return { ...INPUT_PROBLEM, problems: ["That file is bigger than 1 MB."] };
  const actor = await requireOwner(ownerPath());
  const result = await reviewService().previewVtt(actor, parsed.data);
  if (result.ok) return { ok: true, count: result.count, first: result.first, last: result.last };
  return { ...fail(result.reason), problems: result.problems };
}

export async function importVtt(input: unknown): Promise<{ ok: true; count: number } | (Failure & { problems?: string[] })> {
  const parsed = z.object({ videoId: id, text: vttText, mode: z.enum(["add", "replace"]) }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const actor = await requireOwner(ownerPath());
  const result = await reviewService().importVtt(actor, parsed.data);
  if (result.ok) return result;
  return { ...fail(result.reason), ...("problems" in result ? { problems: result.problems } : {}) };
}

export async function addGlossaryEntry(input: unknown): Promise<{ ok: true; entry: GlossaryRow } | (Failure & { entry?: GlossaryRow })> {
  const parsed = z.object({ videoId: id, word: z.string().max(400), transliteration: z.string().max(400), english: z.string().max(400) }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const actor = await requireOwner(ownerPath());
  const result = await reviewService().addGlossaryEntry(actor, parsed.data);
  if (result.ok) return result;
  return { ...fail(result.reason), ...("entry" in result ? { entry: result.entry } : {}) };
}

export async function updateGlossaryEntry(input: unknown): Promise<{ ok: true } | Failure> {
  const parsed = z.object({ videoId: id, entryId: id, transliteration: z.string().max(400), english: z.string().max(400) }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const actor = await requireOwner(ownerPath());
  const result = await reviewService().updateGlossaryEntry(actor, parsed.data);
  return result.ok ? { ok: true } : fail(result.reason);
}

export type DecideActionResult = { ok: true; emailSent: boolean; message: string } | Failure;

export async function decide(input: unknown): Promise<DecideActionResult> {
  const parsed = z
    .object({ videoId: id, decision: z.enum(["approve", "changes", "reject"]), note: z.string().max(10_000).nullish() })
    .safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const actor = await requireOwner(ownerPath());
  const result = await reviewService().decide(actor, { videoId: parsed.data.videoId, decision: parsed.data.decision, note: parsed.data.note });
  if (!result.ok) return fail(result.reason);
  return { ok: true, emailSent: result.emailSent, message: decisionResult(parsed.data.decision, result.emailSent, result.creatorName) };
}
