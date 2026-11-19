import { hasFullAccess, type SubscriptionFacts } from "@/lib/billing/access";

// The counted-view rule (spec 11, docs/product.md "Creator earnings"). Pure: no database, no clock except what is passed in.
//
// A view counts when a learner's honest watch time on one video, on one day, reaches 30 seconds; the learner has active
// Full access at that moment (a paid subscription or a manual grant); and they are not the video's own creator.
// "Once per learner per video per day" is kept by a unique key where the view is stored, not by this module.

export const COUNTED_VIEW_SECONDS = 30;

/** True only for the heartbeat that takes the day's seconds from below 30 to 30 or more. */
export const crossesThreshold = (before: number, added: number): boolean =>
  added > 0 && before < COUNTED_VIEW_SECONDS && before + added >= COUNTED_VIEW_SECONDS;

export type CountInput = {
  learnerId: string;
  /** The video's creator (the host's account), or null for a video that has none (imported sample videos). */
  creatorId: string | null | undefined;
  subscription: SubscriptionFacts | null | undefined;
  /** An owner has given the learner Full access by hand. */
  manual: boolean;
  now: Date;
};

/**
 * Whether a view that has just crossed the threshold counts for the creator. Uses the one access rule (`hasFullAccess`), not
 * `canWatch`: a free learner can watch a free video, but only a learner with active Full access earns the creator a view.
 */
export function countsAsView(input: CountInput): boolean {
  if (!input.creatorId) return false;
  if (input.learnerId === input.creatorId) return false;
  return hasFullAccess(input.subscription, input.now, input.manual);
}
