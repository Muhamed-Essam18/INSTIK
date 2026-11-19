"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { REQUEST_CLOSED, REQUEST_POSTED, REQUEST_SAVED, requestRefusal } from "./messages";
import { requestsService } from "./instance";
import { ownerRequestsPath } from "@/lib/routes";
import { requireOwner } from "@/lib/session";

// The owner's content request actions. Each one checks the owner role again on the server, validates its input with zod and never takes an actor,
// a role or a user id from its input. After a change it expires the creators' cached dashboards (updateTag works only inside a server action).

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const INPUT_PROBLEM = { ok: false, message: "Something didn't go through. Please try again." } as const;
const body = { stage: z.string().max(40), topic: z.string().max(40), text: z.string().max(400) };
const id = z.string().min(1).max(64);

export async function createRequest(input: unknown): Promise<ActionResult> {
  const actor = await requireOwner(ownerRequestsPath());
  const parsed = z.object(body).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const result = await requestsService().createRequest(actor, parsed.data);
  if (!result.ok) return { ok: false, message: requestRefusal(result.reason) };
  updateTag("creator-requests");
  return { ok: true, message: REQUEST_POSTED };
}

export async function editRequest(input: unknown): Promise<ActionResult> {
  const actor = await requireOwner(ownerRequestsPath());
  const parsed = z.object({ id, ...body }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const result = await requestsService().editRequest(actor, parsed.data);
  if (!result.ok) return { ok: false, message: requestRefusal(result.reason) };
  updateTag("creator-requests");
  return { ok: true, message: REQUEST_SAVED };
}

export async function closeRequest(input: unknown): Promise<ActionResult> {
  const actor = await requireOwner(ownerRequestsPath());
  const parsed = z.object({ id }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const result = await requestsService().closeRequest(actor, parsed.data);
  if (!result.ok) return { ok: false, message: requestRefusal(result.reason) };
  updateTag("creator-requests");
  return { ok: true, message: REQUEST_CLOSED };
}
