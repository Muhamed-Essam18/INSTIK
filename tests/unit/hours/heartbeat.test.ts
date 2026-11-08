import { describe, expect, it } from "vitest";
import { acceptInterval, type IntervalInput } from "@/lib/hours/heartbeat";

const NOW = Date.parse("2026-11-08T12:00:00Z");
const base: IntervalInput = {
  seconds: 15,
  spanSeconds: 15,
  endedAgoSeconds: 0,
  now: NOW,
  countedUntil: null,
  lateWindowStart: null,
  lateSeconds: 0,
};
const run = (over: Partial<IntervalInput>) => acceptInterval({ ...base, ...over });

function ok(result: ReturnType<typeof acceptInterval>) {
  if (!result.ok) throw new Error(`rejected: ${result.reason}`);
  return result;
}

describe("acceptInterval: live intervals", () => {
  it("accepts an honest live 15s interval in full", () => {
    const r = ok(run({}));
    expect(r.accepted).toBe(15);
    expect(r.endMs).toBe(NOW);
    expect(r.startMs).toBe(NOW - 15_000);
    expect(r.countedUntil).toBe(NOW);
  });

  it("accepts a first-ever interval", () => {
    expect(ok(run({ countedUntil: null })).accepted).toBe(15);
  });

  it("cuts a claim larger than its own span to the span", () => {
    expect(ok(run({ seconds: 1000, spanSeconds: 12 })).accepted).toBe(12);
  });

  it("rejects a span over 20 seconds", () => {
    expect(run({ seconds: 20, spanSeconds: 21 })).toEqual({ ok: false, reason: "too-long" });
  });

  it("rejects an interval starting before the last counted moment (a second device, a replayed queue)", () => {
    const r = run({ countedUntil: NOW - 5000 });
    expect(r).toEqual({ ok: false, reason: "overlap" });
  });

  it("allows jitter up to the tolerance between back-to-back intervals", () => {
    expect(run({ countedUntil: NOW - 15_000 + 1500 }).ok).toBe(true);
    expect(run({ countedUntil: NOW - 15_000 + 2500 }).ok).toBe(false);
  });

  it("cannot be used to exceed real time: repeated 20s claims that all end now overlap", () => {
    const first = ok(run({ seconds: 20, spanSeconds: 20 }));
    const second = run({ seconds: 20, spanSeconds: 20, now: NOW + 1000, countedUntil: first.countedUntil });
    expect(second).toEqual({ ok: false, reason: "overlap" });
  });

  it("accepts the next interval after the previous one", () => {
    const first = ok(run({}));
    const second = run({ now: NOW + 15_000, countedUntil: first.countedUntil });
    expect(ok(second).accepted).toBe(15);
  });

  it("treats an interval that would end in the future as invalid (negative age)", () => {
    expect(run({ endedAgoSeconds: -3 })).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an out-of-order interval and does not break the next valid one", () => {
    const first = ok(run({}));
    const stale = run({ now: NOW + 40_000, endedAgoSeconds: 35, countedUntil: first.countedUntil });
    expect(stale).toEqual({ ok: false, reason: "overlap" });
    const next = run({ now: NOW + 40_000, countedUntil: first.countedUntil });
    expect(ok(next).accepted).toBe(15);
  });

  it.each([NaN, Infinity, -1])("rejects the value %s", (bad) => {
    expect(run({ seconds: bad }).ok).toBe(false);
    expect(run({ spanSeconds: bad }).ok).toBe(false);
    expect(run({ endedAgoSeconds: bad }).ok).toBe(false);
  });

  it("rejects an invalid clock", () => {
    expect(run({ now: NaN }).ok).toBe(false);
  });

  it("accepts nothing for 0 seconds but still moves countedUntil", () => {
    const r = ok(run({ seconds: 0 }));
    expect(r.accepted).toBe(0);
  });
});

describe("acceptInterval: the offline queue", () => {
  // Fifteen 20-second intervals recorded back to back, sent in order after reconnecting.
  function reconnect(intervals: number, startAgo: number, sendAt = NOW, state?: Partial<IntervalInput>) {
    let countedUntil: number | null = state?.countedUntil ?? null;
    let lateWindowStart: number | null = state?.lateWindowStart ?? null;
    let lateSeconds = state?.lateSeconds ?? 0;
    let total = 0;
    for (let i = 0; i < intervals; i++) {
      const endedAgo = startAgo - (i + 1) * 20;
      const r = acceptInterval({
        seconds: 20,
        spanSeconds: 20,
        endedAgoSeconds: endedAgo,
        now: sendAt,
        countedUntil,
        lateWindowStart,
        lateSeconds,
      });
      if (!r.ok) continue;
      total += r.accepted;
      countedUntil = r.countedUntil;
      lateWindowStart = r.lateWindowStart;
      lateSeconds = r.lateSeconds;
    }
    return { total, countedUntil, lateWindowStart, lateSeconds };
  }

  it("accepts a 5-minute offline session sent in order", () => {
    // 15 intervals of 20s ending between 280s ago and 0s ago.
    expect(reconnect(15, 300).total).toBe(300);
  });

  it("counts only the first 300 late seconds of a 20-minute session", () => {
    const r = reconnect(60, 1200);
    expect(r.total).toBeLessThanOrEqual(300 + 40); // the last two intervals ended within 30s, so they are not late
    expect(r.total).toBeGreaterThanOrEqual(300);
  });

  it("adds nothing more on a second reconnect inside the same window", () => {
    const first = reconnect(20, 400);
    const second = reconnect(20, 400, NOW, {
      countedUntil: first.countedUntil,
      lateWindowStart: first.lateWindowStart,
      lateSeconds: first.lateSeconds,
    });
    // Everything in the second batch overlaps the first, so it is rejected.
    expect(second.total).toBe(0);
  });

  it("resets the budget in a new window", () => {
    const old = acceptInterval({
      ...base,
      endedAgoSeconds: 60,
      seconds: 20,
      spanSeconds: 20,
      lateWindowStart: NOW - 11 * 60_000,
      lateSeconds: 300,
    });
    const r = ok(old);
    expect(r.accepted).toBe(20);
    expect(r.lateSeconds).toBe(20);
    expect(r.lateWindowStart).toBe(NOW);
  });

  it("caps an interval to what is left of the late budget", () => {
    const r = ok(
      acceptInterval({ ...base, endedAgoSeconds: 60, seconds: 20, spanSeconds: 20, lateWindowStart: NOW - 1000, lateSeconds: 290 }),
    );
    expect(r.accepted).toBe(10);
    expect(r.lateSeconds).toBe(300);
  });

  it("accepts 0 once the budget is spent, without error", () => {
    const r = ok(
      acceptInterval({ ...base, endedAgoSeconds: 60, seconds: 20, spanSeconds: 20, lateWindowStart: NOW - 1000, lateSeconds: 300 }),
    );
    expect(r.accepted).toBe(0);
  });

  it("rejects an interval older than 24 hours", () => {
    expect(run({ endedAgoSeconds: 24 * 3600 + 1 })).toEqual({ ok: false, reason: "too-old" });
  });

  it("counts a replayed queue once", () => {
    const first = reconnect(5, 120);
    const replay = reconnect(5, 120, NOW, { countedUntil: first.countedUntil });
    expect(first.total).toBe(100);
    expect(replay.total).toBe(0);
  });
});
