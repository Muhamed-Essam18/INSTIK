import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasFullAccess } from "@/lib/billing/access";
import { applyEvent, decideUpsert, syncSubscription, type StoredSubscription, type SyncDeps } from "@/lib/billing/sync";
import type { MappedSubscription } from "@/lib/billing/status";
import {
  checkoutSessionFixture,
  DAY_SECONDS,
  eventFixture,
  subscriptionFixture,
  T_START,
} from "../../helpers/stripe-fixtures";

type Row = MappedSubscription & { userId: string; syncedAt: Date };

function fakeWorld(subscriptions: Record<string, unknown>, clock: { now: Date }) {
  const users = new Map<string, { stripeCustomerId: string | null }>([["user-a", { stripeCustomerId: "cus_1" }], ["user-b", { stripeCustomerId: null }]]);
  const rows = new Map<string, Row>();
  const calls: string[] = [];
  const deps: SyncDeps = {
    now: () => clock.now,
    stripe: {
      retrieveSubscription: async (id) => {
        calls.push(`retrieve:${id}`);
        if (!(id in subscriptions)) throw new Error("stripe is down");
        return subscriptions[id];
      },
    },
    store: {
      async findUserIdByCustomer(customerId) {
        return [...users].find(([, u]) => u.stripeCustomerId === customerId)?.[0] ?? null;
      },
      async userExists(userId) {
        return users.has(userId);
      },
      async linkCustomer(userId, customerId) {
        const user = users.get(userId);
        if (user && !user.stripeCustomerId) user.stripeCustomerId = customerId;
      },
      async getByUserId(userId): Promise<StoredSubscription | null> {
        return rows.get(userId) ?? null;
      },
      async insert(userId, mapped, startedAt) {
        if (rows.has(userId)) return false;
        rows.set(userId, { ...mapped, userId, syncedAt: startedAt });
        return true;
      },
      async replaceIf(userId, expected, mapped, startedAt) {
        const row = rows.get(userId);
        if (!row || row.syncedAt.getTime() !== expected.getTime()) return false;
        rows.set(userId, { ...mapped, userId, syncedAt: startedAt });
        return true;
      },
    },
  };
  return { deps, rows, users, calls };
}

const at = (iso: string) => ({ now: new Date(iso) });

describe("syncSubscription", () => {
  let clock: { now: Date };
  beforeEach(() => {
    clock = at("2025-11-02T10:00:00Z");
  });

  it("inserts a row for a matched learner", async () => {
    const world = fakeWorld({ sub_1: subscriptionFixture() }, clock);
    expect(await syncSubscription("sub_1", world.deps)).toEqual({ outcome: "applied", userId: "user-a" });
    expect(world.rows.get("user-a")).toMatchObject({ stripeSubscriptionId: "sub_1", status: "ACTIVE", plan: "MONTHLY" });
  });

  it("gives one row and the same result when the same subscription is synced five times", async () => {
    const world = fakeWorld({ sub_1: subscriptionFixture() }, clock);
    for (let i = 0; i < 5; i++) {
      clock.now = new Date(clock.now.getTime() + 1000);
      expect((await syncSubscription("sub_1", world.deps)).outcome).toBe("applied");
    }
    expect(world.rows.size).toBe(1);
  });

  it("writes nothing when an older read arrives after a newer one", async () => {
    const world = fakeWorld({ sub_1: subscriptionFixture({ status: "active" }) }, at("2025-11-02T10:00:10Z"));
    await syncSubscription("sub_1", world.deps);
    // a slower handler that started earlier now finishes with an older read
    const old = fakeWorld({ sub_1: subscriptionFixture({ status: "past_due" }) }, at("2025-11-02T10:00:00Z"));
    old.rows.set("user-a", world.rows.get("user-a")!);
    expect((await syncSubscription("sub_1", old.deps)).outcome).toBe("stale");
    expect(old.rows.get("user-a")!.status).toBe("ACTIVE");
  });

  it("ends access when the subscription is deleted", async () => {
    const world = fakeWorld({ sub_1: subscriptionFixture() }, clock);
    await syncSubscription("sub_1", world.deps);
    world.deps.stripe.retrieveSubscription = async () => subscriptionFixture({ status: "canceled" });
    clock.now = new Date("2025-11-03T00:00:00Z");
    await syncSubscription("sub_1", world.deps);
    const row = world.rows.get("user-a")!;
    expect(row.status).toBe("CANCELED");
    expect(hasFullAccess(row, clock.now)).toBe(false);
  });

  it("keeps access when set to cancel at period end", async () => {
    const world = fakeWorld({ sub_1: subscriptionFixture({ cancel_at_period_end: true }) }, clock);
    await syncSubscription("sub_1", world.deps);
    const row = world.rows.get("user-a")!;
    expect(row.cancelAtPeriodEnd).toBe(true);
    expect(hasFullAccess(row, clock.now)).toBe(true);
  });

  it("records an unknown customer as unmatched and writes nothing", async () => {
    const world = fakeWorld({ sub_9: subscriptionFixture({ id: "sub_9", customer: "cus_unknown", metadata: {} }) }, clock);
    expect(await syncSubscription("sub_9", world.deps)).toEqual({ outcome: "unmatched" });
    expect(world.rows.size).toBe(0);
  });

  it("matches by metadata and links the customer when the customer is not stored yet", async () => {
    const world = fakeWorld(
      { sub_2: subscriptionFixture({ id: "sub_2", customer: "cus_2", metadata: { userId: "user-b" } }) },
      clock,
    );
    expect(await syncSubscription("sub_2", world.deps)).toEqual({ outcome: "applied", userId: "user-b" });
    expect(world.users.get("user-b")!.stripeCustomerId).toBe("cus_2");
  });

  it("does not trust metadata that names no learner", async () => {
    const world = fakeWorld(
      { sub_2: subscriptionFixture({ id: "sub_2", customer: "cus_2", metadata: { userId: "nobody" } }) },
      clock,
    );
    expect((await syncSubscription("sub_2", world.deps)).outcome).toBe("unmatched");
  });

  it("stores no access for an unknown Stripe status", async () => {
    const world = fakeWorld({ sub_1: subscriptionFixture({ status: "brand_new_status" }) }, clock);
    await syncSubscription("sub_1", world.deps);
    expect(hasFullAccess(world.rows.get("user-a")!, clock.now)).toBe(false);
  });

  it("records a payload missing a required field as unmatched and changes nothing", async () => {
    const world = fakeWorld({ sub_1: subscriptionFixture({ items: { data: [] } }) }, clock);
    expect(await syncSubscription("sub_1", world.deps)).toEqual({ outcome: "unmatched" });
    expect(world.rows.size).toBe(0);
  });

  it("lets a Stripe error propagate", async () => {
    const world = fakeWorld({}, clock);
    await expect(syncSubscription("sub_1", world.deps)).rejects.toThrow("stripe is down");
  });
});

