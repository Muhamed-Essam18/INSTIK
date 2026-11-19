import { beforeEach, describe, expect, it, vi } from "vitest";

// recordHeartbeat notes the day parts that cross 30 seconds and counts them AFTER the transaction commits, so a counting
// failure can never affect a learner's hours (spec 11, contracts/server-actions.md "Heartbeat", constitution III).

const mocks = vi.hoisted(() => ({
  record: vi.fn(),
  events: [] as string[],
  seconds: new Map<string, number>(),
  failTransaction: false,
  countedUntil: null as Date | null,
}));

vi.mock("@/lib/earnings/record-view", () => ({
  recordCountedViewIfCrossed: (...args: unknown[]) => {
    mocks.events.push("count");
    return mocks.record(...args);
  },
}));
vi.mock("@/lib/content", () => ({ getVideo: async () => ({ slug: "v", durationSeconds: 600 }) }));
vi.mock("@/lib/db", () => {
  const tx = {
    $queryRaw: async () => [
      { id: "ll1", stage: "HEAR_IT", countedUntil: mocks.countedUntil, lateWindowStart: null, lateSeconds: 0, chimedHours: 0, minutesPerDay: 20 },
    ],
    user: { findUnique: async () => ({ timeZone: "UTC", hourSound: false }), update: async () => ({}) },
    watchSession: {
      upsert: async ({ where, create, update }: { where: { userId_languageCode_videoSlug_day: { day: Date } }; create: { seconds: number }; update: { seconds: { increment: number } } }) => {
        const key = where.userId_languageCode_videoSlug_day.day.toISOString().slice(0, 10);
        const next = mocks.seconds.has(key) ? mocks.seconds.get(key)! + update.seconds.increment : create.seconds;
        mocks.seconds.set(key, next);
        return { seconds: next };
      },
      aggregate: async () => ({ _sum: { seconds: [...mocks.seconds.values()].reduce((a, b) => a + b, 0) } }),
      findMany: async () => [...mocks.seconds].map(([, seconds]) => ({ videoSlug: "v", seconds })),
    },
    manualTime: { aggregate: async () => ({ _sum: { minutes: 0 } }) },
    videoProgress: { findUnique: async () => null, upsert: async () => ({}) },
    learnerLanguage: { update: async () => ({}) },
  };
  return {
    db: () => ({
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
        if (mocks.failTransaction) throw new Error("the transaction failed");
        const result = await fn(tx);
        mocks.events.push("commit");
        return result;
      },
    }),
  };
});

import { recordHeartbeat } from "@/lib/hours/service";

const NOW = Date.parse("2026-11-18T12:00:00Z");
const beat = (seconds = 10) =>
  recordHeartbeat({
    userId: "lea",
    languageCode: "arz",
    videoSlug: "v",
    seconds,
    spanSeconds: seconds,
    endedAgoSeconds: 0,
    position: 5,
    timeZone: "UTC",
    nowMs: NOW,
  });

beforeEach(() => {
  mocks.record.mockReset();
  mocks.record.mockResolvedValue(undefined);
  mocks.events.length = 0;
  mocks.seconds.clear();
  mocks.failTransaction = false;
  mocks.countedUntil = null;
});

describe("recordHeartbeat and counting", () => {
  it("calls counting once, after the commit, with only the crossed day part", async () => {
    mocks.seconds.set("2026-11-18", 25);
    const result = await beat(10);
    expect(result.ok).toBe(true);
    expect(mocks.record).toHaveBeenCalledTimes(1);
    expect(mocks.record).toHaveBeenCalledWith(
      [{ userId: "lea", languageCode: "arz", videoSlug: "v", day: "2026-11-18", secondsBefore: 25, secondsAfter: 35 }],
      NOW,
    );
    expect(mocks.events).toEqual(["commit", "count"]);
  });

  it("does not call counting for a heartbeat that does not cross 30 seconds", async () => {
    mocks.seconds.set("2026-11-18", 5);
    await beat(10);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("does not call counting again once the day is past 30 seconds", async () => {
    mocks.seconds.set("2026-11-18", 40);
    await beat(10);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("calls counting for the first heartbeat of a day that is itself 30 seconds long only when it reaches 30", async () => {
    await beat(20);
    expect(mocks.record).not.toHaveBeenCalled();
    await beat(10);
    expect(mocks.record).toHaveBeenCalledTimes(1);
  });

  it("does not call counting when the transaction fails", async () => {
    mocks.failTransaction = true;
    await expect(beat(10)).rejects.toThrow("the transaction failed");
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("does not call counting for a rejected heartbeat (the interval overlaps time already counted)", async () => {
    mocks.countedUntil = new Date(NOW + 60_000);
    mocks.seconds.set("2026-11-18", 25);
    const result = await beat(10);
    expect(result).toEqual({ ok: false, code: "rejected" });
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("gives the learner exactly the same result with and without a counting failure", async () => {
    mocks.seconds.set("2026-11-18", 25);
    const counted = await beat(10);

    mocks.seconds.clear();
    mocks.seconds.set("2026-11-18", 25);
    mocks.record.mockRejectedValue(new Error("counting is down"));
    const failed = await beat(10);

    mocks.seconds.clear();
    mocks.seconds.set("2026-11-18", 25);
    mocks.record.mockImplementation(() => {
      throw new Error("counting threw synchronously");
    });
    const threw = await beat(10);

    expect(failed).toEqual(counted);
    expect(threw).toEqual(counted);
    expect(counted).toMatchObject({ ok: true, accepted: 10, totalSeconds: 35 });
  });

  it("never mentions counted views in the result", async () => {
    mocks.seconds.set("2026-11-18", 25);
    const result = await beat(10);
    expect(JSON.stringify(result)).not.toMatch(/count(ed)?View|view/i);
  });
});
