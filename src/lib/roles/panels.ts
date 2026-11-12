import { creatorPath, ownerPath } from "@/lib/routes";
import type { Actor } from "./actor";
import { hasRole } from "./actor";

export type PanelLink = { label: string; href: string };

/**
 * The panel entries the account menu shows: Creator panel for a creator, Owner panel for an owner, both for someone who is
 * both, none for a learner. Only a convenience: the pages check the role on the server and show not-found to anyone else.
 */
export function panelLinksFor(actor: Pick<Actor, "role" | "isCreator">): PanelLink[] {
  const links: PanelLink[] = [];
  if (hasRole(actor, "creator")) links.push({ label: "Creator panel", href: creatorPath() });
  if (actor.role === "owner") links.push({ label: "Owner panel", href: ownerPath() });
  return links;
}