describe("a different subscription for the same learner", () => {
  const later = (days: number) => T_START + days * DAY_SECONDS;
  const make = (id: string, status: string, createdDays: number) =>
    subscriptionFixture({ id, status, created: later(createdDays) });

  it("a newer subscription replaces an ended row", async () => {
    const clock = at("2025-12-20T00:00:00Z");
    const world = fakeWorld({ sub_1: make("sub_1", "canceled", 0), sub_2: make("sub_2", "active", 40) }, clock);
    await syncSubscription("sub_1", world.deps);
    clock.now = new Date("2025-12-21T00:00:00Z");
    expect((await syncSubscription("sub_2", world.deps)).outcome).toBe("applied");
    expect(world.rows.get("user-a")).toMatchObject({ stripeSubscriptionId: "sub_2", status: "ACTIVE" });
  });

  it("a late event for an older ended subscription does not overwrite the newer row", async () => {
    const clock = at("2025-12-20T00:00:00Z");
    const world = fakeWorld({ sub_1: make("sub_1", "canceled", 0), sub_2: make("sub_2", "active", 40) }, clock);
    await syncSubscription("sub_2", world.deps);
    clock.now = new Date("2025-12-21T00:00:00Z");
    expect((await syncSubscription("sub_1", world.deps)).outcome).toBe("stale");
    expect(world.rows.get("user-a")).toMatchObject({ stripeSubscriptionId: "sub_2", status: "ACTIVE" });
  });

  it("a second active subscription is flagged and the stored row is unchanged", async () => {
    const clock = at("2025-12-20T00:00:00Z");
    const world = fakeWorld({ sub_1: make("sub_1", "active", 0), sub_2: make("sub_2", "active", 1) }, clock);
    await syncSubscription("sub_1", world.deps);
    const before = { ...world.rows.get("user-a")! };
    clock.now = new Date("2025-12-21T00:00:00Z");
    expect((await syncSubscription("sub_2", world.deps)).outcome).toBe("duplicate-active");
    expect(world.rows.get("user-a")).toEqual(before);
  });
});

