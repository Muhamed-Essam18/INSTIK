"use server";

import { z } from "zod";
import { ownerCreatorsPath } from "@/lib/routes";
import { requireOwner } from "@/lib/session";
import { creatorsService } from "./instance";

// The owner's pause and resume actions. Each checks the owner role again on the server and validates its input with zod.

const id = z.string().min(1).max(64);
const NOT_A_CREATOR = { ok: false, message: "We couldn't find that creator." } as const;
const INPUT_PROBLEM = { ok: false, message: "Something went wrong. Please try again." } as const;

export async function pauseCreator(input: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z.object({ creatorId: id }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const actor = await requireOwner(ownerCreatorsPath());
  const result = await creatorsService().pauseCreator(actor, parsed.data.creatorId);
  return result.ok ? { ok: true } : NOT_A_CREATOR;
}

export async function resumeCreator(input: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z.object({ creatorId: id }).safeParse(input);
  if (!parsed.success) return INPUT_PROBLEM;
  const actor = await requireOwner(ownerCreatorsPath());
  const result = await creatorsService().resumeCreator(actor, parsed.data.creatorId);
  return result.ok ? { ok: true } : NOT_A_CREATOR;
}
