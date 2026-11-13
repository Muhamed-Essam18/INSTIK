import { hasRole, type Actor } from "@/lib/roles/actor";

/**
 * The one check before a creator starts an upload or submits a video (spec FR-017, constitution XI and XIII). True for a
 * creator, including an owner who is also a creator; false for a learner, an owner who is not a creator, or nobody.
 * Spec 10 extends this so a paused creator cannot upload or submit, so every caller must go through it.
 */
export function canUpload(actor: Pick<Actor, "role" | "isCreator"> | null | undefined): boolean {
  return actor ? hasRole(actor, "creator") : false;
}
