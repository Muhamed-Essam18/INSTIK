import { describe, expect, it } from "vitest";
import { countsAsView, COUNTED_VIEW_SECONDS, crossesThreshold } from "@/lib/earnings/counting";
import type { SubscriptionFacts } from "@/lib/billing/access";

// The counted-view rule (spec 11 FR-001, FR-004, FR-005; docs/product.md "Creator earnings").

const now = new Date("2026-11-18T12:00:00Z");
const day = 86_400_000;
const sub = (status: SubscriptionFacts["status"], periodEndOffsetDays = 10): SubscriptionFacts => ({
  status,
  currentPeriodEnd: new Date(now.getTime() + periodEndOffsetDays * day),
  cancelAtPeriodEnd: false,
});

describe("crossesThreshold", () => {
  it("is 30 seconds", () => {
    expect(COUNTED_VIEW_SECONDS).toBe(30);
  });

  it("is true only for the heartbeat that takes the day from below 30 to 30 or more", () => {
    expect(crossesThreshold(29, 1)).toBe(true);
    expect(crossesThreshold(0, 30)).toBe(true);
    expect(crossesThreshold(28, 5)).toBe(true);
    expect(crossesThreshold(10, 20)).toBe(true);
  });

  it("is false before 30 seconds", () => {
    expect(crossesThreshold(0, 29)).toBe(false);
    expect(crossesThreshold(10, 19)).toBe(false);
    expect(crossesThreshold(0, 0)).toBe(false);
  });

  it("is false once the day is already at 30 or more (no second view, no later back-credit)", () => {
    expect(crossesThreshold(30, 5)).toBe(false);
    expect(crossesThreshold(31, 1)).toBe(false);
    expect(crossesThreshold(120, 20)).toBe(false);
  });

  it("is false for nothing added", () => {
    expect(crossesThreshold(29, 0)).toBe(false);
    expect(crossesThreshold(30, 0)).toBe(false);
  });
});

describe("countsAsView", () => {
  const base = { learnerId: "lea", creatorId: "ann", subscription: sub("ACTIVE"), manual: false, now };

  it("counts for a learner with an active subscription", () => {
    expect(countsAsView(base)).toBe(true);
  });

  it("counts for trialing and past-due subscribers, as the access rule does", () => {
    expect(countsAsView({ ...base, subscription: sub("TRIALING") })).toBe(true);
    expect(countsAsView({ ...base, subscription: sub("PAST_DUE", -3) })).toBe(true);
  });

  it("counts for an account with a manual grant and no subscription", () => {
    expect(countsAsView({ ...base, subscription: null, manual: true })).toBe(true);
  });

  it("does not count for a free learner", () => {
    expect(countsAsView({ ...base, subscription: null })).toBe(false);
    expect(countsAsView({ ...base, subscription: undefined })).toBe(false);
  });

  it("does not count for a lapsed subscriber (ended, or past the 7-day safety net)", () => {
    expect(countsAsView({ ...base, subscription: sub("CANCELED") })).toBe(false);
    expect(countsAsView({ ...base, subscription: sub("ACTIVE", -8) })).toBe(false);
    expect(countsAsView({ ...base, subscription: sub("UNPAID") })).toBe(false);
  });

  it("does not count when the learner is the video's own creator, even with access", () => {
    expect(countsAsView({ ...base, learnerId: "ann" })).toBe(false);
    expect(countsAsView({ ...base, learnerId: "ann", subscription: null, manual: true })).toBe(false);
  });

  it("does not count for a video with no creator", () => {
    expect(countsAsView({ ...base, creatorId: null })).toBe(false);
    expect(countsAsView({ ...base, creatorId: undefined })).toBe(false);
  });
});
