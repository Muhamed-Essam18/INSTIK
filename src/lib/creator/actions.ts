"use server";

import { z } from "zod";
import { requireCreator } from "@/lib/session";
import { creatorHostPath, creatorUploadPath } from "@/lib/routes";
import { hostService, uploadService } from "./instance";
import { INPUT_PROBLEM, failureMessage, hostFailureMessage, type ActionFailure } from "./messages";
import { PHOTO_MAX_BYTES } from "./host-rules";
import { CHECKLIST_ITEMS, DESCRIPTION_MAX, TITLE_MAX } from "./rules";

// The creator's server actions (contracts/routes-and-actions.md). Each one checks the creator role again on the server, validates its
// input with zod, and hands over to the upload service, which does the rest. None of them ever returns a Mux id.

const id = z.string().min(1).max(64);
const optionalText = (max: number) => z.string().max(max).nullish();

const detailsSchema = z.object({
  title: optionalText(TITLE_MAX * 2),
  description: optionalText(DESCRIPTION_MAX * 2),
  proposedStage: optionalText(40),
  topic: optionalText(40),
});

export type StartedUpload = { ok: true; videoId: string; uploadUrl: string };

/** Starts the one-time upload link for a first file, or for a new version of a video in Changes requested. */
export async function createUpload(input: unknown): Promise<StartedUpload | ActionFailure> {
  const parsed = z.object({ videoId: id.optional(), kind: z.enum(["first", "newVersion"]), details: detailsSchema.optional() }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const actor = await requireCreator(creatorUploadPath());
  const result = await uploadService().createUpload(actor, parsed.data);
  return result.ok ? { ok: true, videoId: result.videoId, uploadUrl: result.uploadUrl } : failureMessage(result);
}

/** Saves what is filled in so far, as a draft (made now if there is none yet). */
export async function saveDraft(input: unknown): Promise<{ ok: true; videoId: string } | ActionFailure> {
  const parsed = z.object({ videoId: id.optional(), details: detailsSchema }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const actor = await requireCreator(creatorUploadPath());
  const result = await uploadService().saveDraft(actor, parsed.data);
  return result.ok ? result : failureMessage(result);
}

/** Submits a video for review. Everything missing is named; a video whose file is not ready yet is remembered and goes on its own. */
export async function submitVideo(input: unknown): Promise<{ ok: true; videoId: string; completed: boolean } | ActionFailure> {
  const parsed = z
    .object({ videoId: id, details: detailsSchema, checklist: z.array(z.boolean()).length(CHECKLIST_ITEMS.length) })
    .safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const actor = await requireCreator(creatorUploadPath());
  const result = await uploadService().submitVideo(actor, parsed.data);
  return result.ok ? result : failureMessage(result);
}

/** Deletes a draft: it is hidden, its history is kept and its file at the video host is deleted. */
export async function deleteDraft(input: unknown): Promise<{ ok: true } | ActionFailure> {
  const parsed = z.object({ videoId: id }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const actor = await requireCreator(creatorUploadPath());
  const result = await uploadService().deleteDraft(actor, parsed.data.videoId);
  return result.ok ? result : failureMessage(result);
}

export type HostActionFailure = ActionFailure;

/** Saves the host page: names in Latin and Arabic, the short story and the topics. */
export async function saveHost(input: unknown): Promise<{ ok: true } | HostActionFailure> {
  const parsed = z
    .object({ name: z.string().max(200), nameArabic: z.string().max(200), story: z.string().max(2000), topics: z.array(z.string().max(100)).max(50) })
    .safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const actor = await requireCreator(creatorHostPath());
  const result = await hostService().saveHost(actor, parsed.data);
  return result.ok ? result : hostFailureMessage(result);
}

/** Replaces the host photo. The file is checked by what it really is, not by its name or declared type, and by size. */
export async function uploadHostPhoto(formData: FormData): Promise<{ ok: true; photo: string } | HostActionFailure> {
  const file = formData.get("photo");
  if (!(file instanceof File)) return INPUT_PROBLEM;
  const actor = await requireCreator(creatorHostPath());
  // A file far over the limit is refused before it is read into memory.
  if (file.size > PHOTO_MAX_BYTES) return hostFailureMessage({ ok: false, reason: "photo", message: "That photo is over 2 MB. Please choose a smaller one." });
  const result = await hostService().uploadPhoto(actor, new Uint8Array(await file.arrayBuffer()));
  return result.ok ? result : hostFailureMessage(result);
}
