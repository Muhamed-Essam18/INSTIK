import { z } from "zod";

/** An email address as the learner typed it: trimmed, lower-cased, valid and at most 254 characters. */
export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

export function parseEmail(value: unknown): string | undefined {
  const result = emailSchema.safeParse(value);
  return result.success ? result.data : undefined;
}
