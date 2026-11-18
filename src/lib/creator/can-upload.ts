import { hasRole, type Actor } from "@/lib/roles/actor";

/**
 * The one check before a creator writes anything (upload, draft, submit, delete a draft, host page; spec FR-017 and
 * spec 10 FR-026, constitution XI and XIII). True for an active creator, including an owner who is also a creator; false
 * for a learner, an owner who is not a creator, nobody, or a creator an owner has paused (an owner who is also a paused
 * creator is refused creator writes too). Reading stays allowed, so callers of reads do not use this.
 */
export function canUpload(actor: Pick<Actor, "role" | "isCreator" | "paused"> | null | undefined): boolean {
  return actor ? hasRole(actor, "creator") && actor.paused !== true : false;
}
