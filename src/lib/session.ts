import "server-only";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { auth } from "@/auth";
import { gateRedirect } from "@/lib/auth/gate";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Profile } from "@/lib/learner/profile-rules";
import type { Actor } from "@/lib/roles/actor";
import { parseOwnerEmails, resolveRole, type RoleName } from "@/lib/roles/rules";
import { addLanguagePath } from "@/lib/routes";

// The Data Access Layer. The proxy only checks that a session cookie exists; this is where the session is
// looked up in the database and where pages and actions get the signed-in learner. Nothing else should call `auth()`.

export type Learner = { id: string; email: string; name: string | null; image: string | null };

/** The signed-in learner, or null. Cached for the request. */
export const getLearner = cache(async (): Promise<Learner | null> => {
  // Auth.js generates random values before it reads the request, which cannot happen while prerendering.
  // Waiting for the request first keeps that work out of the static shell; callers sit behind Suspense.
  await connection();
  const user = (await auth())?.user;
  if (!user?.id || !user.email) return null;
  return { id: user.id, email: user.email, name: user.name ?? null, image: user.image ?? null };
});

/** The signed-in learner, or a redirect to where a signed-out visitor goes for `returnTo`, which they come back to. */
export async function requireLearner(returnTo: string): Promise<Learner> {
  const learner = await getLearner();
  if (learner) return learner;
  const [pathname, ...rest] = returnTo.split("?");
  redirect(gateRedirect(pathname, rest.length ? `?${rest.join("?")}` : ""));
}

/** The learner and their profile for a language, or a redirect to add that language. */
export async function requireProfile(
  languageCode: string,
  returnTo: string,
): Promise<{ learner: Learner; profile: Profile }> {
  const learner = await requireLearner(returnTo);
  const row = await db().learnerLanguage.findUnique({
    where: { userId_languageCode: { userId: learner.id, languageCode } },
  });
  if (!row) redirect(addLanguagePath(languageCode, returnTo));
  return { learner, profile: { languageCode: row.languageCode, stage: row.stage, minutesPerDay: row.minutesPerDay } };
}

/**
 * The signed-in person with their role, or null. Cached for the request. The role is read from the database and the
 * owner list on every request, so removing an email from OWNER_EMAILS takes effect at the next check.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const learner = await getLearner();
  if (!learner) return null;
  const row = await db().user.findUnique({ where: { id: learner.id }, select: { role: true } });
  if (!row) return null;
  const role = resolveRole({ email: learner.email, role: row.role }, parseOwnerEmails(env().OWNER_EMAILS));
  return { id: learner.id, email: learner.email, name: learner.name, role };
});

/**
 * The signed-in person when they have exactly this role. Signed out: a redirect to sign in that comes back to
 * `returnTo`. Any other role: a not-found page, so nobody learns that the area exists.
 */
export async function requireRole(role: RoleName, returnTo: string): Promise<Actor> {
  const actor = await getActor();
  if (!actor) {
    const [pathname, ...rest] = returnTo.split("?");
    redirect(gateRedirect(pathname, rest.length ? `?${rest.join("?")}` : ""));
  }
  if (actor.role !== role) notFound();
  return actor;
}

export const requireOwner = (returnTo: string) => requireRole("owner", returnTo);
export const requireCreator = (returnTo: string) => requireRole("creator", returnTo);
