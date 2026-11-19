import { describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/roles/forbidden";
import { creatorActor, creatorViews, learnerActor, owner, secondOwner, setupEarnings } from "../../helpers/earnings-memory";

// The owner's statement and revenue entry (spec 11 User Story 2; FR-018 to FR-025). Money is integer cents.

const october = [creatorViews("omar", 3_680, 1), creatorViews("salma", 2_300, 2), creatorViews("nour", 1_840, 3), creatorViews("karim", 1_380, 4)];
const figures = { grossCents: 300_000, vatCents: 56_100, feesCents: 9_600, refundsCents: 4_300 };

describe("getStatement", () => {
  it("goes from gross to net, splits 80/20 and gives each creator their share (estimated while the month is open)", async () => {
    const t = setupEarnings({ now: "2026-10-20T10:00:00Z", revenue: { "2026-10": {} }, views: { "2026-10": october } });
    const s = (await t.service.getStatement(owner, "2026-10"))!;
    expect(s).toMatchObject({ month: "2026-10", final: false, netCents: 230_000, poolCents: 184_000, instikCents: 46_000, totalViews: 9_200, canClose: false });
    expect(s.lines.map((l) => [l.name, l.views, l.shareBasisPoints, l.earningsCents, l.payout])).toEqual([
      ["OMAR", 3_680, 4_000, 73_600, null],
      ["SALMA", 2_300, 2_500, 46_000, null],
      ["NOUR", 1_840, 2_000, 36_800, null],
      ["KARIM", 1_380, 1_500, 27_600, null],
    ]);
  });

  it("says revenue has not been entered, with counted views and no euro amounts", async () => {
    const t = setupEarnings({ now: "2026-10-20T10:00:00Z", views: { "2026-10": october } });
    const s = (await t.service.getStatement(owner, "2026-10"))!;
    expect(s.revenue).toBeNull();
    expect(s.netCents).toBeNull();
    expect(s.poolCents).toBeNull();
    expect(s.instikCents).toBeNull();
    expect(s.totalViews).toBe(9_200);
    expect(s.lines.map((l) => l.earningsCents)).toEqual([null, null, null, null]);
    expect(s.lines.map((l) => l.views)).toEqual([3_680, 2_300, 1_840, 1_380]);
    expect(s.canClose).toBe(false);
  });

  it("shows a month with no counted views plainly: nobody earns", async () => {
    const t = setupEarnings({ revenue: { "2026-10": {} } });
    const s = (await t.service.getStatement(owner, "2026-10"))!;
    expect(s.lines).toEqual([]);
    expect(s.totalViews).toBe(0);
    expect(s.poolCents).toBe(184_000);
  });

  it("floors net revenue at zero and flags it when VAT, fees and refunds are as much as the gross revenue", async () => {
    const t = setupEarnings({ revenue: { "2026-10": { grossCents: 10_000, vatCents: 8_000, feesCents: 1_500, refundsCents: 1_500 } }, views: { "2026-10": [creatorViews("a", 5)] } });
    const s = (await t.service.getStatement(owner, "2026-10"))!;
    expect(s.netCents).toBe(0);
    expect(s.netFloored).toBe(true);
    expect(s.lines[0].earningsCents).toBe(0);
  });

  it("can be closed only when the month has ended and revenue is entered", async () => {
    const ended = setupEarnings({ now: "2026-11-01T00:30:00Z", revenue: { "2026-10": {} } });
    expect((await ended.service.getStatement(owner, "2026-10"))!.canClose).toBe(true);
    const running = setupEarnings({ now: "2026-10-31T21:00:00Z", revenue: { "2026-10": {} } });
    expect((await running.service.getStatement(owner, "2026-10"))!.canClose).toBe(false);
    const noRevenue = setupEarnings({ now: "2026-11-05T10:00:00Z" });
    expect((await noRevenue.service.getStatement(owner, "2026-10"))!.canClose).toBe(false);
  });

  it("returns nothing for a month key that is not a month", async () => {
    const t = setupEarnings();
    expect(await t.service.getStatement(owner, "2026-13")).toBeNull();
    expect(await t.service.getStatement(owner, "October")).toBeNull();
  });
});

describe("listMonths", () => {
  it("lists the current month first, then months with revenue or views, newest first, marking closed ones", async () => {
    const t = setupEarnings({ now: "2026-11-10T10:00:00Z", revenue: { "2026-10": {} }, views: { "2026-09": [creatorViews("a", 1)] } });
    expect(await t.service.listMonths(owner)).toEqual([
      { month: "2026-11", status: "open" },
      { month: "2026-10", status: "open" },
      { month: "2026-09", status: "open" },
    ]);
  });

  it("is capped at 24 months", async () => {
    const revenue: Record<string, object> = {};
    for (let i = 1; i <= 12; i += 1) {
      revenue[`2024-${String(i).padStart(2, "0")}`] = {};
      revenue[`2025-${String(i).padStart(2, "0")}`] = {};
    }
    const t = setupEarnings({ now: "2026-01-10T10:00:00Z", revenue });
    expect(await t.service.listMonths(owner)).toHaveLength(24);
  });
});

describe("saveRevenue", () => {
  it("saves the four figures, appends a change record with who and when, and starts at version 1", async () => {
    const t = setupEarnings();
    const r = await t.service.saveRevenue(owner, { month: "2026-11", figures, expectedVersion: 0 });
    expect(r).toEqual({ ok: true, version: 1 });
    expect(t.state.revenue.get("2026-11")).toMatchObject({ ...figures, currency: "EUR", source: "MANUAL", version: 1 });
    expect(t.state.changes).toHaveLength(1);
    expect(t.state.changes[0]).toMatchObject({ month: "2026-11", ...figures, version: 1, byId: "boss", currency: "EUR" });
  });

  it("refuses an out-of-date save with the reload message, and the first save stays", async () => {
    const t = setupEarnings();
    await t.service.saveRevenue(owner, { month: "2026-11", figures, expectedVersion: 0 });
    const mine = await t.service.saveRevenue(owner, { month: "2026-11", figures: { ...figures, grossCents: 400_000 }, expectedVersion: 1 });
    expect(mine).toEqual({ ok: true, version: 2 });
    const theirs = await t.service.saveRevenue(secondOwner, { month: "2026-11", figures: { ...figures, grossCents: 1 }, expectedVersion: 1 });
    expect(theirs).toEqual({ ok: false, reason: "stale" });
    expect(t.state.revenue.get("2026-11")!.grossCents).toBe(400_000);
    expect(t.state.changes).toHaveLength(2);
  });

  it("serialises two saves made at once so exactly one wins", async () => {
    const t = setupEarnings();
    const [a, b] = await Promise.all([
      t.service.saveRevenue(owner, { month: "2026-11", figures, expectedVersion: 0 }),
      t.service.saveRevenue(secondOwner, { month: "2026-11", figures: { ...figures, grossCents: 5 }, expectedVersion: 0 }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(t.state.changes).toHaveLength(1);
  });

  it("refuses negative, fractional and oversized figures and names the field", async () => {
    const t = setupEarnings();
    expect(await t.service.saveRevenue(owner, { month: "2026-11", figures: { ...figures, vatCents: -1 }, expectedVersion: 0 })).toEqual({ ok: false, reason: "negative", field: "vatCents" });
    expect(await t.service.saveRevenue(owner, { month: "2026-11", figures: { ...figures, feesCents: 0.5 }, expectedVersion: 0 })).toEqual({ ok: false, reason: "not-whole", field: "feesCents" });
    expect(await t.service.saveRevenue(owner, { month: "2026-11", figures: { ...figures, grossCents: 1_000_000_001 }, expectedVersion: 0 })).toEqual({ ok: false, reason: "too-large", field: "grossCents" });
    expect(t.state.revenue.size).toBe(0);
    expect(t.state.changes).toHaveLength(0);
  });

  it("refuses a closed month, a future month and a month that is not a month", async () => {
    const t = setupEarnings({ now: "2026-12-03T10:00:00Z" });
    t.state.closed.set("2026-10", { month: "2026-10", closedAt: new Date(), closedById: "boss", currency: "EUR", grossCents: 0, vatCents: 0, feesCents: 0, refundsCents: 0, adjustmentsCents: 0, netCents: 0, poolCents: 0, instikCents: 0, totalViews: 0 });
    expect(await t.service.saveRevenue(owner, { month: "2026-10", figures, expectedVersion: 0 })).toEqual({ ok: false, reason: "closed" });
    expect(await t.service.saveRevenue(owner, { month: "2027-03", figures, expectedVersion: 0 })).toEqual({ ok: false, reason: "future" });
    expect(await t.service.saveRevenue(owner, { month: "soon", figures, expectedVersion: 0 })).toEqual({ ok: false, reason: "month" });
    expect(t.state.revenue.size).toBe(0);
  });

  it("refuses to edit figures that came from a payment provider", async () => {
    const t = setupEarnings({ revenue: { "2026-11": { source: "GATEWAY", version: 0 } } });
    expect(await t.service.saveRevenue(owner, { month: "2026-11", figures, expectedVersion: 0 })).toEqual({ ok: false, reason: "read-only" });
  });
});

describe("who may use the statement functions", () => {
  const calls: Record<string, (t: ReturnType<typeof setupEarnings>, actor: never) => Promise<unknown>> = {
    getStatement: (t, a) => t.service.getStatement(a, "2026-10"),
    listMonths: (t, a) => t.service.listMonths(a),
    saveRevenue: (t, a) => t.service.saveRevenue(a, { month: "2026-11", figures, expectedVersion: 0 }),
  };

  it.each(Object.keys(calls))("%s refuses a creator, a learner and nobody, and reads and writes nothing", async (name) => {
    for (const actor of [creatorActor(), learnerActor, null, undefined]) {
      const t = setupEarnings({ revenue: { "2026-10": {} }, views: { "2026-10": october } });
      const reads = vi.spyOn(t.store, "getClosed");
      const write = vi.spyOn(t.store, "transaction");
      await expect(calls[name](t, actor as never)).rejects.toBeInstanceOf(ForbiddenError);
      expect(reads).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
      expect(t.state.changes).toHaveLength(0);
    }
  });
});
