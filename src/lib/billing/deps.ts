import "server-only";
import { stripe } from "./stripe";
import { syncStore } from "./store";
import { syncSubscription, type SyncDeps } from "./sync";

/** The real Stripe client and database store, for the sync. Built on use, so nothing needs configuring at import time. */
export function liveSyncDeps(): SyncDeps {
  return {
    stripe: { retrieveSubscription: (id) => stripe().subscriptions.retrieve(id) },
    store: syncStore,
    now: () => new Date(),
  };
}

/** Syncs one subscription from Stripe now. */
export function syncNow(subscriptionId: string) {
  return syncSubscription(subscriptionId, liveSyncDeps());
}
