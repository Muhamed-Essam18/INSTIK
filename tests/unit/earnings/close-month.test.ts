import { describe, expect, it } from "vitest";
import { creatorViews, owner, secondOwner, setupEarnings } from "../../helpers/earnings-memory";

// Closing a month locks its numbers (spec 11 User Story 4; FR-027, FR-028; constitution XII).

const october = [creatorViews("omar", 3_680, 1, "Omar"), creatorViews("salma", 2_300, 2, "Salma"), creatorViews("nour", 1_840, 3, "Nour"), creatorViews("karim", 1_380, 4, "Karim")];
const ended = { now: "2026-11-01T00:30:00Z", revenue: { "2026-10": {} }, views: { "2026-10": october } };
const figures = { grossCents: 300_000, vatCents: 56_100, feesCents: 9_600, refundsCents: 4_300 };

describe("when a month can be closed", () => {
  it("is refused before the month has ended in Warsaw time, and allowed from its first instant", async () => {
    const before = setupEarnings({ ...ended, now: "2026-10-31T22:59:59Z" });
    expect(await before.service.closeMonth(owner, "2026-10")).toEqual({ ok: false, reason: "not-ended" });
    expect(before.state.closed.size).toBe(0);

    const at = setupEarnings({ ...ended, now: "2026-10-31T23:00:00Z" });
    expect(await at.service.closeMonth(owner, "2026-10")).toMatchObject({ ok: true, alreadyClosed: false });
  });

  it("is refused with no revenue entered, and says what is missing", async () => {
    const t = setupEarnings({ now: ended.now, views: ended.views });
    expect(await t.service.closeMonth(owner, "2026-10")).toEqual({ ok: false, reason: "no-revenue" });
    expect(t.state.closed.size).toBe(0);
  });

  it("is refused for something that is not a month", async () => {
    expect(await setupEarnings(ended).service.closeMonth(owner, "October")).toEqual({ ok: false, reason: "month" });
  });
});

describe("closing", () => {
  it("stores the frozen figures, the split and one earning per creator that adds up to the pool, each with the month's currency", async () => {
    const t = setupEarnings(ended);
    const result = await t.service.closeMonth(owner, "2026-10");
    expect(result).toMatchObject({ ok: true, alreadyClosed: false });
    expect(t.state.closed.get("2026-10")).toMatchObject({
      month: "2026-10",
      closedById: "boss",
      currency: "EUR",
      ...figures,
      adjustmentsCents: 0,
      netCents: 230_000,
      poolCents: 184_000,
      instikCents: 46_000,
      totalViews: 9_200,
    });
    expect(t.state.closed.get("2026-10")!.closedAt).toEqual(new Date(ended.now));
    const earnings = t.state.earnings.get("2026-10")!;
    expect(earnings.map((e) => [e.creatorName, e.views, e.earningsCents, e.currency])).toEqual([
      ["Omar", 3_680, 73_600, "EUR"],
      ["Salma", 2_300, 46_000, "EUR"],
      ["Nour", 1_840, 36_800, "EUR"],
      ["Karim", 1_380, 27_600, "EUR"],
    ]);
    expect(earnings.reduce((n, e) => n + e.earningsCents, 0)).toBe(184_000);
    expect(result.ok && result.creatorIds.sort()).toEqual(["karim", "nour", "omar", "salma"]);
  });

  it("records the adjustments that were part of the month's net revenue", async () => {
    const t = setupEarnings(ended);
    await t.service.addAdjustment(owner, { month: "2026-10", amountCents: -4_300, note: "Late refund for September" });
    await t.service.closeMonth(owner, "2026-10");
    expect(t.state.closed.get("2026-10")).toMatchObject({ adjustmentsCents: -4_300, netCents: 225_700, poolCents: 180_560 });
  });

  it("closes a month with no counted views and no earning lines", async () => {
    const t = setupEarnings({ now: ended.now, revenue: { "2026-10": {} } });
    expect(await t.service.closeMonth(owner, "2026-10")).toMatchObject({ ok: true });
    expect(t.state.earnings.get("2026-10")).toEqual([]);
    expect(t.state.closed.get("2026-10")).toMatchObject({ totalViews: 0, poolCents: 184_000 });
  });
});

