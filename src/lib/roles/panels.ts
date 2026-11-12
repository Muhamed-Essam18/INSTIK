import { creatorPath, ownerPath } from "@/lib/routes";
import type { RoleName } from "./rules";

export type PanelLink = { label: string; href: string };

/**
 * The panel entries the account menu shows for a role. Only a convenience: the pages themselves check the role on the
 * server and show not-found to anyone else, so a missing or extra entry never grants or removes access.
 */
export function panelLinksFor(role: RoleName): PanelLink[] {
  if (role === "owner") return [{ label: "Owner panel", href: ownerPath() }];
  if (role === "creator") return [{ label: "Creator panel", href: creatorPath() }];
  return [];
}
