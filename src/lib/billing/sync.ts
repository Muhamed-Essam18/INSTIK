import type { SubscriptionStatus } from "./access";
import { parseCheckoutSession, parseEventEnvelope, parseInvoice, parseSubscription } from "./schemas";
import { mapSubscription, type MappedSubscription } from "./status";

// Keeps our Subscription row in step with Stripe. Every subscription event leads here, and this always re-reads the
// subscription from Stripe, so a duplicate or out-of-order event cannot leave a stale status. Pure of Stripe and the
// database: both come in through `deps`, which is how the tests run it with fakes.

export type StoredSubscription = {
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  stripeCreatedAt: Date;
  syncedAt: Date;
};

export type SyncStore = {
  findUserIdByCustomer(customerId: string): Promise<string | null>;
  userExists(userId: string): Promise<boolean>;
  /** Remembers the Stripe customer on the learner when it is not set yet (best effort). */
  linkCustomer(userId: string, customerId: string): Promise<void>;
  getByUserId(userId: string): Promise<StoredSubscription | null>;
  /** Inserts the row. False when a row for this learner or subscription already exists. */
  insert(userId: string, mapped: MappedSubscription, startedAt: Date): Promise<boolean>;
  /** Overwrites the learner's row only if its `syncedAt` still equals `expectedSyncedAt` (compare and swap). */
  replaceIf(userId: string, expectedSyncedAt: Date, mapped: MappedSubscription, startedAt: Date): Promise<boolean>;
};

export type SyncDeps = {
  stripe: { retrieveSubscription(id: string): Promise<unknown> };
  store: SyncStore;
  now: () => Date;
};

export type SyncResult =
  | { outcome: "applied"; userId: string }
  | { outcome: "stale"; userId: string }
  | { outcome: "duplicate-active"; userId: string }
  | { outcome: "unmatched" };

export type UpsertDecision = "insert" | "update" | "replace" | "stale" | "duplicate-active";

const ended: readonly SubscriptionStatus[] = ["CANCELED", "INCOMPLETE_EXPIRED"];
const activeish: readonly SubscriptionStatus[] = ["ACTIVE", "TRIALING", "PAST_DUE"];

/**
 * Which write, if any, a fresh Stripe read earns, given the stored row.
 * - none stored: insert
 * - same subscription: update, unless an even later read already wrote
 * - a different subscription: replaces the row only if the stored one has ended and the new one is not older;
 *   a second active subscription beside a live one is flagged and never replaces it
 */
export function decideUpsert(
  stored: StoredSubscription | null,
  mapped: MappedSubscription,
  startedAt: Date,
): UpsertDecision {
  if (!stored) return "insert";
  if (stored.stripeSubscriptionId === mapped.stripeSubscriptionId) {
    return stored.syncedAt.getTime() > startedAt.getTime() ? "stale" : "update";
  }
  if (ended.includes(stored.status)) {
    return mapped.stripeCreatedAt.getTime() >= stored.stripeCreatedAt.getTime() ? "replace" : "stale";
  }
  return activeish.includes(mapped.status) ? "duplicate-active" : "stale";
}

/** Logs the event id and type only, never a payload. */
function warn(message: string, detail: Record<string, string>) {
  console.warn(`[billing] ${message}`, detail);
}

export async function syncSubscription(subscriptionId: string, deps: SyncDeps): Promise<SyncResult> {
  const startedAt = deps.now();
  const raw = await deps.stripe.retrieveSubscription(subscriptionId); // a Stripe error propagates, so the route answers 500
  const parsed = parseSubscription(raw);
  const mapped = parsed.ok ? mapSubscription(parsed.data) : null;
  if (!mapped) {
    warn("subscription could not be read", { subscription: subscriptionId });
    return { outcome: "unmatched" };
  }

  let userId = await deps.store.findUserIdByCustomer(mapped.customerId);
  if (!userId && mapped.metadataUserId && (await deps.store.userExists(mapped.metadataUserId))) {
    userId = mapped.metadataUserId;
    await deps.store.linkCustomer(userId, mapped.customerId);
  }
  if (!userId) {
    warn("subscription matches no learner", { subscription: subscriptionId });
    return { outcome: "unmatched" };
  }

  // Compare and swap, retried a few times if another handler wrote in between.
  for (let attempt = 0; attempt < 3; attempt++) {
    const stored = await deps.store.getByUserId(userId);
    const decision = decideUpsert(stored, mapped, startedAt);
    if (decision === "stale") return { outcome: "stale", userId };
    if (decision === "duplicate-active") {
      warn("second active subscription for a learner", { subscription: subscriptionId });
      return { outcome: "duplicate-active", userId };
    }
    const written =
      decision === "insert"
        ? await deps.store.insert(userId, mapped, startedAt)
        : await deps.store.replaceIf(userId, stored!.syncedAt, mapped, startedAt);
    if (written) return { outcome: "applied", userId };
  }
  throw new Error("Could not write the subscription after several attempts");
}

export type EventOutcome = { outcome: "PROCESSED" | "IGNORED" | "UNMATCHED"; objectId?: string };

/** Handles one verified event. A Stripe or database error propagates. */
export async function applyEvent(event: unknown, deps: SyncDeps): Promise<EventOutcome> {
  const envelope = parseEventEnvelope(event);
  if (!envelope.ok) {
    warn("event could not be read", {});
    return { outcome: "UNMATCHED" };
  }
  const { id, type, data } = envelope.data;
  const object = data.object;

  let subscriptionId: string | null | undefined;
  switch (type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      subscriptionId = object.id;
      break;
    case "checkout.session.completed": {
      const session = parseCheckoutSession(object);
      if (!session.ok) {
        warn("checkout session could not be read", { event: id, type });
        return { outcome: "UNMATCHED" };
      }
      subscriptionId = session.data.subscription; // a one-time payment has none, and is ignored
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = parseInvoice(object);
      if (!invoice.ok) {
        warn("invoice could not be read", { event: id, type });
        return { outcome: "UNMATCHED" };
      }
      subscriptionId = invoice.data.parent?.subscription_details?.subscription;
      break;
    }
    default:
      return { outcome: "IGNORED" };
  }

  if (!subscriptionId) return { outcome: "IGNORED" };
  const result = await syncSubscription(subscriptionId, deps);
  const handled = result.outcome === "applied" || result.outcome === "stale";
  return { outcome: handled ? "PROCESSED" : "UNMATCHED", objectId: subscriptionId };
}
