// Creator invitation rules. Pure: no database, no email. Spec FR-005 to FR-010 and FR-031.

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { emailSchema } from "../auth/email";
import { INVITE_LIFETIME_DAYS } from "../routes";

const DAY_MS = 24 * 60 * 60 * 1000;

/** At most this many invitations from one owner in an hour. */
export const INVITES_PER_HOUR = 20;

/** The one-time link token: 32 random bytes, base64url. The token itself is never stored. */
export const newToken = (): string => randomBytes(32).toString("base64url");

/** What is stored in place of the token: its SHA-256 as hex. */
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/** When an invitation created at `createdAt` stops working: exactly 7 days later. */
export const expiryFrom = (createdAt: Date): Date => new Date(createdAt.getTime() + INVITE_LIFETIME_DAYS * DAY_MS);

export type InviteState = "pending" | "used" | "revoked" | "expired";

/** used wins over revoked, which wins over expired; an invitation is expired from its expiry time on. */
export function inviteState(
  invite: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now: Date,
): InviteState {
  if (invite.usedAt) return "used";
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt.getTime() <= now.getTime()) return "expired";
  return "pending";
}

/** Whether two emails are the same address, ignoring case and surrounding spaces. */
export const emailsMatch = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The owner's form: a name of 1 to 120 characters and a valid email (trimmed, lower-cased, at most 254). */
export const inviteInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120, "Keep the name to 120 characters"),
  email: emailSchema,
});

export type InviteInput = z.infer<typeof inviteInputSchema>;

/** A valid host slug from a name, with a numeric suffix when `taken` already has it. Arabic or empty names fall back to "creator". */
export function slugFromName(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/g, "") || "creator";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
