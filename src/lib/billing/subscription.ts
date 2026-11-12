import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { getVideo } from "@/lib/content";
import { env } from "@/lib/env";
import { getLanguageByCode } from "@/lib/languages";
import { canWatch, hasFullAccess, isStale, type SubscriptionFacts } from "./access";
import { syncNow } from "./deps";
import type { BillingPlanName } from "./status";

// The server's view of a learner's subscription. This is where the access rule meets the database.

export type SubscriptionRow = SubscriptionFacts & { plan: BillingPlanName; stripeSubscriptionId: string };

async function readSubscription(userId: string): Promise<SubscriptionRow | null> {
  return db().subscription.findUnique({
    where: { userId },
    select: { status: true, plan: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, stripeSubscriptionId: true },
  });
}

/** A fresh read, for code that has just synced and needs the new row (route handlers). */
export const getFreshSubscription = readSubscription;

/** The learner's subscription row, or null. One indexed read, cached for the request. */
export const getSubscription = cache(readSubscription);

/** True when the learner has Full access now. */
export async function learnerHasFullAccess(userId: string): Promise<boolean> {
  return hasFullAccess(await getSubscription(userId), new Date());
}

export type VideoAccess = { ok: true } | { ok: false; reason: "locked" };

/**
 * Whether the learner may play this video and read its transcript. When the only reason for "no" is the
 * 7-day safety net (a webhook was probably missed), this asks Stripe once and checks again.
 */
export async function requireVideoAccess(learnerId: string, video: { access: string }): Promise<VideoAccess> {
  if (video.access === "free") return { ok: true };
  const now = new Date();
  const row = await getSubscription(learnerId);
  if (canWatch(video, row, now)) return { ok: true };

  const liveStatus = row && (row.status === "ACTIVE" || row.status === "TRIALING" || row.status === "PAST_DUE");
  if (row && liveStatus && isStale(row, now) && env().STRIPE_SECRET_KEY) {
    try {
      await syncNow(row.stripeSubscriptionId);
      const fresh = await readSubscription(learnerId);
      if (canWatch(video, fresh, new Date())) return { ok: true };
    } catch {
      // Stripe could not be reached: stay locked rather than guess.
    }
  }
  return { ok: false, reason: "locked" };
}

/**
 * True when this learner may NOT use the video `videoSlug` of `languageCode`. An unknown language or video is not "locked"
 * (the caller's own validation reports it), so this never turns a missing video into a refusal of its own.
 */
export async function isVideoLocked(learnerId: string, languageCode: string, videoSlug: string): Promise<boolean> {
  const language = getLanguageByCode(languageCode);
  const video = language ? await getVideo(language.slug, videoSlug) : undefined;
  if (!video) return false;
  return !(await requireVideoAccess(learnerId, video)).ok;
}
