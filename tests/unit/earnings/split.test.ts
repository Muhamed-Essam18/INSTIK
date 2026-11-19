import { describe, expect, it } from "vitest";
import { computeStatement } from "@/lib/earnings/split";

// The money module (spec 11 FR-020 to FR-022, FR-026; constitution XII): integer cents, 80/20, largest-remainder shares.

const joined = (day: number) => new Date(Date.UTC(2026, 0, day));
const creator = (id: string, views: number, day = 1) => ({ id, name: id.toUpperCase(), joinedAt: joined(day), views });
const october = { grossCents: 300_000, vatCents: 56_100, feesCents: 9_600, refundsCents: 4_300 };

describe("the October example", () => {
  const statement = computeStatement({
    revenue: october,
    adjustmentsCents: 0,
    creators: [creator("omar", 3_680), creator("salma", 2_300), creator("nour", 1_840), creator("karim", 1_380)],
  });

  it("goes from gross to net, then 80% to the pool and 20% to Instik", () => {
    expect(statement.netCents).toBe(230_000);
    expect(statement.poolCents).toBe(184_000);
    expect(statement.instikCents).toBe(46_000);
    expect(statement.totalViews).toBe(9_200);
  });

  it("gives each creator their share of the pool by counted views", () => {
    expect(statement.lines.map((l) => [l.id, l.shareBasisPoints, l.earningsCents])).toEqual([
      ["omar", 4_000, 73_600],
      ["salma", 2_500, 46_000],
      ["nour", 2_000, 36_800],
      ["karim", 1_500, 27_600],
    ]);
  });
});

describe("net revenue", () => {
  it("floors at zero when VAT, fees and refunds are as much as the gross revenue, and nobody earns", () => {
    const s = computeStatement({ revenue: { grossCents: 10_000, vatCents: 8_000, feesCents: 1_500, refundsCents: 1_500 }, adjustmentsCents: 0, creators: [creator("a", 5)] });
    expect(s.rawNetCents).toBe(-1_000);
    expect(s.netCents).toBe(0);
    expect(s.poolCents).toBe(0);
    expect(s.instikCents).toBe(0);
    expect(s.lines).toEqual([{ id: "a", name: "A", views: 5, shareBasisPoints: 10_000, earningsCents: 0 }]);
  });

  it("changes before the split when there is an adjustment, positive or negative", () => {
    const base = { revenue: october, creators: [creator("a", 1)] };
    expect(computeStatement({ ...base, adjustmentsCents: -4_300 }).netCents).toBe(225_700);
    expect(computeStatement({ ...base, adjustmentsCents: 10_000 }).netCents).toBe(240_000);
  });

  it("shares a late refund of a closed month 80/20: a 43.00 correction costs the pool 34.40 and Instik 8.60", () => {
    const before = computeStatement({ revenue: october, adjustmentsCents: 0, creators: [creator("a", 1)] });
    const after = computeStatement({ revenue: october, adjustmentsCents: -4_300, creators: [creator("a", 1)] });
    expect(before.poolCents - after.poolCents).toBe(3_440);
    expect(before.instikCents - after.instikCents).toBe(860);
  });

  it("gives the odd cent to Instik, never above the pool", () => {
    const s = computeStatement({ revenue: { grossCents: 1_001, vatCents: 0, feesCents: 0, refundsCents: 0 }, adjustmentsCents: 0, creators: [creator("a", 1)] });
    expect(s.netCents).toBe(1_001);
    expect(s.poolCents).toBe(800);
    expect(s.instikCents).toBe(201);
    expect(s.poolCents + s.instikCents).toBe(s.netCents);
  });
});

