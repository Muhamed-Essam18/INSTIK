import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createManualRevenueSource, type MonthRevenue, type RevenueSource } from "@/lib/earnings/revenue-source";
import { computeStatement } from "@/lib/earnings/split";

// Gateway independence (spec 11 FR-018, FR-019, FR-031, SC-011): the statement reads four figures and never knows their source.

const month = "2026-10";
const figures: MonthRevenue = { month, currency: "EUR", grossCents: 300_000, vatCents: 56_100, feesCents: 9_600, refundsCents: 4_300, source: "MANUAL", version: 3 };
const creators = [
  { id: "a", name: "A", joinedAt: new Date("2026-01-01"), views: 3_680 },
  { id: "b", name: "B", joinedAt: new Date("2026-01-02"), views: 2_300 },
];

const statementFrom = async (source: RevenueSource) => {
  const revenue = (await source.getMonthRevenue(month))!;
  return computeStatement({ revenue, adjustmentsCents: 0, creators });
};

describe("the manual revenue source", () => {
  it("returns the figures an owner entered, or null when none have been", async () => {
    const source = createManualRevenueSource(async (m) => (m === month ? figures : null));
    expect(await source.getMonthRevenue(month)).toEqual(figures);
    expect(await source.getMonthRevenue("2026-11")).toBeNull();
  });
});

describe("a second source with the same numbers", () => {
  it("gives a byte-identical statement (a gateway could fill the record without changing the logic)", async () => {
    const manual = createManualRevenueSource(async () => figures);
    const gateway: RevenueSource = { getMonthRevenue: async () => ({ ...figures, source: "GATEWAY", version: 0 }) };
    const a = await statementFrom(manual);
    const b = await statementFrom(gateway);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe("the money logic stays independent of where figures come from", () => {
  const read = (file: string) => readFileSync(file, "utf8");

  it("split.ts does not import the revenue source", () => {
    expect(read("src/lib/earnings/split.ts")).not.toMatch(/revenue-source/);
  });

  it("nothing under src/lib/earnings imports a payment provider, Stripe code or a network client (no money is ever sent)", () => {
    const files = ["split", "rules", "format", "counting", "revenue-source", "service", "messages"].map((f) => `src/lib/earnings/${f}.ts`);
    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toMatch(/from\s+["'](stripe|@stripe\/[^"']*|axios|node-fetch|undici)["']/);
      expect(source, file).not.toMatch(/@\/lib\/billing\/(stripe|checkout|sync|webhook|deps)/);
      expect(source, file).not.toMatch(/\bfetch\(/);
    }
  });
});
