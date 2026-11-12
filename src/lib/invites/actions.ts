"use server";

import { ownerCreatorsPath } from "@/lib/routes";
import { getLearner, requireOwner } from "@/lib/session";
import { inviteService } from "./instance";
import { acceptMessage, createMessage, type InviteFormResult } from "./messages";

// Server actions for the owner's invite form and the invitation page. Every one checks the role again on the server
// (the DAL) and none of them ever returns the token.

/** Invites a creator by name and email. Owners only. */
export async function createInvite(input: { name: unknown; email: unknown }): Promise<InviteFormResult> {
  const actor = await requireOwner(ownerCreatorsPath());
  const result = await inviteService().createInvite({
    actor,
    name: typeof input.name === "string" ? input.name : "",
    email: typeof input.email === "string" ? input.email : "",
  });
  return result.ok ? { ok: true } : { ok: false, ...createMessage(result) };
}

/** Revokes a pending invitation. Owners only. */
export async function revokeInvite(inviteId: unknown): Promise<{ ok: boolean; message?: string }> {
  const actor = await requireOwner(ownerCreatorsPath());
  if (typeof inviteId !== "string" || inviteId.length === 0 || inviteId.length > 64) return { ok: false, message: "Couldn't find that invitation." };
  const result = await inviteService().revokeInvite({ actor, inviteId });
  if (result.ok) return { ok: true };
  return { ok: false, message: result.reason === "not-pending" ? "That invitation is no longer pending." : "Couldn't find that invitation." };
}

/** Accepts an invitation for the signed-in account: they become a creator and get their host page. */
export async function acceptInvite(token: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const learner = await getLearner();
  if (!learner) return { ok: false, message: acceptMessage("signed-out") };
  if (typeof token !== "string" || token.length < 20 || token.length > 64) return { ok: false, message: acceptMessage("invalid") };
  const result = await inviteService().acceptInvite({ account: { id: learner.id, email: learner.email }, token });
  return result.ok ? { ok: true } : { ok: false, message: acceptMessage(result.reason) };
}