describe("rounding", () => {
  it("splits 100 cents among three equal creators into exactly 100 by the fixed rule (earlier-joined first)", () => {
    const s = computeStatement({
      revenue: { grossCents: 125, vatCents: 0, feesCents: 0, refundsCents: 0 },
      adjustmentsCents: 0,
      creators: [creator("c", 1, 3), creator("a", 1, 1), creator("b", 1, 2)],
    });
    expect(s.poolCents).toBe(100);
    const by = Object.fromEntries(s.lines.map((l) => [l.id, l.earningsCents]));
    expect(by).toEqual({ a: 34, b: 33, c: 33 });
    expect(s.lines.reduce((n, l) => n + l.earningsCents, 0)).toBe(100);
  });

  it("gives leftover cents to the largest fractional remainders first", () => {
    // pool 10: views 5, 3, 2 of 10 -> exact 5, 3, 2 (no leftover). Use pool 7 with views 1, 1, 5 of 7 -> exact 1, 1, 5.
    const s = computeStatement({
      revenue: { grossCents: 100, vatCents: 0, feesCents: 0, refundsCents: 0 },
      adjustmentsCents: 0,
      creators: [creator("big", 61), creator("mid", 30), creator("small", 9)],
    });
    // pool 80: exact 48.8, 24.0, 7.2 -> floors 48, 24, 7 = 79, one leftover to the largest remainder (big, .8)
    expect(Object.fromEntries(s.lines.map((l) => [l.id, l.earningsCents]))).toEqual({ big: 49, mid: 24, small: 7 });
  });

  it("breaks an equal remainder by join date, then by id", () => {
    const equal = computeStatement({
      revenue: { grossCents: 125, vatCents: 0, feesCents: 0, refundsCents: 0 },
      adjustmentsCents: 0,
      creators: [creator("z", 1, 1), creator("y", 1, 1), creator("x", 1, 1)],
    });
    expect(Object.fromEntries(equal.lines.map((l) => [l.id, l.earningsCents]))).toEqual({ x: 34, y: 33, z: 33 });
  });

  it("is the same whatever order the creators are passed in", () => {
    const creators = [creator("a", 17, 5), creator("b", 31, 2), creator("c", 7, 9), creator("d", 45, 1)];
    const forward = computeStatement({ revenue: october, adjustmentsCents: 0, creators });
    const reversed = computeStatement({ revenue: october, adjustmentsCents: 0, creators: [...creators].reverse() });
    expect(reversed).toEqual(forward);
  });
});

describe("no counted views", () => {
  it("allocates nothing and leaves the pool unallocated", () => {
    const s = computeStatement({ revenue: october, adjustmentsCents: 0, creators: [] });
    expect(s.lines).toEqual([]);
    expect(s.totalViews).toBe(0);
    expect(s.poolCents).toBe(184_000);
  });

  it("ignores creators with zero views", () => {
    const s = computeStatement({ revenue: october, adjustmentsCents: 0, creators: [creator("a", 0), creator("b", 4)] });
    expect(s.lines.map((l) => l.id)).toEqual(["b"]);
    expect(s.lines[0].earningsCents).toBe(184_000);
  });
});

describe("property: the shares always add up to exactly the pool and never exceed it", () => {
  // A small seeded generator, so the cases are the same on every run.
  let seed = 20_261_118;
  const next = () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return seed / 2 ** 32;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));

  it("holds over 500 random months", () => {
    for (let i = 0; i < 500; i += 1) {
      const gross = int(0, 5_000_000);
      const revenue = { grossCents: gross, vatCents: int(0, Math.floor(gross / 4)), feesCents: int(0, Math.floor(gross / 20)), refundsCents: int(0, Math.floor(gross / 10)) };
      const count = int(1, 12);
      const creators = Array.from({ length: count }, (_, k) => creator(`c${k}`, int(0, 100_000), int(1, 28)));
      const s = computeStatement({ revenue, adjustmentsCents: int(-5_000, 5_000), creators });

      expect(s.poolCents + s.instikCents).toBe(s.netCents);
      expect(s.poolCents).toBeLessThanOrEqual(s.netCents);
      const paid = s.lines.reduce((n, l) => n + l.earningsCents, 0);
      expect(paid).toBeLessThanOrEqual(s.poolCents);
      if (s.totalViews > 0) expect(paid).toBe(s.poolCents);
      for (const line of s.lines) {
        // Each creator is within one cent of their exact share.
        const exact = (s.poolCents * line.views) / s.totalViews;
        expect(Math.abs(line.earningsCents - exact)).toBeLessThan(1 + 1e-6);
        expect(line.earningsCents).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("large amounts", () => {
  it("stay exact with 10^9 cents and 10^8 views each (pool x views passes the safe integer range)", () => {
    const creators = [creator("a", 100_000_000, 1), creator("b", 100_000_001, 2), creator("c", 99_999_999, 3)];
    const s = computeStatement({ revenue: { grossCents: 1_000_000_000, vatCents: 0, feesCents: 0, refundsCents: 0 }, adjustmentsCents: 0, creators });
    expect(s.poolCents).toBe(800_000_000);

    // An independent BigInt calculation of the same rule.
    const pool = BigInt(800_000_000);
    const total = BigInt(300_000_000);
    const exact = creators.map((c) => (pool * BigInt(c.views)) / total);
    const baseSum = exact.reduce((a, b) => a + b, BigInt(0));
    const leftover = Number(pool - baseSum);
    const paid = s.lines.reduce((n, l) => n + l.earningsCents, 0);
    expect(paid).toBe(800_000_000);
    for (const line of s.lines) {
      const base = Number((pool * BigInt(line.views)) / total);
      expect([base, base + 1]).toContain(line.earningsCents);
    }
    expect(leftover).toBeGreaterThanOrEqual(0);
    expect(pool * BigInt(100_000_001)).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
  });
});
