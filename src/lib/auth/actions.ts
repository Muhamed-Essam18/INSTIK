"use server";

import { headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import { isStaffPath, sanitiseReturnTo } from "@/lib/auth/return-to";
import { checkAndRecordSend } from "@/lib/auth/throttle";
import { parseEmail } from "@/lib/auth/email";
import { libraryPath, onboardingFinishPath } from "@/lib/routes";
import { defaultLanguage } from "@/lib/languages";

export type EmailLinkResult = { ok: true } | { ok: false; code: "invalid-email" | "too-many" | "failed" };

const fallbackReturn = () => libraryPath(defaultLanguage.slug);

/** Learners go through the finish step (it turns their onboarding choices into a profile); invitees and the team go straight back. */
const afterSignIn = (returnTo: string) => (isStaffPath(returnTo.split("?")[0]) ? returnTo : onboardingFinishPath(returnTo));

/**
 * Sends a single-use sign-in link. The answer is the same whether or not the address already has an account,
 * so nobody can use this to find out who is registered.
 */
export async function requestEmailLink(input: { email: unknown; returnTo?: unknown }): Promise<EmailLinkResult> {
  const email = parseEmail(input.email);
  if (!email) return { ok: false, code: "invalid-email" };

  const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  const limit = await checkAndRecordSend(email, forwarded || "unknown");
  if (!limit.ok) return limit;

  const returnTo = sanitiseReturnTo(input.returnTo, fallbackReturn());
  try {
    await signIn("resend", { email, redirect: false, redirectTo: afterSignIn(returnTo) });
  } catch {
    return { ok: false, code: "failed" };
  }
  return { ok: true };
}

/** Starts Google sign-in; Google sends the learner back to the finish page, which returns them to `returnTo`. */
export async function signInWithGoogle(input: { returnTo?: unknown }): Promise<void> {
  const returnTo = sanitiseReturnTo(input.returnTo, fallbackReturn());
  await signIn("google", { redirectTo: afterSignIn(returnTo) });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
