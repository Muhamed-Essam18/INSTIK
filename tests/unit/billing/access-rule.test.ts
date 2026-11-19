import { describe, expect, it } from "vitest";
import {
  canWatch,
  hasFullAccess,
  markLocked,
  isStale,
  STALE_AFTER_DAYS,
  type SubscriptionFacts,
  type SubscriptionStatus,
} from "@/lib/billing/access";

const now = new Date("2026-11-09T12:00:00Z");
const day = 24 * 60 * 60 * 1000;
const sub = (
  status: SubscriptionStatus,
  periodEndOffsetDays: number,
  cancelAtPeriodEnd = false,
): SubscriptionFacts => ({
  status,
  currentPeriodEnd: new Date(now.getTime() + periodEndOffsetDays * day),
  cancelAtPeriodEnd,
});
const free = { access: "free" };
const full = { access: "full" };

describe("free videos", () => {
  it("are watchable with no subscription", () => {
    expect(canWatch(free, null, now)).toBe(true);
    expect(canWatch(free, undefined, now)).toBe(true);
  });
  it("are watchable after a subscription ended", () => {
    expect(canWatch(free, sub("CANCELED", -30), now)).toBe(true);
  });
});

describe("full-access videos", () => {
  it("are locked with no subscription", () => {
    expect(canWatch(full, null, now)).toBe(false);
  });
  it("play with an active subscription", () => {
    expect(canWatch(full, sub("ACTIVE", 10), now)).toBe(true);
  });
  it("treat a missing or unknown access value as full access", () => {
    expect(canWatch({ access: "" }, null, now)).toBe(false);
    expect(canWatch({ access: "FREE" }, null, now)).toBe(false);
    expect(canWatch({ access: "paid" }, sub("ACTIVE", 10), now)).toBe(true);
  });
});

describe("active", () => {
  it("keeps access when cancelled before the period end", () => {
    expect(hasFullAccess(sub("ACTIVE", 5, true), now)).toBe(true);
  });
  it("keeps access for a few days if the renewal is not yet recorded", () => {
    expect(hasFullAccess(sub("ACTIVE", -2), now)).toBe(true);
  });
  it("loses access once the safety net passes", () => {
    expect(hasFullAccess(sub("ACTIVE", -(STALE_AFTER_DAYS + 1)), now)).toBe(false);
  });
  it("treats exactly the limit as still inside it", () => {
    const edge = sub("ACTIVE", -STALE_AFTER_DAYS);
    expect(isStale(edge, now)).toBe(false);
    expect(hasFullAccess(edge, now)).toBe(true);
    expect(hasFullAccess(sub("ACTIVE", -STALE_AFTER_DAYS - 1 / 24 / 60), now)).toBe(false);
  });
});

describe("past due", () => {
  it("keeps access while Stripe retries, inside the 7 days", () => {
    expect(hasFullAccess(sub("PAST_DUE", -3), now)).toBe(true);
  });
  it("loses access outside the 7 days", () => {
    expect(hasFullAccess(sub("PAST_DUE", -8), now)).toBe(false);
  });
});

describe("other statuses", () => {
  it("trialing has access", () => {
    expect(hasFullAccess(sub("TRIALING", 3), now)).toBe(true);
  });
  it.each(["CANCELED", "UNPAID", "INCOMPLETE", "INCOMPLETE_EXPIRED", "PAUSED"] as const)(
    "%s has none, even with a future period end",
    (status) => {
      expect(hasFullAccess(sub(status, 20), now)).toBe(false);
    },
  );
});

describe("a manual grant (spec 11)", () => {
  it("gives access with no subscription at all", () => {
    expect(hasFullAccess(null, now, true)).toBe(true);
    expect(hasFullAccess(undefined, now, true)).toBe(true);
  });
  it("gives access when the subscription has ended or is stale", () => {
    expect(hasFullAccess(sub("CANCELED", -30), now, true)).toBe(true);
    expect(hasFullAccess(sub("ACTIVE", -(STALE_AFTER_DAYS + 1)), now, true)).toBe(true);
  });
  it("changes nothing when it is false or left out", () => {
    expect(hasFullAccess(null, now, false)).toBe(false);
    expect(hasFullAccess(null, now)).toBe(false);
    expect(hasFullAccess(sub("ACTIVE", 20), now, false)).toBe(true);
    expect(hasFullAccess(sub("CANCELED", 20), now, false)).toBe(false);
  });
  it("unlocks a full-access video, and canWatch and markLocked agree", () => {
    expect(canWatch(full, null, now)).toBe(false);
    expect(canWatch(full, null, now, true)).toBe(true);
    expect(markLocked([full, free], null, now, true).map((v) => v.locked)).toEqual([false, false]);
    expect(markLocked([full, free], null, now).map((v) => v.locked)).toEqual([true, false]);
  });
});
