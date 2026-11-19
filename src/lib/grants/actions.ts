"use server";

import { z } from "zod";
import { grantDone, grantRefusal, removeDone, removeRefusal } from "./messages";
import { grantsService } from "./instance";
import { ownerAccessPath } from "@/lib/routes";
import { requireOwner } from "@/lib/session";

// The owner's manual access actions. Each one checks the owner role again on the server, validates its input with zod, and never takes an
// actor, a role or a user id from its input: the account is found by the email the owner typed.

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const INPUT_PROBLEM = { ok: false, message: "Something didn't go through. Please try again." } as const;
const email = z.string().trim().min(1).max(254);
const note = z.string().max(400).optional();

export async function grantAccess(input: unknown): Promise<ActionResult> {
  const actor = await requireOwner(ownerAccessPath());
  const parsed = z.object({ email, reason: z.enum(["TESTING", "CREATOR", "GIFT", "OTHER"]), note }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const result = await grantsService().grantAccess(actor, parsed.data);
  return result.ok ? { ok: true, message: grantDone(result.email) } : { ok: false, message: grantRefusal(result.reason) };
}

export async function removeAccess(input: unknown): Promise<ActionResult> {
  const actor = await requireOwner(ownerAccessPath());
  const parsed = z.object({ email, note }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const result = await grantsService().removeAccess(actor, parsed.data);
  return result.ok ? { ok: true, message: removeDone(result.email) } : { ok: false, message: removeRefusal(result.reason) };
}
