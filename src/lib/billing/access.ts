// The access rule. Pure: no database, no Stripe, no `server-only`, so it is tested directly.

export type SubscriptionStatus =
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "PAUSED";

export type SubscriptionFacts = {
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

/** A missed webhook must not give access forever: past this many days after the period end, there is none. */
export const STALE_AFTER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** True when the period ended more than STALE_AFTER_DAYS ago (the safety net). */
export function isStale(subscription: SubscriptionFacts, now: Date): boolean {
  return now.getTime() - subscription.currentPeriodEnd.getTime() > STALE_AFTER_DAYS * DAY_MS;
}

/**
 * True when this learner has Full access at `now`: an owner has given it by hand (`manual`, spec 11), or the subscription gives it.
 * A missing subscription gives none. This is the one access rule: the learner site, settings and counted views all use it.
 */
export function hasFullAccess(subscription: SubscriptionFacts | null | undefined, now: Date, manual = false): boolean {
  if (manual) return true;
  if (!subscription) return false;
  switch (subscription.status) {
    case "ACTIVE": // includes cancelAtPeriodEnd: Stripe keeps it active until the paid period is over
    case "TRIALING":
    case "PAST_DUE": // Stripe is still retrying the renewal
      return !isStale(subscription, now);
    default:
      return false;
  }
}

/** True when the learner may play this video and read its transcript. Anything that is not exactly "free" needs access. */
export function canWatch(
  video: { access: string },
  subscription: SubscriptionFacts | null | undefined,
  now: Date,
  manual = false,
): boolean {
  return video.access === "free" || hasFullAccess(subscription, now, manual);
}

/** The same videos with `locked` set for this learner: true for each one they cannot watch. Order and content are kept. */
export function markLocked<T extends { access: string }>(
  videos: readonly T[],
  subscription: SubscriptionFacts | null | undefined,
  now: Date,
  manual = false,
): (T & { locked: boolean })[] {
  return videos.map((video) => ({ ...video, locked: !canWatch(video, subscription, now, manual) }));
}