describe("closing twice", () => {
  it("does nothing the second time and says it was already closed, with no duplicated rows", async () => {
    const t = setupEarnings(ended);
    await t.service.closeMonth(owner, "2026-10");
    const again = await t.service.closeMonth(owner, "2026-10");
    expect(again).toMatchObject({ ok: true, alreadyClosed: true });
    expect(t.state.earnings.get("2026-10")).toHaveLength(4);
  });

  it("closes once when two owners close at the same moment", async () => {
    const t = setupEarnings(ended);
    const [a, b] = await Promise.all([t.service.closeMonth(owner, "2026-10"), t.service.closeMonth(secondOwner, "2026-10")]);
    expect([a, b].filter((r) => r.ok && !r.alreadyClosed)).toHaveLength(1);
    expect([a, b].filter((r) => r.ok && r.alreadyClosed)).toHaveLength(1);
    expect(t.state.earnings.get("2026-10")).toHaveLength(4);
    expect(t.state.closed.get("2026-10")!.closedById).toBe("boss");
  });
});

describe("a closed month never changes", () => {
  it("refuses to edit its revenue or add an adjustment", async () => {
    const t = setupEarnings(ended);
    await t.service.closeMonth(owner, "2026-10");
    expect(await t.service.saveRevenue(owner, { month: "2026-10", figures: { ...figures, grossCents: 1 }, expectedVersion: 1 })).toEqual({ ok: false, reason: "closed" });
    expect(await t.service.addAdjustment(owner, { month: "2026-10", amountCents: 100, note: "x" })).toEqual({ ok: false, reason: "closed" });
    expect(t.state.revenue.get("2026-10")!.grossCents).toBe(300_000);
    expect(t.state.adjustments).toHaveLength(0);
  });

  it("keeps showing the frozen numbers whatever happens to counted views, creators or revenue afterwards", async () => {
    const t = setupEarnings(ended);
    await t.service.closeMonth(owner, "2026-10");
    const before = JSON.stringify(await t.service.getStatement(owner, "2026-10"));

    // A late heartbeat adds views, a creator is renamed, someone edits the stored revenue row behind the service's back.
    t.state.views.set("2026-10", [creatorViews("omar", 99_999, 1, "Renamed"), ...october.slice(1)]);
    t.state.revenue.set("2026-10", { ...t.state.revenue.get("2026-10")!, grossCents: 1 });

    expect(JSON.stringify(await t.service.getStatement(owner, "2026-10"))).toBe(before);
    const s = (await t.service.getStatement(owner, "2026-10"))!;
    expect(s).toMatchObject({ final: true, netCents: 230_000, poolCents: 184_000, instikCents: 46_000, totalViews: 9_200, canClose: false });
    expect(s.lines.map((l) => l.name)).toEqual(["Omar", "Salma", "Nour", "Karim"]);
  });

  it("shows the closed month as final, with who closed it and when, and every creator unpaid until marked", async () => {
    const t = setupEarnings(ended);
    await t.service.closeMonth(owner, "2026-10");
    const s = (await t.service.getStatement(owner, "2026-10"))!;
    expect(s).toMatchObject({ final: true, closedById: "boss" });
    expect(s.closedAt).toEqual(new Date(ended.now));
    expect(s.lines.map((l) => l.payout)).toEqual(["unpaid", "unpaid", "unpaid", "unpaid"]);
    expect(s.lines.map((l) => l.earningsCents)).toEqual([73_600, 46_000, 36_800, 27_600]);
  });

  it("lists the month as closed", async () => {
    const t = setupEarnings(ended);
    await t.service.closeMonth(owner, "2026-10");
    expect(await t.service.listMonths(owner)).toEqual([
      { month: "2026-11", status: "open" },
      { month: "2026-10", status: "closed" },
    ]);
  });
});
