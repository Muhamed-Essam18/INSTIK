import { emailSchema } from "../auth/email";

export type RoleName = "learner" | "creator" | "owner";

/**
 * The owner list from the OWNER_EMAILS setting: comma separated, trimmed, lower-cased, de-duplicated.
 * Anything that is not a valid email is ignored, and an unset or empty value means no owners.
 */
export function parseOwnerEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  const emails = raw.split(",").flatMap((part) => {
    const parsed = emailSchema.safeParse(part);
    return parsed.success ? [parsed.data] : [];
  });
  return [...new Set(emails)];
}

/**
 * The role of an account. Owner comes only from the list (never stored), so removing an email withdraws the role
 * at the next check; a stored creator role is kept but an email on the list acts as owner.
 */
export function resolveRole(user: { email: string; role: "LEARNER" | "CREATOR" }, ownerEmails: readonly string[]): RoleName {
  if (ownerEmails.includes(user.email.trim().toLowerCase())) return "owner";
  return user.role === "CREATOR" ? "creator" : "learner";
}
