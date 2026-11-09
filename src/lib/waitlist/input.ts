import { parseEmail } from "@/lib/auth/email";
import type { Language } from "@/lib/languages.schema";
import { isWaitlistCode } from "./options";

export type WaitlistInput = { language: unknown; email: unknown; website?: unknown };

export type ParsedWaitlist =
  | { kind: "entry"; language: string; email: string }
  | { kind: "trap" }
  | { kind: "invalid"; code: "invalid-email" | "invalid-language" };

/** Checks what the visitor sent. A filled hidden field means a robot; a bad email or language is a gentle error. */
export function parseWaitlistInput(input: WaitlistInput, languages: readonly Language[]): ParsedWaitlist {
  if (typeof input.website === "string" ? input.website.trim() !== "" : input.website != null) {
    return { kind: "trap" };
  }
  if (!isWaitlistCode(input.language, languages)) return { kind: "invalid", code: "invalid-language" };
  const email = parseEmail(input.email);
  if (!email) return { kind: "invalid", code: "invalid-email" };
  return { kind: "entry", language: input.language, email };
}