describe("decideUpsert", () => {
  const mapped = (over: Partial<MappedSubscription> = {}): MappedSubscription => ({
    stripeSubscriptionId: "sub_1",
    customerId: "cus_1",
    metadataUserId: null,
    status: "ACTIVE",
    plan: "MONTHLY",
    currentPeriodEnd: new Date("2026-01-01"),
    cancelAtPeriodEnd: false,
    stripeCreatedAt: new Date("2025-11-01"),
    ...over,
  });
  const stored = (over: Partial<StoredSubscription> = {}): StoredSubscription => ({
    stripeSubscriptionId: "sub_1",
    status: "ACTIVE",
    stripeCreatedAt: new Date("2025-11-01"),
    syncedAt: new Date("2025-11-02"),
    ...over,
  });
  const t = new Date("2025-11-03");

  it.each([
    ["nothing stored", null, mapped(), "insert"],
    ["same subscription, later read", stored(), mapped(), "update"],
    ["same subscription, earlier read", stored({ syncedAt: new Date("2025-11-04") }), mapped(), "stale"],
    ["different, stored ended, new is newer", stored({ stripeSubscriptionId: "sub_0", status: "CANCELED" }), mapped(), "replace"],
    [
      "different, stored ended, new is older",
      stored({ stripeSubscriptionId: "sub_0", status: "CANCELED", stripeCreatedAt: new Date("2026-01-01") }),
      mapped(),
      "stale",
    ],
    ["different, stored live, new active", stored({ stripeSubscriptionId: "sub_0" }), mapped(), "duplicate-active"],
    ["different, stored live, new ended", stored({ stripeSubscriptionId: "sub_0" }), mapped({ status: "CANCELED" }), "stale"],
  ] as const)("%s", (_name, storedRow, mappedRow, expected) => {
    expect(decideUpsert(storedRow, mappedRow, t)).toBe(expected);
  });
});

describe("applyEvent", () => {
  const clock = at("2025-11-02T10:00:00Z");

  it.each(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"])(
    "%s syncs the subscription",
    async (type) => {
      const world = fakeWorld({ sub_1: subscriptionFixture() }, { ...clock });
      expect(await applyEvent(eventFixture(type, { id: "sub_1" }), world.deps)).toEqual({ outcome: "PROCESSED", objectId: "sub_1" });
      expect(world.rows.has("user-a")).toBe(true);
    },
  );

  it("checkout.session.completed syncs the session's subscription", async () => {
    const world = fakeWorld({ sub_1: subscriptionFixture() }, { ...clock });
    const result = await applyEvent(eventFixture("checkout.session.completed", checkoutSessionFixture()), world.deps);
    expect(result.outcome).toBe("PROCESSED");
    expect(world.calls).toEqual(["retrieve:sub_1"]);
  });

  it("a session with no subscription is ignored", async () => {
    const world = fakeWorld({}, { ...clock });
    const result = await applyEvent(
      eventFixture("checkout.session.completed", checkoutSessionFixture({ subscription: null })),
      world.deps,
    );
    expect(result.outcome).toBe("IGNORED");
    expect(world.calls).toEqual([]);
  });

  it("invoice events use the invoice's subscription", async () => {
    const world = fakeWorld({ sub_1: subscriptionFixture() }, { ...clock });
    const invoice = { id: "in_1", parent: { subscription_details: { subscription: "sub_1" } } };
    expect((await applyEvent(eventFixture("invoice.paid", invoice), world.deps)).outcome).toBe("PROCESSED");
    expect((await applyEvent(eventFixture("invoice.payment_failed", invoice, "evt_2"), world.deps)).outcome).toBe("PROCESSED");
    expect((await applyEvent(eventFixture("invoice.paid", { id: "in_2" }, "evt_3"), world.deps)).outcome).toBe("IGNORED");
  });

  it("ignores event types it does not use", async () => {
    const world = fakeWorld({}, { ...clock });
    expect((await applyEvent(eventFixture("customer.created", { id: "cus_1" }), world.deps)).outcome).toBe("IGNORED");
  });

  it("records an unreadable envelope as unmatched, without logging the payload", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const world = fakeWorld({}, { ...clock });
    expect((await applyEvent({ id: "evt_1", secret: "TOP-SECRET" }, world.deps)).outcome).toBe("UNMATCHED");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("TOP-SECRET");
    warn.mockRestore();
  });

  it("flags a second active subscription as unmatched with its id", async () => {
    const world = fakeWorld(
      { sub_1: subscriptionFixture(), sub_2: subscriptionFixture({ id: "sub_2", created: T_START + DAY_SECONDS }) },
      { ...clock },
    );
    await applyEvent(eventFixture("customer.subscription.created", { id: "sub_1" }), world.deps);
    world.deps.now = () => new Date("2025-11-03T00:00:00Z");
    expect(await applyEvent(eventFixture("customer.subscription.created", { id: "sub_2" }, "evt_2"), world.deps)).toEqual({
      outcome: "UNMATCHED",
      objectId: "sub_2",
    });
    expect(world.rows.get("user-a")!.stripeSubscriptionId).toBe("sub_1");
  });
});
