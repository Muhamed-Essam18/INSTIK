import { describe, expect, it } from "vitest";
import { creatorViews, owner, setupEarnings } from "../../helpers/earnings-memory";

// A correction to a closed month is an adjustment in the open month, shared 80/20 (spec 11 FR-028; constitution XII).

const one = [creatorViews("ann", 10, 1, "Ann")];
const open = () => setupEarnings({ now: "2026-11-10T10:00:00Z", revenue: { "2026-11": {} }, views: { "2026-11": one } });

describe("addAdjustment", () => {
  it("appends a signed adjustment to the month with who, when and the month's currency", async () => {
    const t = open();
    expect(await t.service.addAdjustment(owner, { month: "2026-11", amountCents: -4_300, note: "  Late refund for October  " })).toEqual({ ok: true });
    expect(t.state.adjustments).toHaveLength(1);
    expect(t.state.adjustments[0]).toMatchObject({ month: "2026-11", amountCents: -4_300, currency: "EUR", note: "Late refund for October", byId: "boss" });
    expect(t.state.adjustments[0].at).toEqual(new Date("2026-11-10T10:00:00Z"));
  });

  it("copies the currency from the month's revenue record and ignores a caller's", async () => {
    const t = setupEarnings({ now: "2026-11-10T10:00:00Z", revenue: { "2026-11": { currency: "USD" } } });
    await t.service.addAdjustment(owner, { month: "2026-11", amountCents: 100, note: "x", currency: "GBP" } as never);
    expect(t.state.adjustments[0].currency).toBe("USD");
    const none = setupEarnings({ now: "2026-11-10T10:00:00Z" });
    await none.service.addAdjustment(owner, { month: "2026-11", amountCents: 100, note: "x" });
    expect(none.state.adjustments[0].currency).toBe("EUR");
  });

  it("refuses zero, fractional cents, an empty note, a long note and an oversized amount, and saves nothing", async () => {
    const t = open();
    const add = (amountCents: number, note = "x") => t.service.addAdjustment(owner, { month: "2026-11", amountCents, note });
    expect(await add(0)).toEqual({ ok: false, reason: "zero" });
    expect(await add(1.5)).toEqual({ ok: false, reason: "not-whole" });
    expect(await add(100, "   ")).toEqual({ ok: false, reason: "no-note" });
    expect(await add(100, "a".repeat(201))).toEqual({ ok: false, reason: "note-too-long" });
    expect(await add(1_000_000_001)).toEqual({ ok: false, reason: "too-large" });
    expect(await add(-1_000_000_001)).toEqual({ ok: false, reason: "too-large" });
    expect(await add(100, "a".repeat(200))).toEqual({ ok: true });
    expect(t.state.adjustments).toHaveLength(1);
  });

  it("refuses a closed month, a month that has not started and a month that is not a month", async () => {
    const t = setupEarnings({ now: "2026-11-10T10:00:00Z", revenue: { "2026-10": {} } });
    t.state.closed.set("2026-10", { month: "2026-10", closedAt: new Date(), closedById: "boss", currency: "EUR", grossCents: 0, vatCents: 0, feesCents: 0, refundsCents: 0, adjustmentsCents: 0, netCents: 0, poolCents: 0, instikCents: 0, totalViews: 0 });
    expect(await t.service.addAdjustment(owner, { month: "2026-10", amountCents: 100, note: "x" })).toEqual({ ok: false, reason: "closed" });
    expect(await t.service.addAdjustment(owner, { month: "2027-02", amountCents: 100, note: "x" })).toEqual({ ok: false, reason: "future" });
    expect(await t.service.addAdjustment(owner, { month: "next", amountCents: 100, note: "x" })).toEqual({ ok: false, reason: "month" });
    expect(t.state.adjustments).toHaveLength(0);
  });
});

describe("what an adjustment does to the statement", () => {
  it("changes net revenue before the split: a late 43.00 refund costs the pool 34.40 and Instik 8.60", async () => {
    const t = open();
    const before = (await t.service.getStatement(owner, "2026-11"))!;
    await t.service.addAdjustment(owner, { month: "2026-11", amountCents: -4_300, note: "Late refund for October" });
    const after = (await t.service.getStatement(owner, "2026-11"))!;
    expect(before.poolCents! - after.poolCents!).toBe(3_440);
    expect(before.instikCents! - after.instikCents!).toBe(860);
    expect(after.netCents).toBe(before.netCents! - 4_300);
    expect(after.adjustmentsCents).toBe(-4_300);
    expect(after.adjustments).toHaveLength(1);
  });

  it("is cancelled by an opposite adjustment, never by an edit", async () => {
    const t = open();
    const start = (await t.service.getStatement(owner, "2026-11"))!.netCents;
    await t.service.addAdjustment(owner, { month: "2026-11", amountCents: -4_300, note: "Entered by mistake" });
    await t.service.addAdjustment(owner, { month: "2026-11", amountCents: 4_300, note: "Cancels the entry above" });
    const s = (await t.service.getStatement(owner, "2026-11"))!;
    expect(s.netCents).toBe(start);
    expect(s.adjustments).toHaveLength(2);
    expect(Object.keys(t.service).filter((n) => /edit|update|delete|remove/i.test(n))).toEqual([]);
  });

  it("shows nothing about adjustments on a month that has none", async () => {
    const s = (await open().service.getStatement(owner, "2026-11"))!;
    expect(s.adjustments).toEqual([]);
    expect(s.adjustmentsCents).toBe(0);
  });
});
