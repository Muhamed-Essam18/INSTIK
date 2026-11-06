import { z } from "zod";

// The address just asked for, kept in this tab's session storage (never in the URL) so the
// "Check your email" page can offer "Send it again".
const KEY = "instik:v1:last-email";
const schema = z.object({ email: z.string(), returnTo: z.string().optional() });

export type LastEmail = z.infer<typeof schema>;

export function rememberLastEmail(value: LastEmail): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage is blocked: "Send it again" simply falls back to a link to the sign-in page.
  }
}

export function readLastEmail(): LastEmail | undefined {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return undefined;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
