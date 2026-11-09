"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { languages } from "@/lib/languages";
import { parseWaitlistInput } from "./input";
import { checkAndRecordWaitlist } from "./throttle";

export type JoinWaitlistResult =
  | { ok: true }
  | { ok: false; code: "invalid-email" | "invalid-language" | "too-many" | "failed" };

/**
 * Adds an email to the waitlist for one language. A pair that is already listed is a success too, and the answer is
 * the same either way, so nobody can use this to find out who is on the list. No email is sent.
 */
export async function joinWaitlist(input: {
  language: unknown;
  email: unknown;
  website?: unknown;
}): Promise<JoinWaitlistResult> {
  const parsed = parseWaitlistInput(input ?? {}, languages);
  if (parsed.kind === "trap") return { ok: true };
  if (parsed.kind === "invalid") return { ok: false, code: parsed.code };

  try {
    const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
    const limit = await checkAndRecordWaitlist(forwarded || "unknown");
    if (!limit.ok) return limit;
    await db().waitlistEntry.createMany({
      data: [{ languageCode: parsed.language, email: parsed.email }],
      skipDuplicates: true,
    });
  } catch {
    return { ok: false, code: "failed" };
  }
  return { ok: true };
}
